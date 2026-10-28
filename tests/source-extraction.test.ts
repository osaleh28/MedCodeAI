import test from "node:test";
import assert from "node:assert/strict";
import { indexSource, sourceExtractionSchema, resolveSourceExtraction } from "../src/lib/clinical/source-extraction";
import { demoCases } from "../src/lib/clinical/demos";
import { hasGroundedEvidence } from "../src/lib/clinical/contracts";
import { evaluateMdm } from "../src/lib/clinical/mdm";

test("source indexing preserves exact Unicode, negation, quantities and decimal values", () => {
  const note = "HPI\r\nNo chest pain. Cough for 2 days.\nTemperature 36.9 C; prednisone 40 mg. Patient’s history is unchanged.";
  const source = indexSource(note);
  assert.equal(source.find((span) => span.text.startsWith("Temperature"))?.text, "Temperature 36.9 C; prednisone 40 mg.");
  assert.ok(source.every((span, index) => span.id === index + 1 && note.includes(span.text)));
  assert.ok(source.some((span) => span.text === "No chest pain."));
  assert.ok(source.some((span) => span.text.includes("Patient’s")));
});

test("live source references resolve into the existing contract and unchanged deterministic expectations", () => {
  for (const sample of demoCases) {
    // A source may span multiple sentences. The fixture's exact excerpts are
    // legitimate source spans; reference resolution must never rewrite them.
    const quotes = [...new Set([...sample.extraction.problems, ...sample.extraction.data, ...sample.extraction.risks, ...sample.extraction.gaps].flatMap((finding) => finding.evidence))];
    const source = quotes.map((text, index) => ({ id: index + 1, text }));
    const reference = <T extends { evidence: string[] }>(item: T) => ({ ...item, evidence: item.evidence.map((quote) => quotes.indexOf(quote) + 1) });
    const { encounterConcerns: _concerns, risks: _risks, ...base } = sample.extraction;
    void _concerns; void _risks;
    const wire = { ...base, serviceConflicts: [], problems: sample.extraction.problems.map(reference), data: sample.extraction.data.map(reference), managementDecisions: sample.extraction.risks.map(reference), gaps: sample.extraction.gaps.map(reference) };
    const resolved = resolveSourceExtraction(wire, source, sample.note);
    assert.deepEqual(resolved, sample.extraction);
    assert.equal(evaluateMdm(resolved, sample.note, sample.noteType).potentialCode, sample.expected.code);
  }
});

test("invalid or invented references are rejected; uncertainty still excludes definite credit", () => {
  const sample = demoCases[1];
  const source = [{ id: 1, text: sample.note }];
  const { encounterConcerns: _concerns, risks: _risks, ...base } = sample.extraction;
  void _concerns; void _risks;
  const wire = { ...base, serviceConflicts: [], problems: [{ ...sample.extraction.problems[0], evidence: [1], uncertain: true }], data: [], managementDecisions: [], gaps: [] };
  const resolved = resolveSourceExtraction(wire, source, sample.note);
  assert.equal(hasGroundedEvidence(resolved.problems[0], sample.note), false);
  for (const evidence of [[0], [2], [1.5], ["invented quote"]]) {
    assert.equal(sourceExtractionSchema(source).safeParse({ ...wire, problems: [{ ...wire.problems[0], evidence }] }).success, false);
  }
  assert.throws(() => resolveSourceExtraction(wire, [{ id: 1, text: "Invented source." }], sample.note));
  assert.equal(sourceExtractionSchema(source).safeParse({ ...wire, potentialCode: "99223" }).success, false);
});

test("medical complaints cannot become service conflicts; aligned services do not block coding", () => {
  const sample = demoCases[1];
  const source = [{ id: 1, text: sample.note }];
  const { encounterConcerns: _concerns, risks: _risks, ...base } = sample.extraction;
  void _concerns; void _risks;
  const ref = <T extends { evidence: string[] }>(item: T) => ({ ...item, evidence: [1] });
  const wire = { ...base, serviceConflicts: [], problems: sample.extraction.problems.map(ref), managementDecisions: sample.extraction.risks.map(ref), data: sample.extraction.data.map(ref), gaps: [] };
  const conflict = { service: "COPD exacerbation", evidence: [1], explanation: "Presenting illness." };
  assert.equal(sourceExtractionSchema(source).safeParse({ ...wire, serviceConflicts: [conflict] }).success, false);
  const aligned = resolveSourceExtraction({ ...wire, serviceConflicts: [{ ...conflict, service: "initial_hospital_care" }] }, source, sample.note, "admission");
  assert.equal(evaluateMdm(aligned, sample.note, "admission").potentialCode, "99222");
  const discharge = resolveSourceExtraction({ ...wire, serviceConflicts: [{ ...conflict, service: "discharge_management" }] }, source, sample.note, "admission");
  assert.equal(evaluateMdm(discharge, sample.note, "admission").potentialCode, null);
  assert.equal(sourceExtractionSchema(source).safeParse({ ...wire, serviceConflicts: [{ ...conflict, service: "discharge_management", evidence: [] }] }).success, false);
});
