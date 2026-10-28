import test from "node:test";
import assert from "node:assert/strict";
import { addProgressClarifications } from "../src/lib/clinical/progress-guidance";
import { worksheetCases } from "../src/lib/clinical/worksheet-cases";
import { clinicalExtractionSchema } from "../src/lib/clinical/contracts";
import { evaluateMdm } from "../src/lib/clinical/mdm";

const sample = worksheetCases.find((item) => item.id === "worksheet-stable-conditions")!;

test("vague daily-plan phrases produce conditional questions with exact source evidence", () => {
  const note = "Patient stable. Continue POC. Per cardiology.";
  const result = addProgressClarifications(sample.extraction, note, "progress");
  const added = result.gaps.slice(sample.extraction.gaps.length);
  assert.equal(added.length, 3);
  for (const gap of added) {
    assert.equal(gap.uncertain, true);
    assert.ok(gap.question.startsWith("If not explained elsewhere,"));
    assert.ok(gap.question.endsWith("?"));
    assert.ok(gap.evidence.every((quote) => note.includes(quote)));
  }
  assert.equal(clinicalExtractionSchema.safeParse(result).success, true);
});

test("documentation prompts preserve every coding input and the resulting assessment", () => {
  const note = `${sample.note}\nPatient stable. Continue POC. Per cards.`;
  const original = structuredClone(sample.extraction);
  const result = addProgressClarifications(original, note, "progress");
  assert.deepEqual({ ...result, gaps: original.gaps }, original);
  assert.deepEqual(original, sample.extraction);
  assert.deepEqual(evaluateMdm(result, note, "progress"), evaluateMdm(original, note, "progress"));
  assert.equal(evaluateMdm(result, note, "progress").potentialCode, "99232");
});

test("adding prompts twice does not duplicate questions", () => {
  const note = "Pt. stable. Cont. POC. Per CCM.";
  const first = addProgressClarifications(sample.extraction, note, "progress");
  assert.equal(first.gaps.length, sample.extraction.gaps.length + 3);
  assert.deepEqual(addProgressClarifications(first, note, "progress"), first);
});

test("admission documentation does not receive progress-note phrase prompts", () => {
  assert.equal(addProgressClarifications(sample.extraction, "Patient stable. Continue POC.", "admission"), sample.extraction);
});

test("a specific daily plan does not receive phrase-based questions", () => {
  const note = "Follow-up for hypertension. I reviewed control at goal and decided to continue amlodipine today.";
  assert.deepEqual(addProgressClarifications(sample.extraction, note, "progress").gaps, sample.extraction.gaps);
});

test("uneventful interval history can trigger clarification without changing completeness", () => {
  for (const note of ["No acute overnight events.", "Nothing happened overnight.", "Patient feels great."]) {
    const result = addProgressClarifications(sample.extraction, note, "progress");
    assert.equal(result.gaps.length, sample.extraction.gaps.length + 1);
    assert.equal(result.problemsComplete, sample.extraction.problemsComplete);
    assert.equal(result.dataComplete, sample.extraction.dataComplete);
    assert.equal(result.riskComplete, sample.extraction.riskComplete);
  }
});
