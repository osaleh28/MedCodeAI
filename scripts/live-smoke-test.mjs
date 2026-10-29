// Opt-in paid provider check: two built-in fictional notes, never local records.
// Targets localhost only and removes its own temporary account/results.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { hash } from "bcryptjs";
import { encode } from "next-auth/jwt";

dotenv.config({ quiet: true });
const root = new URL("../.npm-cache/unit-tests/src/lib/clinical/", import.meta.url);
const { demoCases } = await import(new URL("demos.js", root).href);
const { emptySections, normalizeDocumentation } = await import(new URL("input.js", root).href);
const { reportSchema } = await import(new URL("report.js", root).href);
const { evaluateMdm } = await import(new URL("mdm.js", root).href);
const { configuredApiKey } = await import(new URL("provider-client.js", root).href);
configuredApiKey(process.env.OPENAI_API_KEY);
const base = new URL(process.env.MEDCODE_TEST_URL || process.env.AUTH_URL || "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Live smoke tests must target localhost.");
assert.ok(process.env.AUTH_SECRET && process.env.DATABASE_URL);
const id = `live-audit-${randomUUID()}`;
let expectationMismatches = 0;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 1_000 });
db.on("error", () => console.error("A temporary test database connection closed; subsequent queries will reconnect."));
const cookieName = base.protocol === "https:" ? "__Secure-authjs.session-token" : "authjs.session-token";
const headers = { Origin: base.origin, "Content-Type": "application/json", Cookie: `${cookieName}=${await encode({ token: { sub: id }, secret: process.env.AUTH_SECRET, salt: cookieName, maxAge: 600 })}` };
try {
  await db.query('INSERT INTO "User" (id,name,email,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,NOW())', [id, "Synthetic Live Audit", `${id}@example.invalid`, await hash(randomBytes(24).toString("base64"), 12)]);
  const caseIds = process.argv.includes("--core")
    ? [...demoCases.filter((sample) => /^(admission|progress)-(lower|moderate|high)$/.test(sample.id)).map((sample) => sample.id), "progress-incomplete"]
    : ["admission-moderate", "progress-moderate"];
  for (const [index, sampleId] of caseIds.entries()) {
    let sample = sampleId === "progress-incomplete"
      ? { id: sampleId, noteType: "progress", note: "Entirely fictional hospital progress documentation. Patient stable. Continue current plan.", sections: { ...emptySections }, expected: { code: null } }
      : demoCases.find((item) => item.id === sampleId);
    if (process.argv.includes("--history-dates")) {
      const historicalContext = "Fictional past medical history: appendectomy on 03/15/2010, with no ongoing symptoms or management for that resolved condition today.";
      const sections = { ...sample.sections, assessmentPlan: `${sample.sections.assessmentPlan}\n${historicalContext}`.trim() };
      sample = { ...sample, sections, note: normalizeDocumentation({ noteType: sample.noteType, inputMode: "sections", fullNote: "", sections }) };
    }
    const inputMode = index % 2 ? "sections" : "full";
    const input = { noteType: sample.noteType, inputMode, fullNote: inputMode === "full" ? sample.note : "", sections: inputMode === "sections" ? sample.sections : Object.fromEntries(Object.keys(sample.sections).map((key) => [key, ""])), documentSource: index % 2 ? "deidentified" : "synthetic", privacyConfirmed: true, deidentificationConfirmed: index % 2 === 1, encounterConfirmed: true, improveHpi: sample.noteType === "admission", providerMode: "openai", sampleId: null };
    const response = await fetch(new URL("/api/analyses", base), { method: "POST", headers, body: JSON.stringify(input), signal: AbortSignal.timeout(60_000) });
    const result = await response.json();
    assert.equal(response.status, 201, result.error || "Live analysis was not saved.");
    const own = await fetch(new URL(`/api/analyses/${result.id}`, base), { headers });
    assert.equal(own.status, 200);
    const record = await own.json();
    assert.equal(record.syntheticNote, sample.note);
    if (process.argv.includes("--history-dates")) assert.ok(record.syntheticNote.includes("03/15/2010"), "Historical dates must be preserved, not silently removed or changed.");
    assert.equal(record.userId, id);
    // Synthetic controls exercise both declared-source paths; no real notes are used.
    assert.equal(record.submittedInput.documentSource, input.documentSource);
    assert.equal(record.syntheticDataConfirmed, input.documentSource === "synthetic");
    const report = reportSchema.parse(record.structuredAnalysis);
    assert.equal(report.origin, "openai");
    assert.equal(report.documentSource, input.documentSource);
    assert.ok(report.model);
    const findings = [...report.extraction.problems, ...report.extraction.data, ...report.extraction.risks];
    for (const finding of findings.filter((item) => !item.uncertain)) {
      assert.ok(finding.evidence.length && finding.evidence.every((quote) => quote.trim() && sample.note.includes(quote)));
    }
    const recomputed = evaluateMdm(report.extraction, sample.note, sample.noteType);
    // Recompute from original extraction alone: HPI wording is never an input.
    assert.equal(recomputed.potentialCode, report.mdm.potentialCode);
    assert.equal(recomputed.overall, report.mdm.overall);
    const page = await fetch(new URL(`/dashboard/analyses/${result.id}`, base), { headers });
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes("Live AI extraction"));
    if (report.hpi?.status === "available") assert.ok(sample.note.includes(report.hpi.originalHpi));
    console.log(`PASS live ${sampleId} (${inputMode}): structured response, traceable definite findings, owner persistence/reopen, deterministic ${report.mdm.potentialCode || "indeterminate"}; HPI ${report.hpi?.status || "not requested"}.`);
    console.log(`REVIEW ${sampleId}: expected fictional-case code ${sample.expected.code}; returned ${report.mdm.potentialCode || "indeterminate"}; ${findings.filter((item) => item.uncertain).length} uncertain findings. Exact excerpts and passing transport checks do not establish clinical/billing accuracy.`);
    console.log(`ELEMENTS ${sampleId}: problems=${report.mdm.problems.level || "uncertain"}, data=${report.mdm.data.level || "uncertain"}, risk=${report.mdm.risk.level || "uncertain"}; service conflicts=${report.extraction.encounterConcerns.length}.`);
    if (report.mdm.potentialCode !== sample.expected.code) expectationMismatches++;
  }
  if (expectationMismatches) {
    console.error(`REVIEW REQUIRED: ${expectationMismatches} live case(s) differed from the reviewed fixture expectations. Transport/persistence passed; interpretation acceptance did not. No code was forced.`);
    process.exitCode = 2;
  }
} finally {
  await db.query('DELETE FROM "User" WHERE id=$1', [id]);
  await db.query('DELETE FROM "AuthThrottle" WHERE key=$1', [createHash("sha256").update(`analysis:${id}`).digest("hex")]);
  await db.end();
  console.log("Removed only this live check's temporary account and saved fictional analyses.");
}
