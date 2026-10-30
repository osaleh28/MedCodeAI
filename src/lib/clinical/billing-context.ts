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
  independentInterpretationEligible: "I personally interpreted tests performed by someone else, and I am not billing separately for those interpretations.",
  externalDiscussionNotSeparatelyReported: "I had direct discussions about care or test findings with an outside clinician, and I am not billing separately for those discussions.",
};

export const billingContextHelp: Record<keyof BillingContext, string> = {
  independentInterpretationEligible: "For example, you looked at the actual chest X-ray images or ECG tracing and made your own interpretation. Reading the radiologist's report alone is different.",
  externalDiscussionNotSeparatelyReported: "For example, you spoke directly with a cardiologist from another group or specialty about treatment or test findings. The clinician can work in the same hospital. Requesting a consult alone is different.",
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
    const explicitStatement = item.evidence.some((quote) => /\b(?:not separately (?:reported|billed)|I am not billing separately)\b/i.test(quote));
    if (item.separatelyReported === false && !confirmed && !explicitStatement) return { ...item, separatelyReported: null };
    return item;
  }) };
}
