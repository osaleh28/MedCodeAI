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
const { infectionOrdersCase } = await import(new URL("../../../tests/fixtures/infection-orders.js", root).href);
const { respiratoryAdmissionCase } = await import(new URL("../../../tests/fixtures/respiratory-admission.js", root).href);
const { reviewedRespiratoryCase, referenceOnlyRespiratoryCase } = await import(new URL("../../../tests/fixtures/reviewed-respiratory-data.js", root).href);
const { emptyBillingContext } = await import(new URL("billing-context.js", root).href);
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
  const caseIds = process.argv.includes("--reporting") ? ["admission-reviewed-data-unconfirmed", "admission-reviewed-data", "admission-reviewed-data", "admission-reporting-confirmations-only"] : process.argv.includes("--context") ? ["admission-respiratory-context", "admission-respiratory-context", "admission-orders", "admission-lower", "admission-moderate", "progress-moderate", "progress-high"] : process.argv.includes("--orders") ? ["admission-orders", "admission-unresolved-test"] : process.argv.includes("--core")
    ? [...demoCases.filter((sample) => /^(admission|progress)-(lower|moderate|high)$/.test(sample.id)).map((sample) => sample.id), "progress-incomplete"]
    : ["admission-moderate", "progress-moderate"];
  for (const [index, sampleId] of caseIds.entries()) {
    let sample = sampleId === "admission-reviewed-data" ? reviewedRespiratoryCase : sampleId === "admission-reporting-confirmations-only" ? referenceOnlyRespiratoryCase : sampleId === "admission-reviewed-data-unconfirmed" ? { ...reviewedRespiratoryCase, billingContext: emptyBillingContext, expected: { code: null, minimumCode: "99222" } } : sampleId === "admission-respiratory-context" ? respiratoryAdmissionCase : sampleId === "admission-orders" ? infectionOrdersCase : sampleId === "admission-unresolved-test" ? (() => {
      const sections = { ...infectionOrdersCase.sections, assessmentPlan: infectionOrdersCase.sections.assessmentPlan
        .replace("We will send urine Legionella antigen. We will order urinalysis. I have ordered a standalone TSH assay.", "I have ordered an echocardiogram.") };
      return { ...infectionOrdersCase, id: sampleId, sections, note: normalizeDocumentation({ noteType: "admission", inputMode: "sections", fullNote: "", sections }), expected: { code: null, minimumCode: "99222" } };
    })() : sampleId === "progress-incomplete"
      ? { id: sampleId, noteType: "progress", note: "Entirely fictional hospital progress documentation. Patient stable. Continue current plan.", sections: { ...emptySections }, expected: { code: null } }
      : demoCases.find((item) => item.id === sampleId);
    if (process.argv.includes("--history-dates")) {
      const historicalContext = "Fictional past medical history: appendectomy on 03/15/2010, with no ongoing symptoms or management for that resolved condition today.";
      const sections = { ...sample.sections, assessmentPlan: `${sample.sections.assessmentPlan}\n${historicalContext}`.trim() };
      sample = { ...sample, sections, note: normalizeDocumentation({ noteType: sample.noteType, inputMode: "sections", fullNote: "", sections }) };
    }
    const inputMode = index % 2 ? "sections" : "full";
    const input = { noteType: sample.noteType, inputMode, fullNote: inputMode === "full" ? sample.note : "", sections: inputMode === "sections" ? sample.sections : Object.fromEntries(Object.keys(sample.sections).map((key) => [key, ""])), privacyConfirmed: true, improveHpi: sample.noteType === "admission" && !process.argv.includes("--orders") && !process.argv.includes("--context") && !process.argv.includes("--reporting"), providerMode: "openai", sampleId: null, billingContext: sample.billingContext ?? emptyBillingContext };
    const response = await fetch(new URL("/api/analyses", base), { method: "POST", headers, body: JSON.stringify(input), signal: AbortSignal.timeout(60_000) });
    const result = await response.json();
    assert.equal(response.status, 201, result.error || "Live analysis was not saved.");
    const own = await fetch(new URL(`/api/analyses/${result.id}`, base), { headers });
    assert.equal(own.status, 200);
    const record = await own.json();
    assert.equal(record.syntheticNote, sample.note);
    if (process.argv.includes("--history-dates")) assert.ok(record.syntheticNote.includes("03/15/2010"), "Historical dates must be preserved, not silently removed or changed.");
    assert.equal(record.userId, id);
    // Only original fictional controls are submitted; custom live input has a neutral source label.
    assert.equal(record.submittedInput.documentSource, "user_provided");
    assert.equal(record.syntheticDataConfirmed, false);
    const report = reportSchema.parse(record.structuredAnalysis);
    if (process.argv.includes("--reporting")) console.log(JSON.stringify({ case: sampleId, code: report.mdm.potentialCode, minimum: report.mdm.minimumSupportedCode, dataComplete: report.extraction.dataComplete, data: report.extraction.data.map(({activity, uniqueKey, qualifies, uncertain, separatelyReported, performedByOther}) => ({activity, uniqueKey, qualifies, uncertain, separatelyReported, performedByOther})) }));
    assert.equal(report.origin, "openai");
    assert.equal(report.documentSource, "user_provided");
    assert.deepEqual(report.billingContext, sample.billingContext ?? emptyBillingContext);
    assert.deepEqual(record.submittedInput.billingContext, sample.billingContext ?? emptyBillingContext);
    assert.ok(report.model);
    const findings = [...report.extraction.problems, ...report.extraction.data, ...report.extraction.risks];
    for (const finding of findings.filter((item) => !item.uncertain)) {
      assert.ok(finding.evidence.length && finding.evidence.every((quote) => quote.trim() && sample.note.includes(quote)));
    }
    const recomputed = evaluateMdm(report.extraction, sample.note, sample.noteType);
    // Recompute from original extraction alone: HPI wording is never an input.
    assert.equal(recomputed.potentialCode, report.mdm.potentialCode);
    assert.equal(recomputed.overall, report.mdm.overall);
    assert.equal(recomputed.minimumSupportedCode, report.mdm.minimumSupportedCode);
    assert.equal(record.suggestedCptCode, report.mdm.potentialCode ?? report.mdm.minimumSupportedCode);
    if (sample.expected.minimumCode) {
      assert.equal(report.mdm.minimumSupportedCode, sample.expected.minimumCode);
      assert.equal(record.mdmComplexity, `At least ${report.mdm.minimum}`);
    }
    if (sampleId.startsWith("admission-reviewed-data")) {
      const copd = report.extraction.problems.find((item) => /copd|obstructive/i.test(`${item.label} ${item.problemKey}`));
      assert.ok(copd, "The documented COPD exacerbation must be extracted.");
      assert.equal(copd.criterion, "chronic_flare", "COPD exacerbation is not a traumatic injury.");
      assert.equal(copd.course, "chronic");
      assert.ok(report.mdm.data.credited.some((item) => /lactate|lactic acid/i.test(item)), "Reviewed lactate must receive its own eligible test credit.");
      if (sampleId === "admission-reviewed-data") assert.equal(report.mdm.data.level, "High");
    }
    const page = await fetch(new URL(`/dashboard/analyses/${result.id}`, base), { headers });
    assert.equal(page.status, 200);
    const resultHtml = await page.text();
    assert.ok(resultHtml.includes("Live AI extraction"));
    if (Object.values(sample.billingContext ?? emptyBillingContext).some(Boolean)) assert.ok(resultHtml.includes("Billing answers you confirmed"));
    if (sample.expected.minimumCode) {
      assert.ok(resultHtml.includes("Minimum supported CPT code"));
      assert.ok(resultHtml.includes(sample.expected.minimumCode));
      assert.ok(resultHtml.includes("Exact final level unresolved"));
      const history = await fetch(new URL("/dashboard/history", base), { headers });
      assert.equal(history.status, 200);
      const historyHtml = await history.text();
      assert.ok(historyHtml.includes(result.id) && historyHtml.includes(`At least ${report.mdm.minimum}`));
    }
    if (report.hpi?.status === "available") assert.ok(sample.note.includes(report.hpi.originalHpi));
    const displayedCode = report.mdm.potentialCode || (report.mdm.minimumSupportedCode ? `minimum supported ${report.mdm.minimumSupportedCode} (exact final level unresolved)` : "indeterminate");
    console.log(`PASS live ${sampleId} (${inputMode}): structured response, traceable definite findings, owner persistence/reopen, deterministic ${displayedCode}; HPI ${report.hpi?.status || "not requested"}.`);
    console.log(`REVIEW ${sampleId}: expected exact fictional-case code ${sample.expected.code}; displayed ${displayedCode}; ${findings.filter((item) => item.uncertain).length} uncertain findings. Exact excerpts and passing transport checks do not establish clinical/billing accuracy.`);
    console.log(`ELEMENTS ${sampleId}: problems=${report.mdm.problems.level || "uncertain"}, data=${report.mdm.data.level || "uncertain"}, risk=${report.mdm.risk.level || "uncertain"}; service conflicts=${report.extraction.encounterConcerns.length}.`);
    if (report.mdm.potentialCode !== sample.expected.code) {
      expectationMismatches++;
      // Controlled fictional fixtures only; no note text, quotes or free-form
      // model explanations are printed in these transport diagnostics.
      console.log(JSON.stringify({ case: sampleId, dataComplete: report.extraction.dataComplete, problemsComplete: report.extraction.problemsComplete, riskComplete: report.extraction.riskComplete, problems: report.extraction.problems.map(({criterion, addressed, uncertain}) => ({criterion, addressed, uncertain})), risks: report.extraction.risks.map(({criterion, uncertain}) => ({criterion, uncertain})),
        data: report.extraction.data.map(({ kind, activity, uniqueKey, qualifies, uncertain, separatelyReported }) => ({ kind, activity, uniqueKey, qualifies, uncertain, separatelyReported })) }));
    }
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
