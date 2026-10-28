import test from "node:test";
import assert from "node:assert/strict";
import { demoCases } from "../src/lib/clinical/demos";
import { evaluateMdm } from "../src/lib/clinical/mdm";
import { validateHpi } from "../src/lib/clinical/contracts";

const core = demoCases.filter((item) => item.group !== "worksheet");
const find = (id: string) => structuredClone(core.find((item) => item.id === id)!);

test("six core examples include encounter purpose, source-grounded HPI or interval course, and explicit decisions", () => {
  assert.equal(core.length, 6);
  for (const sample of core) {
    assert.ok(sample.learningFocus);
    assert.ok(sample.note.includes("Entirely fictional teaching encounter"));
    assert.ok(sample.sections.assessmentPlan.includes("I decided"));
    if (sample.noteType === "admission") {
      assert.ok(sample.sections.hpi.includes("Reason for evaluation:"));
      assert.ok(sample.sections.medicalHistory);
      assert.equal(validateHpi(sample.hpi!, sample.note).status, "available");
    } else {
      assert.ok(sample.sections.intervalHistory.includes("Reason for today's review:"));
      assert.ok(sample.sections.intervalHistory.includes("Nursing reports"));
      assert.ok(sample.sections.intervalHistory.includes("Relevant ROS"));
      assert.equal(sample.hpi, null);
    }
  }
});

test("improving COPD with oral transition still supports moderate MDM from the documented work", () => {
  const sample = find("progress-moderate");
  assert.ok(sample.sections.assessmentPlan.includes("replace IV methylprednisolone with oral prednisone"));
  assert.equal(evaluateMdm(sample.extraction, sample.note, "progress").potentialCode, "99232");
  assert.equal(sample.extraction.risks.some((risk) => risk.criterion === "toxicity_monitoring"), false);
});

test("heart-failure cases require actual admission or escalation evidence, not IV diuretic use alone", () => {
  for (const id of ["admission-high", "progress-high"]) {
    const sample = find(id);
    assert.equal(sample.extraction.problems.length, 1); // Related manifestations are not added as points.
    const result = evaluateMdm(sample.extraction, sample.note, sample.noteType);
    assert.equal(result.data.level, "Moderate");
    assert.equal(result.risk.level, "High");
    sample.extraction.risks = [];
    sample.extraction.riskComplete = false;
    assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).potentialCode, null);
  }
});

test("report review and listed EKG findings do not masquerade as independent interpretation", () => {
  for (const sample of core.filter((item) => !item.id.endsWith("lower"))) {
    const ecg = sample.extraction.data.find((item) => item.kind === "cardiac")!;
    assert.equal(ecg.activity, "result_only");
    assert.equal(ecg.qualifies, false);
    assert.ok(sample.extraction.data.every((item) => item.activity !== "independent_interpretation"));
    assert.equal(evaluateMdm(sample.extraction, sample.note, sample.noteType).data.credited.length, 3);
  }
});

test("complete lower-complexity progress documentation appropriately supports 99231", () => {
  const sample = find("progress-lower");
  assert.equal(sample.extraction.problemsComplete && sample.extraction.dataComplete && sample.extraction.riskComplete, true);
  assert.equal(evaluateMdm(sample.extraction, sample.note, "progress").potentialCode, "99231");
});
