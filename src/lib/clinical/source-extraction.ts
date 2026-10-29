import { z } from "zod";
import { clinicalExtractionSchema, type ClinicalExtraction } from "./contracts";
import type { NoteType } from "./input";

export type SourceSpan = { id: number; text: string };

// References are transport-only. Resolve them back to verbatim text before the
// existing evidence checks, rules engine, UI, or persistence sees a finding.
export function indexSource(note: string): SourceSpan[] {
  const spans: SourceSpan[] = [];
  let start = 0;
  const add = (end: number) => {
    const text = note.slice(start, end).trim();
    if (text) spans.push({ id: spans.length + 1, text });
  };
  for (const match of note.matchAll(/\r?\n+|(?<=[.!?])[\t ]+(?=[A-Z0-9])/g)) {
    add(match.index);
    start = match.index + match[0].length;
  }
  add(note.length);
  return spans;
}

export function sourceExtractionSchema(source: SourceSpan[]) {
  if (!source.length) throw new Error("Source documentation is required.");
  const evidence = z.array(z.number().int().min(1).max(source.length))
    .describe("IDs of original source spans supporting this finding. Do not output quotes or invent IDs.");
  const { problems, risks, data, gaps, ...rest } = clinicalExtractionSchema.shape;
  const p = problems.element.shape, r = risks.element.shape, d = data.element.shape;
  // Put findings before completeness judgments, and clinical labels before
  // citations, so the model evaluates actual work before declaring uncertainty.
  return z.object({
    isClinicalNote: rest.isClinicalNote.describe("True for clinical documentation, including fictional or de-identified notes. This classification does not certify privacy or validate clinical facts."),
    serviceConflicts: z.array(z.object({
      service: z.enum(["initial_hospital_care", "subsequent_hospital_care", "consultation", "critical_care", "discharge_management", "same_day_admission_discharge"]),
      explanation: z.string(), evidence: evidence.min(1),
    }).strict()).describe("Only explicit SERVICE CATEGORY conflicts with the selected encounter. Never list diagnoses, symptoms, presenting complaints, documentation questions, or missing administrative details. Usually empty for an aligned hospital note."),
    problems: z.array(z.object({
      label: p.label, problemKey: p.problemKey, course: p.course.describe("Underlying condition course: COPD/asthma/heart failure exacerbations remain chronic illnesses despite an acute flare."), addressed: p.addressed,
      criterion: p.criterion.describe("COPD exacerbation is chronic_flare unless severe_chronic_flare/organ_threat is supported. complicated_injury is only for an actual physical injury, never pneumonia/COPD or another illness. Assess documented near-term severity without treatment. organ_threat can be supported by acute respiratory compromise with significant hypoxemia, increased work of breathing and new oxygen treatment; exact diagnostic phrases are not required. Do not invent respiratory failure. Stabilization after initial treatment does not automatically make the same actively managed illness stable_acute. A diagnosis name, isolated value or baseline oxygen alone is insufficient."), management: p.management, explanation: p.explanation,
      evidence, uncertain: p.uncertain,
    }).strict()),
    managementDecisions: z.array(z.object({
      decision: r.decision,
      criterion: r.criterion.describe("admission_or_escalation_decision can be documented by the treating clinician's admission assessment and necessary inpatient treatment/disposition plan; no exact admission phrase or separate author-role attestation is required. Respect explicit prior placement without a new decision. prescription_decision includes starting, changing, stopping, or reasoned continuation of prescription therapy. Routine monitoring or improvement does not erase this decision. minimal_support/low_management are for actual supportive low-risk decisions, not absence of high-risk work."),
      explanation: r.explanation, evidence, uncertain: r.uncertain,
    }).strict()).describe("All actual documented management decisions, including supportive hydration/diet and reasoned prescription choices. Do not return an empty list merely because there is no high-risk management."),
    data: z.array(z.object({
      label: d.label, kind: d.kind, activity: d.activity,
      uniqueKey: d.uniqueKey.describe("Use exactly blood_count, metabolic_panel, electrocardiogram, chest_radiograph, urinalysis, thyroid_stimulating_hormone, legionella_urine_antigen, blood_lactate, spirometry for these groups; no suffixes. CBC and BMP are separate panels. Standalone TSH only. Generic PFTs are not necessarily spirometry. Other tests/sources retain their own stable identity."),
      qualifies: d.qualifies.describe("Whether the actual clinical activity/source qualifies. A Labs Reviewed heading applies to its listed tests, including a normal lactate. Keep billing uncertainty in separatelyReported/performedByOther; do not erase a clear activity merely because reporting information is unknown."),
      separatelyReported: d.separatelyReported.describe("Separate reporting by THIS E/M clinician, not a radiologist/pulmonologist billing their own service. Apply explicit user reporting confirmations to documented activities only; otherwise preserve genuine uncertainty."), performedByOther: d.performedByOther,
      explanation: d.explanation, evidence, uncertain: d.uncertain,
    }).strict()),
    gaps: z.array(gaps.element.extend({ evidence })),
    summary: rest.summary, uncertainties: rest.uncertainties,
    problemsComplete: rest.problemsComplete,
    dataComplete: rest.dataComplete.describe("Confidence that the documented data activities were captured, NOT whether the clinical workup or test results are finished. Return true when explicit orders are clear even if results are pending. Three clear orders plus an explicit denial of other data activities is complete. Do not return false for missing results or hypothetical undocumented work. False requires a specific unresolved ambiguity about an actual documented activity, explained in gaps/uncertainties."),
    riskComplete: rest.riskComplete.describe("True when current management decisions are clear, including explicitly documented supportive care. No prescription or high-risk decision is not itself missing management information."),
  }).strict();
}

export function resolveSourceExtraction(value: unknown, source: SourceSpan[], note: string, noteType?: NoteType): ClinicalExtraction {
  const parsed = sourceExtractionSchema(source).parse(value);
  const byId = new Map(source.map((span) => [span.id, span.text]));
  const resolve = <T extends { evidence: number[] }>(item: T) => ({
    ...item, evidence: [...new Set(item.evidence)].map((id) => {
      const quote = byId.get(id);
      if (!quote || !note.includes(quote)) throw new Error("Source reference could not be verified.");
      return quote;
    }),
  });
  const { serviceConflicts, managementDecisions, ...clinical } = parsed;
  const conflicts = serviceConflicts.filter((item) => !(noteType === "admission" && item.service === "initial_hospital_care")
    && !(noteType === "progress" && item.service === "subsequent_hospital_care"));
  return clinicalExtractionSchema.parse({
    ...clinical, encounterConcerns: conflicts.map((item) => `${item.service.replaceAll("_", " ")}: ${item.explanation} Source: ${resolve(item).evidence.join(" ")}`),
    problems: parsed.problems.map(resolve), risks: managementDecisions.map(resolve),
    data: parsed.data.map(resolve), gaps: parsed.gaps.map(resolve),
  });
}
