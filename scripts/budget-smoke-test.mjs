// Real PostgreSQL concurrency checks. No paid AI calls, user records, schema
// migrations, or budget changes in the application's tables. Every test table
// lives in a uniquely named schema which is removed in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
dotenv.config({ quiet: true });
const { reserveBudget, settleBudget } = await import("../.npm-cache/unit-tests/src/lib/clinical/usage-budget.js");
const { maximumAnalysisCostMicros, UsageLimitError } = await import("../.npm-cache/unit-tests/src/lib/clinical/limits.js");
assert.ok(process.env.DATABASE_URL, "Configure DATABASE_URL. Run npm test first.");
pg.types.setTypeParser(1114, (value) => new Date(`${value}Z`));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 60_000, query_timeout: 20_000 });
const namespace = `budget_test_${randomUUID().replaceAll("-", "")}`;
assert.match(namespace, /^budget_test_[a-f0-9]{32}$/);
const scoped = `"${namespace}"`;
let created = false;
function adapter(client) {
  const query = async (strings, values) => client.query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : "") + part, ""), values.map((value) => value instanceof Date ? value.toISOString() : value));
  return {
    $queryRaw: async (strings, ...values) => (await query(strings, values)).rows,
    $executeRaw: async (strings, ...values) => (await query(strings, values)).rowCount,
  };
}
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${scoped}`);
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const result = await fn(adapter(client));
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
const reserve = (user, hpi = false) => transaction((tx) => reserveBudget(tx, user, hpi));
const settle = (reservation, amount = 0) => transaction((tx) => settleBudget(tx, reservation, amount, 0, 0));
const query = (sql, values = []) => transaction((tx) => tx.$queryRaw([sql], ...values));
async function reset() { await transaction((tx) => tx.$executeRaw`TRUNCATE "AiUsageReservation", "AiUserQuota", "AiBudgetWindow"`); }
async function check(label, fn) { await reset(); await fn(); console.log(`PASS ${label}`); }
try {
  await pool.query(`CREATE SCHEMA ${scoped}`); created = true;
  const migration = fs.readFileSync(new URL("../prisma/migrations/20261029000000_ai_usage_limits/migration.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try { await client.query(`SET search_path TO ${scoped}`); await client.query(migration); }
  finally { await client.query("RESET search_path"); client.release(); }

  await check("concurrent requests by one user admit exactly one", async () => {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => reserve("one-user")));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    for (const result of results) if (result.status === "rejected") assert.ok(result.reason instanceof UsageLimitError);
  });
  await check("10 daily attempts, then rejection; other accounts remain independent", async () => {
    for (let i = 0; i < 10; i++) await settle(await reserve("daily-user"));
    await assert.rejects(() => reserve("daily-user"), /10 live analysis attempts/);
    await settle(await reserve("another-user"));
  });
  await check("parallel global reservations stop before the daily cap", async () => {
    const results = await Promise.allSettled(Array.from({ length: 36 }, (_, i) => reserve(`parallel-${i}`, true)));
    for (const result of results) if (result.status === "rejected") assert.ok(result.reason instanceof UsageLimitError, `Unexpected admission failure: ${result.reason?.name}`);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, Math.floor(1_000_000 / maximumAnalysisCostMicros(true)));
    const windows = await query('SELECT "amountMicros" FROM "AiBudgetWindow"');
    assert.ok(windows.every((row) => row.amountMicros <= 1_000_000));
  });
  await check("exact-fit daily and monthly admission; additional requests are blocked", async () => {
    const first = await reserve("seed");
    await settle(first);
    await transaction((tx) => tx.$executeRaw`UPDATE "AiBudgetWindow" SET "amountMicros" = CASE WHEN key = ${first.dayKey} THEN ${1_000_000 - first.reservedMicros}::integer ELSE ${20_000_000 - first.reservedMicros}::integer END`);
    await reserve("last-fitting-request");
    await assert.rejects(() => reserve("over-budget"), /monthly AI budget/);
    await transaction((tx) => tx.$executeRaw`UPDATE "AiBudgetWindow" SET "amountMicros" = 0 WHERE key = ${first.monthKey}`);
    await assert.rejects(() => reserve("over-daily-budget"), /daily AI budget/);
  });
  await check("settlement refunds once; abandoned reservations keep their maximum", async () => {
    const reservation = await reserve("settlement", true);
    await settle(reservation, 1234);
    await settle(reservation, 0);
    assert.ok((await query('SELECT "amountMicros" FROM "AiBudgetWindow"')).every((row) => row.amountMicros === 1234));
    await reserve("abandoned", true);
    assert.ok((await query('SELECT "amountMicros" FROM "AiBudgetWindow"')).every((row) => row.amountMicros === 1234 + maximumAnalysisCostMicros(true)));
  });
  await check("expired lease recovers; old completion cannot unlock a newer request", async () => {
    const old = await reserve("lease");
    await transaction((tx) => tx.$executeRaw`UPDATE "AiUserQuota" SET "activeUntil" = CURRENT_TIMESTAMP - INTERVAL '1 minute'`);
    const current = await reserve("lease");
    await settle(old);
    await assert.rejects(() => reserve("lease"), /already have a live analysis/);
    await settle(current);
    await settle(await reserve("lease"));
  });
  await check("UTC rollover resets attempts while active lease still blocks", async () => {
    const old = await reserve("rollover");
    await transaction((tx) => tx.$executeRaw`UPDATE "AiUserQuota" SET day = '2000-01-01', attempts = 10`);
    await assert.rejects(() => reserve("rollover"), /already have a live analysis/);
    await settle(old);
    const next = await reserve("rollover");
    const [quota] = await query('SELECT attempts FROM "AiUserQuota"');
    assert.equal(quota.attempts, 1);
    await settle(next);
  });
  await check("late settlement affects only original admission windows", async () => {
    const old = await reserve("old-window");
    await transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "AiBudgetWindow" SET key = CASE WHEN key = ${old.dayKey} THEN 'day:2000-01-01' ELSE 'month:2000-01' END`;
      await tx.$executeRaw`UPDATE "AiUsageReservation" SET "dayKey" = 'day:2000-01-01', "monthKey" = 'month:2000-01' WHERE id = ${old.id}`;
    });
    await reserve("new-window");
    await settle(old, 99);
    const windows = await query('SELECT key, "amountMicros" FROM "AiBudgetWindow"');
    assert.ok(windows.filter((row) => row.key.includes("2000")).every((row) => row.amountMicros === 99));
    assert.ok(windows.filter((row) => !row.key.includes("2000")).every((row) => row.amountMicros === old.reservedMicros));
  });
  console.log("All database budget checks passed. No OpenAI generation requests were made.");
} finally {
  try { if (created) await pool.query(`DROP SCHEMA ${scoped} CASCADE`); }
  finally { await pool.end(); }
}
