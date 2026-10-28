import type { ClinicalExtraction } from "./contracts";
import type { NoteType } from "./input";

// Educational phrase prompts only. These never classify a problem, award data
// credit, change completeness flags, or select a billing level.
const prompts = [
  {
    pattern: /\b(?:pt\.?|patient)\s+(?:is\s+)?stable\b|\bnothing\s+(?:happened\s+)?overnight\b|\bno\s+(?:acute\s+)?(?:overnight\s+events|events\s+overnight)\b|\bfeels?\s+(?:great|fine)\b/i,
    question: "If not explained elsewhere, what problem was assessed today, what changed over the interval, and what findings support the current status?",
    educationalExplanation: "General reassurance or an uneventful night can be accurate, but alone does not describe today's evaluation. A stable or improving patient does not automatically establish a particular MDM level.",
  },
  {
    pattern: /\bcont(?:inue)?\.?\s+(?:POC|plan\s+of\s+care|current\s+(?:care|plan|management))\b/i,
    question: "If not explained elsewhere, which treatments did you evaluate and decide to continue today, and what findings or reasoning supported that decision?",
    educationalExplanation: "An unchanged treatment can reflect an active decision. Clarify the work actually performed; changing treatment is not required for a problem to be addressed.",
  },
  {
    pattern: /\bper\s+(?:cards|cardiology|CCM|pulmonary|consultant)\b/i,
    question: "If not explained elsewhere, what assessment, treatment decision, or care coordination did you personally perform for the condition managed with the consultant?",
    educationalExplanation: "Attributing care to a consultant alone does not establish your work. A consultant reference also does not prove a qualifying interactive external discussion.",
  },
] as const;

export function addProgressClarifications(extraction: ClinicalExtraction, note: string, noteType: NoteType): ClinicalExtraction {
  if (noteType !== "progress") return extraction;
  const additions = prompts.flatMap((prompt) => {
    const match = note.match(prompt.pattern);
    if (!match || extraction.gaps.some((gap) => gap.question === prompt.question)) return [];
    return [{ question: prompt.question, educationalExplanation: prompt.educationalExplanation, evidence: [match[0]], uncertain: true }];
  });
  return { ...extraction, gaps: [...extraction.gaps, ...additions] };
}
