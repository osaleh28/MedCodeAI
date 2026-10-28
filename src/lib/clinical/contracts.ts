import { z } from "zod";

// Deliberately no CPT code, overall MDM, or model-selected element level.
const finding = {
  evidence: z.array(z.string()),
  uncertain: z.boolean(),
  explanation: z.string(),
};
export const problemCriteria = ["minor", "stable_chronic", "uncomplicated_acute", "stable_acute", "chronic_flare", "new_uncertain_prognosis", "systemic_acute", "complicated_injury", "severe_chronic_flare", "organ_threat", "unknown"] as const;
export const riskCriteria = ["minimal_support", "low_management", "prescription_decision", "minor_procedure_with_risk", "major_procedure_without_risk", "social_constraint", "toxicity_monitoring", "major_procedure_with_risk", "emergency_major_procedure", "admission_or_escalation_decision", "resuscitation_limitation", "parenteral_controlled_medication", "unknown"] as const;
export const dataKinds = ["laboratory", "cardiac", "imaging", "other", "records", "historian", "discussion"] as const;
export const clinicalExtractionSchema = z.object({
  summary: z.string(),
  isClinicalNote: z.boolean(),
  encounterConcerns: z.array(z.string()),
  problemsComplete: z.boolean(),
  dataComplete: z.boolean(),
  riskComplete: z.boolean(),
  problems: z.array(z.object({
    ...finding, label: z.string(), problemKey: z.string(),
    course: z.enum(["acute", "chronic", "unclear"]),
    addressed: z.boolean().nullable(), criterion: z.enum(problemCriteria), management: z.string(),
  }).strict()),
  data: z.array(z.object({
    ...finding, label: z.string(), kind: z.enum(dataKinds),
    activity: z.enum(["result_only", "review", "order", "independent_interpretation", "external_record", "independent_historian", "external_discussion"]),
    // Same key for repeat values, panels/overlapping components, and order+review.
    uniqueKey: z.string(),
    qualifies: z.boolean().nullable(),
    separatelyReported: z.boolean().nullable(),
    performedByOther: z.boolean().nullable(),
  }).strict()),
  risks: z.array(z.object({ ...finding, decision: z.string(), criterion: z.enum(riskCriteria) }).strict()),
  gaps: z.array(z.object({
    question: z.string(), educationalExplanation: z.string(), evidence: z.array(z.string()),
    uncertain: z.boolean(),
  }).strict()),
  uncertainties: z.array(z.string()),
}).strict();
export type ClinicalExtraction = z.infer<typeof clinicalExtractionSchema>;
export type EvidenceFinding = { evidence: string[]; uncertain: boolean; explanation: string };

export const hpiSchema = z.object({
  status: z.enum(["available", "not_identified"]),
  originalHpi: z.string(),
  sentences: z.array(z.object({ text: z.string(), sourceQuotes: z.array(z.string()) }).strict()),
  clarificationQuestions: z.array(z.string()),
}).strict();
export type HpiResult = z.infer<typeof hpiSchema> & { suggestedHpi: string; warnings: string[] };

export function hasGroundedEvidence(finding: EvidenceFinding, note: string) {
  return !finding.uncertain && finding.evidence.length > 0
    && finding.evidence.every((quote) => quote.trim().length > 0 && note.includes(quote));
}

export function groundExtraction(extraction: ClinicalExtraction, note: string): ClinicalExtraction {
  const warnings: string[] = [];
  const ground = <T extends EvidenceFinding>(item: T): T => {
    if (hasGroundedEvidence(item, note) || item.uncertain) return item;
    warnings.push("An extracted finding lacked a matching source excerpt and was excluded from definite coding credit.");
    return { ...item, uncertain: true, explanation: `${item.explanation} Source evidence could not be verified.` };
  };
  return {
    ...extraction,
    problems: extraction.problems.map(ground), data: extraction.data.map(ground), risks: extraction.risks.map(ground),
    gaps: extraction.gaps.map((gap) => ({ ...gap, uncertain: true, evidence: gap.evidence.filter((quote) => quote.trim() && note.includes(quote)) })),
    uncertainties: [...new Set([...extraction.uncertainties, ...warnings])],
  };
}

export function validateHpi(result: z.infer<typeof hpiSchema>, note: string): HpiResult {
  const original = result.originalHpi;
  const numbers = (value: string): string[] => Array.from(value.match(/\d+(?:\.\d+)?/g) ?? []);
  const suggested = result.sentences.map((sentence) => sentence.text).join(" ");
  // Conservative lexical guard: allow organization/grammar changes, not novel
  // clinical vocabulary or removal of source content words. This is not a
  // semantic verifier; human review of meaning and attribution remains required.
  const grammar = new Set("a an the and or but with of in on at to for from by as is are was were be been being has have had he she they it his her their them this that these those patient reports reported describes described states stated notes noted fictional".split(" "));
  const words = (value: string) => new Set((value.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) => !grammar.has(word)));
  const sourceWords = words(original), suggestedWords = words(suggested);
  const sameVocabulary = [...sourceWords].every((word) => suggestedWords.has(word)) && [...suggestedWords].every((word) => sourceWords.has(word));
  const negations = (value: string) => (value.toLowerCase().match(/\b(no|not|without|denies|denied|never|negative)\b/g) ?? []).length;
  const sameNumbers = [...new Set(numbers(original))].every((number) => numbers(suggested).includes(number));
  const valid = result.status === "available" && original.trim().length > 0 && note.includes(original)
    && sameVocabulary && sameNumbers && negations(original) === negations(suggested)
    && result.sentences.length > 0 && result.sentences.every((sentence) => sentence.sourceQuotes.length > 0
      && sentence.sourceQuotes.every((quote) => quote.trim().length > 0 && original.includes(quote))
      && numbers(sentence.text).every((number) => numbers(original).includes(number)));
  if (!valid) return { ...result, status: "not_identified", originalHpi: original && note.includes(original) ? original : "", sentences: [], suggestedHpi: "", warnings: ["A source-grounded HPI rewrite could not be verified. The original documentation was preserved."] };
  return { ...result, suggestedHpi: suggested, warnings: ["AI wording suggestion: compare every statement with the original. Source matching does not establish clinical equivalence."] };
}
