// Local HTTP + Neon smoke test. Uses only prepared fictional cases; never calls
// OpenAI. Creates two temporary accounts and removes only their test records.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { hash } from "bcryptjs";
import { encode } from "next-auth/jwt";

dotenv.config({ quiet: true });
const base = new URL(process.env.MEDCODE_TEST_URL || process.env.AUTH_URL || "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Smoke tests must target a local development server.");
assert.ok(process.env.DATABASE_URL && process.env.AUTH_SECRET, "Configure DATABASE_URL and AUTH_SECRET first.");
const fixturePath = new URL("../.npm-cache/unit-tests/src/lib/clinical/demos.js", import.meta.url);
assert.ok(fs.existsSync(fixturePath), "Run npm test to compile fixtures before running the integration test.");
const { demoCases } = await import(fixturePath.href);
const ids = [randomUUID(), randomUUID()].map((id) => `smoke-${id}`);
const emails = ids.map((id) => `${id}@example.invalid`);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
await db.connect();
const cookieName = base.protocol === "https:" ? "__Secure-authjs.session-token" : "authjs.session-token";
const headers = async (index) => ({
  Cookie: `${cookieName}=${await encode({ token: { sub: ids[index], name: "Synthetic Smoke Check", email: emails[index] }, secret: process.env.AUTH_SECRET, salt: cookieName, maxAge: 600 })}`,
  Origin: base.origin, "Content-Type": "application/json",
});
const url = (pathname) => new URL(pathname, base).href;
try {
  const passwordHash = await hash(randomBytes(24).toString("base64"), 12);
  for (let index = 0; index < ids.length; index++) await db.query('INSERT INTO "User" (id, name, email, "passwordHash", "updatedAt") VALUES ($1,$2,$3,$4,NOW())', [ids[index], "Synthetic Smoke Check", emails[index], passwordHash]);
  const aHeaders = await headers(0), bHeaders = await headers(1);
  const anonymous = await fetch(url("/api/analyses"), { method: "POST", headers: { Origin: base.origin, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(anonymous.status, 401);
  assert.equal((await fetch(url("/api/analyses/nonexistent"))).status, 401);
  const saved = [];
  for (const [index, sample] of demoCases.entries()) {
    const inputMode = index % 2 ? "sections" : "full";
    const input = { noteType: sample.noteType, inputMode, fullNote: inputMode === "full" ? sample.note : "", sections: inputMode === "sections" ? sample.sections : Object.fromEntries(Object.keys(sample.sections).map((key) => [key, ""])), privacyConfirmed: true, improveHpi: sample.noteType === "admission", providerMode: "prepared_demo", sampleId: sample.id, billingContext: { independentInterpretationEligible: true, externalDiscussionNotSeparatelyReported: true } };
    const inactiveKey = sample.noteType === "admission" ? "intervalHistory" : "hpi";
    input.sections = { ...input.sections, [inactiveKey]: "Inactive fictional draft must not be retained." };
    const response = await fetch(url("/api/analyses"), { method: "POST", headers: aHeaders, body: JSON.stringify(input) });
    const result = await response.json();
    assert.equal(response.status, 201, `Prepared creation failed: ${result.error || response.status}`);
    saved.push(result.id);
    const ownResponse = await fetch(url(`/api/analyses/${result.id}`), { headers: aHeaders });
    assert.equal(ownResponse.status, 200);
    const record = await ownResponse.json();
    assert.equal(record.syntheticNote, sample.note);
    assert.equal(record.noteType, sample.noteType);
    assert.equal(record.inputMode, inputMode);
    assert.ok(!(inactiveKey in record.submittedInput.sections));
    if (inputMode === "full") assert.deepEqual(record.submittedInput.sections, {});
    assert.equal(record.suggestedCptCode, sample.expected.code);
    assert.equal(record.structuredAnalysis.origin, "prepared_demo");
    assert.equal(record.structuredAnalysis.documentSource, "synthetic");
    assert.equal(record.syntheticDataConfirmed, true);
    assert.deepEqual(record.structuredAnalysis.billingContext, { independentInterpretationEligible: false, externalDiscussionNotSeparatelyReported: false });
    assert.deepEqual(record.submittedInput.billingContext, record.structuredAnalysis.billingContext);
    assert.equal(record.structuredAnalysis.mdm.overall, sample.expected.overall);
    if (sample.noteType === "admission") assert.equal(record.structuredAnalysis.hpi.originalHpi, sample.sections.hpi);
    assert.equal((await fetch(url(`/api/analyses/${result.id}`), { headers: bHeaders })).status, 404);
    const resultsPage = await fetch(url(`/dashboard/analyses/${result.id}`), { headers: aHeaders });
    assert.equal(resultsPage.status, 200);
    const resultsHtml = await resultsPage.text();
    assert.ok(resultsHtml.includes(sample.expected.code ?? "Indeterminate"));
    assert.ok(resultsHtml.includes("Coding-rule conclusion"));
    assert.ok(resultsHtml.includes("Submitted documentation"));
    assert.ok(resultsHtml.includes("Prepared educational example"));
    assert.ok(resultsHtml.includes(`CPT ${sample.expected.code} educational fact sheet`), "The result's educational card must use the saved encounter family and code.");
    if (sample.noteType === "admission") assert.ok(resultsHtml.includes("Original HPI"));
    console.log(`PASS ${sample.id}: persisted ${sample.expected.code}, readable by owner, hidden from other account.`);
  }
  const forbiddenPage = await fetch(url(`/dashboard/analyses/${saved[0]}`), { headers: bHeaders });
  const forbiddenHtml = await forbiddenPage.text();
  // App Router can already have streamed a 200 shell before notFound() runs.
  // Assert the rendered denial and absence of private note data as well as the
  // API's strict 404 status above.
  assert.ok([200, 404].includes(forbiddenPage.status));
  assert.ok(forbiddenHtml.includes("Page not found."));
  assert.ok(!forbiddenHtml.includes(demoCases[0].sections.hpi));
  const history = await fetch(url("/dashboard/history"), { headers: aHeaders });
  assert.equal(history.status, 200);
  const historyHtml = await history.text();
  assert.ok(historyHtml.includes("<h1>Saved analyses</h1>"));
  assert.ok(saved.every((id) => historyHtml.includes(id)), "Saved analyses must retain the full archive, not just the overview preview.");
  const otherHistory = await fetch(url("/dashboard/history"), { headers: bHeaders });
  assert.ok(!(await otherHistory.text()).includes(saved[0]));
  const crossOrigin = await fetch(url("/api/analyses"), { method: "POST", headers: { ...aHeaders, Origin: "https://untrusted.example" }, body: "{}" });
  assert.equal(crossOrigin.status, 403);
  const sample = demoCases[0];
  const validInput = { noteType: sample.noteType, inputMode: "full", fullNote: sample.note, sections: sample.sections, privacyConfirmed: true, improveHpi: false, providerMode: "prepared_demo", sampleId: sample.id };
  for (const input of [
    { ...validInput, fullNote: "", sections: {} },
    { ...validInput, privacyConfirmed: false },
    { ...validInput, userId: ids[1] },
    { ...validInput, fullNote: "MRN: 123456" },
    { ...validInput, privacyConfirmed: true, providerMode: "openai", fullNote: "Patient name: Fictional Person" },
    { ...validInput, fullNote: sample.note + " Edited documentation." },
  ]) {
    const response = await fetch(url("/api/analyses"), { method: "POST", headers: aHeaders, body: JSON.stringify(input) });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  const malformed = await fetch(url("/api/analyses"), { method: "POST", headers: aHeaders, body: "{broken" });
  assert.equal(malformed.status, 400);
  const missing = await fetch(url("/api/analyses/nonexistent"), { headers: aHeaders });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "BillingAnalysis" WHERE "userId"=$1', [ids[0]])).rows[0].count, demoCases.length);
  console.log("PASS invalid/empty input, missing acknowledgements, forged ownership, identifiers, modified fixtures, malformed JSON, missing records, and no unintended saves.");
  const newPage = await fetch(url("/dashboard/new"), { headers: aHeaders });
  assert.equal(newPage.status, 200);
  const newHtml = await newPage.text();
  assert.ok(newHtml.includes("Full note") && newHtml.includes("Separate sections"));
  assert.ok(newHtml.includes("Admission H&amp;P") && newHtml.includes("Choose a code card"));
  assert.ok(newHtml.indexOf("Choose a code card") < newHtml.indexOf("How MDM complexity is determined"), "Code cards must precede the MDM learning guide.");
  for (const sample of demoCases) assert.ok(newHtml.includes(`value="${sample.id}"`));
  console.log("PASS anonymous requests, cross-origin requests, direct record IDs, full saved pages, and history isolation.");

  // Delete only a record created by this test, never an existing user's data.
  const deleteTarget = saved.at(-1);
  const deleteUrl = url(`/api/analyses/${deleteTarget}`);
  const dashboardBefore = await fetch(url("/dashboard"), { headers: aHeaders });
  assert.equal(dashboardBefore.status, 200);
  const dashboardHtml = await dashboardBefore.text();
  assert.ok(dashboardHtml.includes(deleteTarget) && dashboardHtml.includes("delete-analysis-button"));
  assert.ok(dashboardHtml.includes("<h1>Overview</h1>") && dashboardHtml.includes("Start a new analysis"));
  const previewIds = [...dashboardHtml.matchAll(/<a href="\/dashboard\/analyses\/([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(previewIds, saved.slice(-3).reverse(), "Overview must show only the three latest results.");
  assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: { Origin: base.origin } })).status, 401);
  assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: bHeaders })).status, 404);
  assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: { ...aHeaders, Origin: "https://untrusted.example" } })).status, 403);
  assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: { Cookie: aHeaders.Cookie } })).status, 403);
  assert.equal((await fetch(deleteUrl, { headers: aHeaders })).status, 200);
  const deleted = await fetch(deleteUrl, { method: "DELETE", headers: aHeaders });
  assert.equal(deleted.status, 204);
  assert.equal(deleted.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await fetch(deleteUrl, { headers: aHeaders })).status, 404);
  assert.equal((await fetch(deleteUrl, { method: "DELETE", headers: aHeaders })).status, 404);
  const dashboardAfter = await fetch(url("/dashboard"), { headers: aHeaders });
  assert.ok(!(await dashboardAfter.text()).includes(deleteTarget));
  const historyAfter = await fetch(url("/dashboard/history"), { headers: aHeaders });
  assert.ok(!(await historyAfter.text()).includes(deleteTarget));
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "BillingAnalysis" WHERE "userId"=$1', [ids[0]])).rows[0].count, demoCases.length - 1);
  console.log("PASS owner deletion removes the saved record from dashboard/history; anonymous, foreign-owner, cross-origin and repeated deletions are denied.");
} finally {
  // IDs are random and were created only for this test. User deletion cascades
  // to this test's analyses; existing users and analyses are untouched.
  await db.query('DELETE FROM "User" WHERE id = ANY($1::text[])', [ids]);
  const keys = ids.flatMap((id) => ["demo", "analysis"].map((operation) => createHash("sha256").update(`${operation}:${id}`).digest("hex")));
  await db.query('DELETE FROM "AuthThrottle" WHERE key = ANY($1::text[])', [keys]);
  await db.end();
  console.log("Removed temporary smoke-test accounts and their records.");
}
