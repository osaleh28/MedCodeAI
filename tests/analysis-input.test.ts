import test from "node:test";
import assert from "node:assert/strict";
import { analysisInputSchema, containsObviousIdentifiers, emptySections, normalizeDocumentation, sectionKeys } from "../src/lib/clinical/input";
import { demoCases, resolvePreparedCase } from "../src/lib/clinical/demos";
import { InputError, readLimitedJson, sameOrigin } from "../src/lib/clinical/api-input";

const base = { noteType: "admission", inputMode: "full", fullNote: "Fictional documentation.", sections: { ...emptySections }, syntheticOnly: true, improveHpi: false, providerMode: "openai", sampleId: null };
test("empty or inactive-only documentation cannot be analyzed", () => {
  assert.equal(analysisInputSchema.safeParse({ ...base, fullNote: "  " }).success, false);
  assert.equal(analysisInputSchema.safeParse({ ...base, inputMode: "sections" }).success, false);
  assert.equal(analysisInputSchema.safeParse({ ...base, noteType: "progress", inputMode: "sections", sections: { ...emptySections, hpi: "Inactive admission draft." } }).success, false);
});
test("any single active section is enough; all other sections remain optional", () => {
  for (const noteType of ["admission", "progress"] as const) for (const key of sectionKeys(noteType)) {
    assert.equal(analysisInputSchema.safeParse({ ...base, noteType, inputMode: "sections", sections: { ...emptySections, [key]: "Fictional section." } }).success, true);
  }
});
test("consent, encounter assumption, note length, and workflow are validated", () => {
  for (const changed of [{ syntheticOnly: false }, { noteType: "other" }, { fullNote: "a".repeat(12_001) }, { noteType: "progress", improveHpi: true }]) assert.equal(analysisInputSchema.safeParse({ ...base, ...changed }).success, false);
});

test("workflow selection requires no additional encounter checkbox", () => {
  for (const noteType of ["admission", "progress"] as const) {
    for (const legacyValue of [undefined, false, true]) {
      const parsed = analysisInputSchema.safeParse({ ...base, noteType, encounterConfirmed: legacyValue });
      assert.equal(parsed.success, true);
      if (parsed.success) assert.equal(parsed.data.noteType, noteType);
    }
  }
  assert.equal(analysisInputSchema.safeParse({ ...base, noteType: "consultation" }).success, false);
  assert.equal(analysisInputSchema.safeParse({ ...base, syntheticOnly: false }).success, false);
});

test("12,000-character boundary applies to combined active sections including headings", () => {
  assert.equal(analysisInputSchema.safeParse({ ...base, fullNote: "x".repeat(12_000) }).success, true);
  assert.equal(analysisInputSchema.safeParse({ ...base, fullNote: "x".repeat(12_001) }).success, false);
  const sections = { ...emptySections, hpi: "x".repeat(6000), assessmentPlan: "y".repeat(6000) };
  const result = analysisInputSchema.safeParse({ ...base, fullNote: "", inputMode: "sections", sections });
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error.issues[0].message, /combined documentation/);
  for (const sample of demoCases) assert.ok(sample.note.length <= 12_000);
});
test("forged ownership fields are rejected rather than trusted", () => {
  assert.equal(analysisInputSchema.safeParse({ ...base, userId: "someone-else" }).success, false);
});
test("normalization includes only active sections in a consistent order", () => {
  const input = { noteType: "progress" as const, inputMode: "sections" as const, fullNote: "Inactive full-note draft.", sections: { ...emptySections, hpi: "Inactive HPI.", intervalHistory: " Subjective facts. ", assessmentPlan: " Plan. " } };
  assert.equal(normalizeDocumentation(input), "Interval History / Subjective\nSubjective facts.\n\nAssessment & Plan\nPlan.");
});
test("prepared cases work in either mode, but changed notes cannot use fixtures", () => {
  for (const sample of demoCases) {
    assert.equal(normalizeDocumentation({ noteType: sample.noteType, inputMode: "sections", sections: sample.sections, fullNote: "" }), sample.note);
    assert.equal(resolvePreparedCase(sample.id, sample.note, sample.noteType)?.id, sample.id);
    assert.equal(resolvePreparedCase(sample.id, sample.note + " Changed.", sample.noteType), null);
    assert.equal(containsObviousIdentifiers(sample.note), false);
  }
});
test("obvious personal identifiers are rejected by an additional best-effort guard", () => {
  for (const value of ["MRN: 123456", "DOB: 01/01/1970", "Patient name: Fictional Person"]) assert.equal(containsObviousIdentifiers(value), true);
});
test("cross-origin and missing-origin mutation requests are rejected", () => {
  assert.equal(sameOrigin(new Request("https://demo.example/api/analyses", { headers: { origin: "https://evil.example" } })), false);
  assert.equal(sameOrigin(new Request("https://demo.example/api/analyses")), false);
  assert.equal(sameOrigin(new Request("https://demo.example/api/analyses", { headers: { origin: "https://demo.example" } })), true);
});
test("malformed, oversized, and non-JSON bodies are rejected", async () => {
  const request = (body: string, contentType = "application/json") => new Request("https://demo.example/api/analyses", { method: "POST", headers: { "content-type": contentType }, body });
  await assert.rejects(() => readLimitedJson(request("{broken")), InputError);
  await assert.rejects(() => readLimitedJson(request('"' + "x".repeat(128_001) + '"')), InputError);
  await assert.rejects(() => readLimitedJson(request("plain text", "text/plain")), InputError);
  assert.deepEqual(await readLimitedJson(request('{"ok":true}')), { ok: true });
});
