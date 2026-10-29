import { z } from "zod";
import type { ClinicalExtraction } from "./contracts";

export const emptyBillingContext = {
  independentInterpretationEligible: false,
  externalDiscussionNotSeparatelyReported: false,
};
export const billingContextSchema = z.object({
  independentInterpretationEligible: z.boolean(),
  externalDiscussionNotSeparatelyReported: z.boolean(),
}).strict();
export type BillingContext = z.infer<typeof billingContextSchema>;

export const billingContextLabels: Record<keyof BillingContext, string> = {
  independentInterpretationEligible: "For independent interpretations documented in this note, the test was performed by another professional and I am not separately billing its interpretation.",
  externalDiscussionNotSeparatelyReported: "For qualifying external clinical discussions documented in this note, I am not separately billing the discussion.",
};

export function billingContextInstructions(context: BillingContext) {
  return `REPORTING CONTEXT (user confirmations, not additional clinical work):
Independent interpretation: ${context.independentInterpretationEligible ? "The user confirms tests independently interpreted in this note were performed by another professional and their interpretation is NOT separately reported by this E/M clinician. For a documented actual independent interpretation, performedByOther=true and separatelyReported=false." : "No supplemental confirmation. Use the note; retain null for genuinely unconfirmed performer/separate reporting."}
External discussion: ${context.externalDiscussionNotSeparatelyReported ? "The user confirms actual qualifying external discussions documented in this note are NOT separately reported by this E/M clinician; separatelyReported=false for those discussions." : "No supplemental confirmation. Use the note; retain null for genuinely unconfirmed separate reporting."}
These confirmations do not establish that an interpretation/discussion occurred or that it qualifies. Actual activity, relevance and original source evidence are still required. Do not convert report review to independent interpretation, referral to an actual discussion, or unsupported findings to definite ones. Separate reporting refers to THIS E/M clinician, not another clinician billing their own services. Do not quote this context as though it were part of the clinical note.`;
}

// Reporting metadata is not a clinical inference. A model's false value alone
// cannot establish that the E/M clinician did not separately bill an activity.
// This narrow explicit-phrase check does not classify illness or choose a code.
export function verifyReportingContext(extraction: ClinicalExtraction, context: BillingContext): ClinicalExtraction {
  return { ...extraction, data: extraction.data.map((item) => {
    const confirmed = item.activity === "independent_interpretation" ? context.independentInterpretationEligible
      : item.activity === "external_discussion" ? context.externalDiscussionNotSeparatelyReported : true;
    const explicitStatement = item.evidence.some((quote) => /\bnot separately (?:reported|billed)\b/i.test(quote));
    if (item.separatelyReported === false && !confirmed && !explicitStatement) return { ...item, separatelyReported: null };
    return item;
  }) };
}
