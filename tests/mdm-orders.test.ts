import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMdm, mdmResultSchema } from "../src/lib/clinical/mdm";
import { clinicalExtractionSchema } from "../src/lib/clinical/contracts";
import { infectionOrdersCase } from "./fixtures/infection-orders";
import { respiratoryAdmissionCase } from "./fixtures/respiratory-admission";

const fixture = () => structuredClone(infectionOrdersCase);

test("respiratory threat and contextual admission decision establish high MDM without stock phrases", () => {
  const sample = respiratoryAdmissionCase;
  const result = evaluateMdm(sample.extraction, sample.note, "admission");
  assert.equal(result.problems.level, "High");
  assert.equal(result.risk.level, "High");
  assert.equal(result.data.level, "Moderate");
  assert.equal(result.potentialCode, "99223");
  assert.ok(!/respiratory failure|life.threatening|I decided to admit/i.test(sample.note));
});

test("two supported high elements do not require high diagnostic data", () => {
  const sample = respiratoryAdmissionCase;
  const result = evaluateMdm({ ...sample.extraction, data: [], dataComplete: false }, sample.note, "admission");
  assert.equal(result.data.level, null);
  assert.equal(result.potentialCode, "99223");
});

test("an admission decision alone does not upgrade moderate problems and data to high MDM", () => {
  const sample = fixture();
  const result = evaluateMdm(sample.extraction, sample.note, "admission");
  assert.equal(result.risk.level, "High");
  assert.equal(result.problems.level, "Moderate");
  assert.equal(result.potentialCode, "99222");
});

test("three distinct explicit UA, TSH and Legionella orders support moderate data", () => {
  const sample = fixture();
  const result = evaluateMdm(sample.extraction, sample.note, "admission");
  assert.equal(result.problems.level, "Moderate");
  assert.equal(result.risk.level, "High");
  assert.equal(result.data.level, "Moderate");
  assert.equal(result.data.credited.length, 3);
  assert.equal(result.overall, "Moderate");
  assert.equal(result.potentialCode, "99222");
});

test("order/review duplicates and overlapping urinalysis components count once", () => {
  const sample = fixture();
  const ua = sample.extraction.data[1];
  sample.extraction.data.push({ ...ua, activity: "review", uniqueKey: "ua" }, { ...ua, uniqueKey: "urinalysis_with_microscopy" }, { ...ua, uniqueKey: "urine_microscopy" }, { ...sample.extraction.data[2], uniqueKey: "tsh" });
  const result = evaluateMdm(sample.extraction, sample.note, "admission");
  assert.equal(result.data.credited.length, 3);
  assert.equal(result.data.level, "Moderate");
});

test("recognized test identities never turn result listings into activities", () => {
  const sample = fixture();
  sample.extraction.data = sample.extraction.data.map((item) => ({ ...item, activity: "result_only" }));
  const result = evaluateMdm(sample.extraction, sample.note, "admission");
  assert.equal(result.data.credited.length, 0);
  assert.equal(result.data.level, "Straightforward");
});

test("an unspecified thyroid reflex panel is not credited as standalone TSH", () => {
  const sample = fixture();
  sample.extraction.data = [{ ...sample.extraction.data[2], uniqueKey: "thyroid_reflex_panel" }];
  const result = evaluateMdm(sample.extraction, sample.note, "admission");
  assert.equal(result.data.credited.length, 0);
  assert.equal(result.data.level, null);
});

test("moderate/high uncertainty retains a clearly separate evidence-supported code floor", () => {
  const sample = fixture();
  sample.extraction.data = []; sample.extraction.dataComplete = false;
  for (const [type, code] of [["admission", "99222"], ["progress", "99232"]] as const) {
    const result = evaluateMdm(sample.extraction, sample.note, type);
    assert.equal(result.minimum, "Moderate");
    assert.equal(result.maximum, "High");
    assert.equal(result.overall, null);
    assert.equal(result.potentialCode, null);
    assert.equal(result.minimumSupportedCode, code);
    assert.match(result.explanation, /minimum supported code/);
    assert.match(result.explanation, /exact final level has not been established/i);
  }
});

test("missing evidence and conflicting services cannot generate a minimum code", () => {
  const sample = fixture();
  const missing = { ...sample.extraction, problems: [], risks: [], data: [], problemsComplete: false, riskComplete: false, dataComplete: false };
  assert.equal(evaluateMdm(missing, sample.note, "admission").minimumSupportedCode, null);
  for (const changed of [{ isClinicalNote: false }, { encounterConcerns: ["Consultation-only service"] }]) {
    const result = evaluateMdm({ ...sample.extraction, ...changed }, sample.note, "admission");
    assert.equal(result.potentialCode, null);
    assert.equal(result.minimumSupportedCode, null);
  }
});

test("historical reports do not silently acquire minimum codes or a new rule version", () => {
  const sample = fixture();
  const { minimumSupportedCode: _floor, ...old } = evaluateMdm(sample.extraction, sample.note, "admission");
  void _floor;
  old.ruleVersion = "hospital-mdm-2023-public-v2";
  const parsed = mdmResultSchema.parse(old);
  assert.equal(parsed.minimumSupportedCode, null);
  assert.equal(parsed.ruleVersion, old.ruleVersion);
  assert.equal(clinicalExtractionSchema.safeParse({ ...sample.extraction, minimumSupportedCode: "99223" }).success, false);
});
