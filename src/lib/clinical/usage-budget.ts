import { createHash, randomUUID } from "node:crypto";
import { DAILY_BUDGET_MICROS, MONTHLY_BUDGET_MICROS, LIVE_ANALYSES_PER_DAY, maximumAnalysisCostMicros, UsageLimitError } from "./limits";

// A minimal transaction interface also allows testing against real PostgreSQL
// without loading Next.js or a production Prisma client.
export interface BudgetTransaction {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}
export interface Reservation { id: string; userKey: string; dayKey: string; monthKey: string; reservedMicros: number }
async function lock(tx: BudgetTransaction) {
  // All admission and settlement operations take the same transaction lock.
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(20261029, 1)`;
}
export async function reserveBudget(tx: BudgetTransaction, userId: string, includeHpi: boolean): Promise<Reservation> {
  await lock(tx);
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  const day = now.toISOString().slice(0, 10);
  const dayKey = `day:${day}`, monthKey = `month:${day.slice(0, 7)}`;
  const userKey = createHash("sha256").update(`ai:${userId}`).digest("hex");
  const [{ remainingDay, remainingMonth }] = await tx.$queryRaw<{ remainingDay: number; remainingMonth: number }[]>`
    SELECT ${DAILY_BUDGET_MICROS} - COALESCE((SELECT "amountMicros" FROM "AiBudgetWindow" WHERE key = ${dayKey}), 0) AS "remainingDay",
           ${MONTHLY_BUDGET_MICROS} - COALESCE((SELECT "amountMicros" FROM "AiBudgetWindow" WHERE key = ${monthKey}), 0) AS "remainingMonth"`;
  const reservedMicros = maximumAnalysisCostMicros(includeHpi);
  const secondsUntilDay = Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86_400_000 - now.getTime()) / 1000);
  if (remainingMonth < reservedMicros) {
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    throw new UsageLimitError("This demo's monthly AI budget is used or reserved. Try a prepared example, or return next month (UTC).", Math.ceil((nextMonth.getTime() - now.getTime()) / 1000));
  }
  if (remainingDay < reservedMicros) throw new UsageLimitError("This demo's daily AI budget is used or reserved. Try a prepared example, or return after midnight UTC.", secondsUntilDay);
  const [quota] = await tx.$queryRaw<{ day: string; attempts: number; activeUntil: Date | null }[]>`SELECT day, attempts, "activeUntil" FROM "AiUserQuota" WHERE key = ${userKey}`;
  if (quota?.activeUntil && quota.activeUntil > now) throw new UsageLimitError("You already have a live analysis running. Check Saved analyses before trying again.", Math.ceil((quota.activeUntil.getTime() - now.getTime()) / 1000));
  if (quota?.day === day && quota.attempts >= LIVE_ANALYSES_PER_DAY) throw new UsageLimitError("You have reached 10 live analysis attempts today. Prepared examples remain available. Live analysis resets at midnight UTC.", secondsUntilDay);
  const id = randomUUID();
  // The lease survives process termination; it exceeds the route's 60s lifetime.
  const activeUntil = new Date(now.getTime() + 120_000);
  await tx.$executeRaw`INSERT INTO "AiUserQuota" (key, day, attempts, "activeUntil", "activeId") VALUES (${userKey}, ${day}, 1, ${activeUntil}, ${id})
    ON CONFLICT (key) DO UPDATE SET day = EXCLUDED.day, attempts = CASE WHEN "AiUserQuota".day = EXCLUDED.day THEN "AiUserQuota".attempts + 1 ELSE 1 END, "activeUntil" = EXCLUDED."activeUntil", "activeId" = EXCLUDED."activeId"`;
  for (const key of [dayKey, monthKey]) await tx.$executeRaw`INSERT INTO "AiBudgetWindow" (key, "amountMicros") VALUES (${key}, ${reservedMicros}) ON CONFLICT (key) DO UPDATE SET "amountMicros" = "AiBudgetWindow"."amountMicros" + EXCLUDED."amountMicros"`;
  await tx.$executeRaw`INSERT INTO "AiUsageReservation" (id, "userKey", "dayKey", "monthKey", "reservedMicros", "createdAt") VALUES (${id}, ${userKey}, ${dayKey}, ${monthKey}, ${reservedMicros}, ${now})`;
  return { id, userKey, dayKey, monthKey, reservedMicros };
}

export async function settleBudget(tx: BudgetTransaction, reservation: Reservation, chargedMicros: number, inputTokens: number, outputTokens: number) {
  if (![chargedMicros, inputTokens, outputTokens].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("Invalid AI accounting");
  await lock(tx);
  // Claim settlement once; replays cannot refund the same reservation twice.
  const [claimed] = await tx.$queryRaw<{ reservedMicros: number; dayKey: string; monthKey: string; userKey: string }[]>`
    UPDATE "AiUsageReservation" SET "chargedMicros" = ${chargedMicros}, "inputTokens" = ${inputTokens}, "outputTokens" = ${outputTokens}, "finishedAt" = CURRENT_TIMESTAMP
    WHERE id = ${reservation.id} AND "finishedAt" IS NULL RETURNING "reservedMicros", "dayKey", "monthKey", "userKey"`;
  if (!claimed) return;
  // Unknown/aborted calls retain their full reservation. Known usage, including
  // invalid/refused output, is charged before validation; cached inputs are
  // conservatively charged at the uncached rate. Never refund into a new day.
  const difference = chargedMicros - claimed.reservedMicros;
  for (const key of [claimed.dayKey, claimed.monthKey]) await tx.$executeRaw`UPDATE "AiBudgetWindow" SET "amountMicros" = "amountMicros" + ${difference} WHERE key = ${key}`;
  await tx.$executeRaw`UPDATE "AiUserQuota" SET "activeUntil" = NULL, "activeId" = NULL WHERE key = ${claimed.userKey} AND "activeId" = ${reservation.id}`;
}
