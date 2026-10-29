import type { ClinicalExtraction } from "../../src/lib/clinical/contracts";
import { emptySections, normalizeDocumentation } from "../../src/lib/clinical/input";

// Entirely invented regression fixture. Never use the supplied real-case note
// or identifying reference documents for automated/provider tests.
const sections = {
  ...emptySections,
  hpi: "Entirely fictional initial hospitalist evaluation. HPI: A fictional adult has three days of cough, fever, and reduced oral intake. No respiratory distress or organ failure is documented.",
  assessmentPlan: "Pneumonia with systemic symptoms and dehydration is addressed today. I decided to admit the patient for inpatient treatment after assessing inability to maintain oral intake. I will start prescription antibiotic therapy. We will send urine Legionella antigen. We will order urinalysis. I have ordered a standalone TSH assay. These diagnostic services are not separately reported by this E/M clinician. No independent test interpretation, independent historian, external-record review, or external discussion is performed for this encounter.",
};
const note = normalizeDocumentation({ noteType: "admission", inputMode: "sections", fullNote: "", sections });
const finding = (quote: string) => ({ evidence: [quote], uncertain: false, explanation: "Explicit fictional source statement." });
const extraction: ClinicalExtraction = {
  summary: "Fictional pneumonia encounter with three explicitly ordered laboratory studies.",
  isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
  problems: [{ ...finding("Pneumonia with systemic symptoms and dehydration is addressed today."), label: "Pneumonia", problemKey: "pneumonia", course: "acute", addressed: true, criterion: "systemic_acute", management: "Inpatient treatment and antibiotics." }],
  risks: [{ ...finding("I decided to admit the patient for inpatient treatment after assessing inability to maintain oral intake."), decision: "Decision for inpatient admission", criterion: "admission_or_escalation_decision" }],
  data: [
    ["Urine Legionella antigen", "legionella_urine_antigen", "We will send urine Legionella antigen."],
    ["Urinalysis", "urinalysis", "We will order urinalysis."],
    ["Standalone TSH", "thyroid_stimulating_hormone", "I have ordered a standalone TSH assay."],
  ].map(([label, uniqueKey, quote]) => ({ ...finding(quote), label, uniqueKey, kind: "laboratory", activity: "order", qualifies: true, separatelyReported: false, performedByOther: null })),
  gaps: [], uncertainties: [],
};

export const infectionOrdersCase = { id: "admission-orders", noteType: "admission" as const, note, sections, extraction, expected: { code: "99222" } };
