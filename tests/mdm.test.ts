import test from "node:test";
import assert from "node:assert/strict";
import { demoCases } from "../src/lib/clinical/demos";
import { clinicalExtractionSchema, groundExtraction, validateHpi, type ClinicalExtraction } from "../src/lib/clinical/contracts";
import { evaluateMdm, levels, mapHospitalCode } from "../src/lib/clinical/mdm";

const fixture = (id = "admission-moderate") => structuredClone(demoCases.find((item) => item.id === id)!);

for (const sample of demoCases) test(`verified prepared case: ${sample.title}`, () => {
  clinicalExtractionSchema.parse(sample.extraction);
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.problems.level, sample.expected.problems);
  assert.equal(result.data.level, sample.expected.data);
  assert.equal(result.risk.level, sample.expected.risk);
  assert.equal(result.overall, sample.expected.overall);
  assert.equal(result.potentialCode, sample.expected.code);
  for (const item of [...sample.extraction.problems, ...sample.extraction.data, ...sample.extraction.risks]) {
    assert.ok(item.evidence.length);
    assert.ok(item.evidence.every((quote) => sample.note.includes(quote)));
  }
});

test("all four internal levels map to the proper two hospital families", () => {
  assert.deepEqual(levels.map((level) => mapHospitalCode("admission", level)), ["99221", "99221", "99222", "99223"]);
  assert.deepEqual(levels.map((level) => mapHospitalCode("progress", level)), ["99231", "99231", "99232", "99233"]);
});

test("two-of-three framework holds for all 64 definite element combinations", () => {
  const note = "Explicit criterion evidence for this rules-unit-test fixture.";
  const base = fixture().extraction;
  const evidence = { evidence: [note], uncertain: false, explanation: "Controlled criterion fixture." };
  for (let p = 0; p < 4; p++) for (let d = 0; d < 4; d++) for (let r = 0; r < 4; r++) {
    const extraction: ClinicalExtraction = { ...base, problems: [{ ...base.problems[0], ...evidence, criterion: (["minor", "uncomplicated_acute", "chronic_flare", "organ_threat"] as const)[p] }],
      risks: [{ ...base.risks[0], ...evidence, criterion: (["minimal_support", "low_management", "prescription_decision", "admission_or_escalation_decision"] as const)[r] }],
      data: d === 0 ? [] : Array.from({ length: d === 1 ? 2 : 3 }, (_, index) => ({ ...base.data[index], ...evidence, uniqueKey: ["cbc", "bmp", "chest_radiograph"][index] })),
    };
    if (d === 3) extraction.data.push({ ...base.data[0], ...evidence, kind: "discussion", activity: "external_discussion", uniqueKey: "external_specialist", separatelyReported: false });
    const result = evaluateMdm(extraction, note, "admission");
    assert.equal(result.overall, levels[[p, d, r].sort((a, b) => a - b)[1]], `P${p} D${d} R${r}`);
  }
});

test("orders, reviews, repeated CBC components, and overlapping panels are deduplicated", () => {
  const sample = fixture();
  const cbc = sample.extraction.data[0], bmp = sample.extraction.data[1];
  sample.extraction.data = [cbc, { ...cbc, activity: "order" }, ...["hemoglobin", "wbc", "platelets"].map((uniqueKey) => ({ ...cbc, uniqueKey })), bmp, { ...bmp, uniqueKey: "cmp" }];
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.data.level, "Low");
  assert.equal(result.data.credited.length, 2);
});

test("a long list of laboratory and imaging results earns no physician-activity credit", () => {
  const sample = fixture();
  sample.extraction.data = sample.extraction.data.map((item) => ({ ...item, activity: "result_only" }));
  assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).data.level, "Straightforward");
});

test("independent interpretation requires explicit separate-reporting and performer eligibility", () => {
  const sample = fixture();
  const item: ClinicalExtraction["data"][number] = { ...sample.extraction.data[2], activity: "independent_interpretation", performedByOther: true, separatelyReported: null };
  sample.extraction.data = [item];
  let result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.data.level, null);
  assert.equal(result.data.credited.length, 0);
  item.separatelyReported = false;
  result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.data.level, "Moderate");
});

test("multiple interpretations represent one category; two categories are needed for high data", () => {
  const sample = fixture();
  sample.extraction.data = [0, 1, 2].map((index) => ({ ...sample.extraction.data[2], activity: "independent_interpretation", uniqueKey: index % 2 ? "ecg" : "chest_radiograph", performedByOther: true, separatelyReported: false }));
  assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).data.level, "Moderate");
  sample.extraction.data.push({ ...sample.extraction.data[0], activity: "external_discussion", kind: "discussion", uniqueKey: "external_clinician" });
  assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).data.level, "High");
});

