import test from "node:test";
import assert from "node:assert/strict";
import { demoCases } from "../src/lib/clinical/demos";
import { evaluateMdm } from "../src/lib/clinical/mdm";
import type { ClinicalExtraction } from "../src/lib/clinical/contracts";

// Original fictional regression fixture; never include a supplied clinical note.
const note = "Fictional teaching case. I reviewed CBC, BMP, urinalysis, TSH and troponin I. I discussed management with an external cardiologist. I independently interpreted another clinician's ECG.";
function fixture(keys = ["blood_count", "metabolic_panel", "urinalysis", "thyroid_stimulating_hormone", "troponin_i"]) {
  const extraction: ClinicalExtraction = structuredClone(demoCases.find((sample) => sample.id === "progress-moderate")!.extraction);
  extraction.dataComplete = true;
  extraction.data = keys.map((key) => ({ kind: "laboratory", label: key, activity: "review", uniqueKey: key, evidence: [note], uncertain: false, explanation: "Explicit fictional review.", qualifies: true, separatelyReported: null, performedByOther: null }));
  return extraction;
}

test("an unverified extra lab preserves established Moderate data without crediting that lab", () => {
  for (const activity of ["review", "order"] as const) {
    const extraction = fixture();
    extraction.data[4].activity = activity;
    const result = evaluateMdm(extraction, note, "progress");
    assert.equal(result.data.level, "Moderate");
    assert.equal(result.data.minimum, "Moderate");
    assert.equal(result.data.maximum, "Moderate");
    assert.equal(result.data.credited.length, 4);
    assert.match(result.data.excluded.join(" "), /troponin_i.*no definite credit/);
    assert.match(result.data.explanation, /extra tests alone cannot establish high/);
  }
});

test("unverified ordinary tests can leave Low versus Moderate unresolved, but cannot supply High", () => {
  const result = evaluateMdm(fixture(["blood_count", "metabolic_panel", "troponin_i"]), note, "progress");
  assert.equal(result.data.level, null);
  assert.equal(result.data.minimum, "Low");
  assert.equal(result.data.maximum, "Moderate");
});

test("incomplete extraction, uncertain review evidence and uncertain eligibility retain wider uncertainty", () => {
  for (const kind of ["incomplete", "evidence", "eligibility", "unknown_interpretation"] as const) {
    const extraction = fixture();
    if (kind === "incomplete") extraction.dataComplete = false;
    if (kind === "evidence") extraction.data[4].evidence = ["Invented evidence not in the note."];
    if (kind === "eligibility") extraction.data[4].qualifies = null;
    if (kind === "unknown_interpretation") extraction.data[4].activity = "independent_interpretation";
    const result = evaluateMdm(extraction, note, "progress");
    assert.equal(result.data.level, null);
    assert.equal(result.data.minimum, "Moderate");
    assert.equal(result.data.maximum, "High");
  }
});

test("a genuinely uncertain second category can still change Moderate data to High", () => {
  for (const activity of ["external_discussion", "independent_interpretation"] as const) {
    const extraction = fixture();
    extraction.data.push({ ...extraction.data[0], kind: activity === "external_discussion" ? "discussion" : "cardiac", activity, uniqueKey: activity === "external_discussion" ? "external_cardiologist" : "electrocardiogram", separatelyReported: null, performedByOther: true });
    const result = evaluateMdm(extraction, note, "progress");
    assert.equal(result.data.level, null);
    assert.equal(result.data.maximum, "High");
  }
});

test("a confirmed second category preserves High despite another unverified lab", () => {
  const extraction = fixture();
  extraction.data.push({ ...extraction.data[0], kind: "discussion", activity: "external_discussion", uniqueKey: "external_cardiologist", separatelyReported: false });
  const result = evaluateMdm(extraction, note, "progress");
  assert.equal(result.data.level, "High");
  assert.equal(result.data.credited.length, 5);
});

test("an unknown test can still matter when discussion alone establishes Moderate", () => {
  const extraction = fixture(["blood_count", "metabolic_panel", "troponin_i"]);
  extraction.data.push({ ...extraction.data[0], kind: "discussion", activity: "external_discussion", uniqueKey: "external_cardiologist", separatelyReported: false });
  const result = evaluateMdm(extraction, note, "progress");
  assert.equal(result.data.level, null);
  assert.equal(result.data.minimum, "Moderate");
  assert.equal(result.data.maximum, "High");
});

test("result listings receive no credit and do not become uncertain reviews", () => {
  const extraction = fixture(["troponin_i"]);
  extraction.data[0].activity = "result_only";
  const result = evaluateMdm(extraction, note, "progress");
  assert.equal(result.data.level, "Straightforward");
  assert.equal(result.data.credited.length, 0);
});
