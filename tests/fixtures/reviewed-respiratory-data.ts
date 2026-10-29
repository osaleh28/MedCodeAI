import { emptySections, normalizeDocumentation } from "../../src/lib/clinical/input";

// Entirely invented data-eligibility regression. Deliberately includes wrong
// self-assigned MDM labels to ensure actual activities control the assessment.
const sections = {
  ...emptySections,
  hpi: "Entirely fictional hospitalist Admission H&P. An adult with COPD on maintenance inhalers has two days of cough, fever and wheezing. Oral antibiotics were not tolerated. Primary-care visit notes were reviewed to verify the recent outpatient course.",
  examination: "Temperature 38.2 C, pulse 101, blood pressure 128/76, respiratory rate 21, oxygen saturation 95% on room air. The patient speaks in full sentences without accessory muscle use. Wheezing and focal right-base crackles are present. No hypoxemia or organ failure is described.",
  laboratory: "Labs Reviewed:\nCBC shows WBC 13.8. BMP shows BUN 22 and creatinine 1.0. Lactate is normal at 1.2.",
  imaging: "I independently interpreted the chest radiograph obtained by the radiology department: focal right-base opacity without pleural effusion.",
  otherStudies: "I reviewed the outpatient pulmonologist's spirometry results to assess baseline airflow obstruction.",
  dataActivities: "I discussed this acute presentation by phone directly with the external pulmonologist regarding current treatment and the maintenance inhaler regimen.",
  assessmentPlan: "Community-acquired pneumonia with fever and a nonsevere COPD exacerbation are addressed. Admit for inpatient treatment because oral therapy was not tolerated. Start IV antibiotics and prescription corticosteroid therapy with scheduled bronchodilators. Recheck BMP tomorrow. Embedded self-assessment: problems moderate; data moderate; CBC/BMP are one panel; external discussion is category 2; risk moderate. Total time spent: 60 minutes today.",
};
export const reviewedRespiratoryCase = {
  id: "admission-reviewed-data", noteType: "admission" as const, sections,
  note: normalizeDocumentation({ noteType: "admission", inputMode: "sections", fullNote: "", sections }),
  billingContext: { independentInterpretationEligible: true, externalDiscussionNotSeparatelyReported: true },
  expected: { code: "99223" },
};

const referenceOnlySections = {
  ...sections,
  imaging: "I reviewed the radiologist's chest radiograph report, which describes focal right-base opacity. I did not independently interpret images.",
  dataActivities: "A pulmonology consultation was requested, but no interactive discussion has occurred. No independent interpretation or independent historian was used for this encounter.",
};
export const referenceOnlyRespiratoryCase = {
  ...reviewedRespiratoryCase, id: "admission-reporting-confirmations-only", sections: referenceOnlySections,
  note: normalizeDocumentation({ noteType: "admission", inputMode: "sections", fullNote: "", sections: referenceOnlySections }),
  expected: { code: "99222" },
};
