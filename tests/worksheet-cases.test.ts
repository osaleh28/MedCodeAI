import test from "node:test";
import assert from "node:assert/strict";
import { worksheetCases } from "../src/lib/clinical/worksheet-cases";
import { clinicalExtractionSchema } from "../src/lib/clinical/contracts";
import { evaluateMdm } from "../src/lib/clinical/mdm";

const fixture = (id: string) => structuredClone(worksheetCases.find((sample) => sample.id === id)!);

test("worksheet practice includes the moderate-problems / low-data / moderate-risk teaching case", () => {
  const sample = fixture("worksheet-stable-conditions");
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.deepEqual([result.problems.level, result.data.level, result.risk.level], ["Moderate", "Low", "Moderate"]);
  assert.equal(result.overall, "Moderate");
  assert.equal(result.potentialCode, "99232");
});

test("routine response monitoring does not earn the intensive-toxicity risk category", () => {
  const sample = fixture("worksheet-routine-monitoring");
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(sample.extraction.risks.some((risk) => risk.criterion === "toxicity_monitoring"), false);
  assert.equal(result.risk.level, "Moderate");
  assert.equal(result.overall, "Low");
  assert.equal(result.potentialCode, "99231");
});

test("high toxicity-monitoring risk has a documented drug, serious toxicity, schedule, and action", () => {
  const sample = fixture("worksheet-intensive-toxicity");
  const risk = sample.extraction.risks[0];
  assert.equal(risk.criterion, "toxicity_monitoring");
  for (const detail of ["heparin", "6 hours", "fatal bleeding", "adjusted the infusion"]) assert.ok(risk.evidence[0].includes(detail));
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.data.level, null); // The unfamiliar test identity stays unresolved.
  assert.equal(result.problems.level, "High");
  assert.equal(result.risk.level, "High");
  assert.equal(result.potentialCode, "99223");
});

test("pre-existing DNR status and a current poor-prognosis decision have different assessments", () => {
  const historical = fixture("worksheet-existing-dnr");
  const current = fixture("worksheet-current-care-limitation");
  assert.equal(historical.extraction.risks.some((risk) => risk.criterion === "resuscitation_limitation"), false);
  assert.equal(evaluateMdm(historical.extraction, historical.note, historical.noteType).risk.level, "Moderate");
  assert.equal(current.extraction.risks[0].criterion, "resuscitation_limitation");
  assert.equal(evaluateMdm(current.extraction, current.note, current.noteType).risk.level, "High");
  const missingDecision = structuredClone(current.extraction);
  missingDecision.risks = []; missingDecision.riskComplete = false;
  assert.equal(evaluateMdm(missingDecision, current.note, current.noteType).potentialCode, null);
});

test("vague monitoring is excluded rather than promoted to a high risk category", () => {
  const sample = fixture("worksheet-routine-monitoring");
  sample.extraction.risks = [{ ...sample.extraction.risks[0], criterion: "unknown", uncertain: true, explanation: "Monitoring purpose and intensity cannot be established." }];
  const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  assert.equal(result.risk.level, null);
  assert.deepEqual(result.risk.credited, []);
  assert.equal(result.overall, "Low"); // Two independently supported low elements remain.
});

test("legacy diagnosis and data point totals cannot enter the extraction contract", () => {
  const extraction = fixture("worksheet-stable-conditions").extraction;
  assert.equal(clinicalExtractionSchema.safeParse({ ...extraction, diagnosisPoints: 4 }).success, false);
  assert.equal(clinicalExtractionSchema.safeParse({ ...extraction, dataPoints: 4 }).success, false);
});
