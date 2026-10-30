import { billingContextHelp, billingContextLabels } from "@/lib/clinical/billing-context";

export function DataDocumentationLesson() {
  return <div className="mt-4">
    <p>For admission and progress notes, make your own test interpretations and direct discussions clear in the assessment/plan or MDM section. HPI improvement organizes the symptom history already documented.</p>
    <p className="field-help mt-3">The statements below illustrate work to describe only when it actually occurred. Include the specific findings, discussion, and effect on your decisions.</p>
    <div className="learning-guide-grid">
      <article><h3>Your own test interpretation</h3><p>{billingContextLabels.independentInterpretationEligible}</p><p className="field-help mt-3">{billingContextHelp.independentInterpretationEligible}</p></article>
      <article><h3>Direct discussion with an outside clinician</h3><p>{billingContextLabels.externalDiscussionNotSeparatelyReported}</p><p className="field-help mt-3">{billingContextHelp.externalDiscussionNotSeparatelyReported}</p></article>
    </div>
    <p className="field-help mt-4">These activities can contribute to separate categories within data reviewed and analyzed when the requirements are met. Separate billing refers to your own service. The other clinician may bill for their work. Actual activity, relevant documentation, and reporting eligibility must be established; example wording alone does not establish a code.</p>
  </div>;
}