test("separately reported interpretations are excluded", () => {
  const sample = fixture();
  sample.extraction.data = [{ ...sample.extraction.data[2], activity: "independent_interpretation", separatelyReported: true, performedByOther: true }];
  assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).data.credited.length, 0);
});

test("unknown unique-test identities are unresolved, and oximetry earns no test credit", () => {
  const sample = fixture();
  sample.extraction.data = [{ ...sample.extraction.data[0], uniqueKey: "unverified_test" }];
  let result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.data.level, null); assert.equal(result.data.credited.length, 0);
  sample.extraction.data = [{ ...sample.extraction.data[0], uniqueKey: "pulse_oximetry" }];
  result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.data.level, "Straightforward"); assert.equal(result.data.credited.length, 0);
});

test("multiple independent historians contribute at most one historian unit", () => {
  const sample = fixture();
  sample.extraction.data = ["family", "caregiver", "witness"].map((uniqueKey) => ({ ...sample.extraction.data[0], activity: "independent_historian", kind: "historian", uniqueKey }));
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.data.level, "Low");
  assert.equal(result.data.credited.length, 1);
});

test("background or duplicate chronic conditions do not supply extra problems", () => {
  const sample = fixture();
  sample.extraction.problems = [sample.extraction.problems[0], { ...sample.extraction.problems[0] }, { ...sample.extraction.problems[1], addressed: false }];
  assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).problems.level, "Low");
});

test("missing risk and data documentation does not default to a reliable low code", () => {
  const sample = fixture("admission-lower");
  sample.extraction.risks = []; sample.extraction.riskComplete = false; sample.extraction.dataComplete = false;
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.overall, null);
  assert.equal(result.potentialCode, null);
});

test("two definite high elements can establish high MDM despite unknown data", () => {
  const sample = fixture("progress-high");
  sample.extraction.dataComplete = false; sample.extraction.data = [];
  assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).overall, "High");
});

test("unresolved third element can prevent choosing between moderate and high", () => {
  const sample = fixture("progress-high");
  sample.extraction.risks = [{ ...sample.extraction.risks[0], criterion: "prescription_decision" }];
  sample.extraction.dataComplete = false; sample.extraction.data = [];
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.minimum, "Moderate"); assert.equal(result.maximum, "High");
  assert.equal(result.potentialCode, null);
});

test("unsupported evidence cannot supply definite high credit", () => {
  const sample = fixture("admission-high");
  sample.extraction.problems[0].evidence = ["An invented source sentence."];
  sample.extraction.risks[0].evidence = ["Another invented source sentence."];
  const grounded = groundExtraction(sample.extraction, sample.note);
  assert.equal(grounded.problems[0].uncertain, true);
  assert.equal(evaluateMdm(grounded, sample.note, sample.noteType).potentialCode, null);
});

test("nonclinical and conflicting encounter documentation remains indeterminate", () => {
  const sample = fixture();
  assert.equal(evaluateMdm({ ...sample.extraction, isClinicalNote: false }, sample.note, sample.noteType).potentialCode, null);
  assert.equal(evaluateMdm({ ...sample.extraction, encounterConcerns: ["Discharge-only service"] }, sample.note, sample.noteType).potentialCode, null);
});

test("model output schema refuses final CPT or MDM selections", () => {
  assert.equal(clinicalExtractionSchema.safeParse({ ...fixture().extraction, potentialCode: "99223" }).success, false);
  assert.equal(clinicalExtractionSchema.safeParse({ ...fixture().extraction, overall: "High" }).success, false);
});

test("HPI suggestions need original excerpts and cannot introduce new numeric facts", () => {
  const sample = fixture("admission-lower");
  const original = sample.hpi!;
  assert.equal(validateHpi(original, sample.note).status, "available");
  assert.equal(validateHpi({ ...original, originalHpi: "Invented history" }, sample.note).status, "not_identified");
  assert.equal(validateHpi({ ...original, sentences: [{ text: "Symptoms began 99 days ago.", sourceQuotes: [original.originalHpi] }] }, sample.note).status, "not_identified");
  assert.equal(validateHpi({ ...original, sentences: [{ text: original.originalHpi, sourceQuotes: [] }] }, sample.note).status, "not_identified");
  assert.equal(validateHpi({ ...original, sentences: [{ text: original.originalHpi + " Headache is present.", sourceQuotes: [original.originalHpi] }] }, sample.note).status, "not_identified");
  assert.equal(validateHpi({ ...original, sentences: [{ text: original.originalHpi.replace("no vomiting", "vomiting"), sourceQuotes: [original.originalHpi] }] }, sample.note).status, "not_identified");
});
