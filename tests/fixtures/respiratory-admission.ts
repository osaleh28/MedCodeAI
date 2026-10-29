import type { ClinicalExtraction } from "../../src/lib/clinical/contracts";
import { emptySections, normalizeDocumentation } from "../../src/lib/clinical/input";

// Invented regression case with no identifying details. Severity and the
// admission plan are described clinically, without named respiratory failure,
// an explicit "life threatening" phrase, or "I decided to admit" boilerplate.
const sections = {
  ...emptySections,
  hpi: "Hospitalist Medicine Admission H&P. Entirely fictional teaching note. An adult presents from home with worsening cough, fever and poor intake despite outpatient antibiotics. There is no home oxygen requirement. Breathlessness now occurs at rest. No separately reported critical-care service is described.",
  examination: "Before treatment, temperature 39.2 C, pulse 148 with atrial fibrillation, respiratory rate 31, and oxygen saturation 82% on room air. Examination shows increased work of breathing and accessory muscle use. Oxygen saturation improves to 95% at rest on 3 L nasal oxygen but falls to 81% during conversation. Supplemental oxygen remains necessary.",
  dataActivities: "We will order a CBC, BMP, and chest radiograph. These diagnostic services are not separately reported by this clinician. No independent interpretation, external discussion, independent historian or external-record review is performed in this encounter.",
  assessmentPlan: "Sepsis due to pneumonia with respiratory compromise is addressed today. We will provide IV antibiotics, supplemental oxygen and IV hydration. Atrial fibrillation with rapid ventricular response improved after oral rate-control treatment; we will continue prescription rate control and telemetry. Hospital medicine inpatient care is required for these treatments and monitoring because outpatient treatment has failed and the patient cannot maintain oxygenation without support. Home discharge will follow improvement in breathing, oxygen requirement and oral intake.",
};
const note = normalizeDocumentation({ noteType: "admission", inputMode: "sections", fullNote: "", sections });
const finding = (evidence: string[]) => ({ evidence, uncertain: false, explanation: "Fictional clinical evidence supports this interpretation." });
const extraction: ClinicalExtraction = {
  summary: "Fictional pneumonia/sepsis admission with acute respiratory compromise and inpatient treatment plan.",
  isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
  problems: [{ ...finding([sections.examination, "Sepsis due to pneumonia with respiratory compromise is addressed today."]), label: "Pneumonia/sepsis with respiratory compromise", problemKey: "pneumonia", course: "acute", addressed: true, criterion: "organ_threat", management: "Oxygen, IV antibiotics, inpatient treatment and monitoring." }],
  risks: [{ ...finding(["Hospital medicine inpatient care is required for these treatments and monitoring because outpatient treatment has failed and the patient cannot maintain oxygenation without support.", "Home discharge will follow improvement in breathing, oxygen requirement and oral intake."]), decision: "Hospitalization for inpatient treatment", criterion: "admission_or_escalation_decision" }],
  data: ["blood_count", "metabolic_panel", "chest_radiograph"].map((uniqueKey) => ({ ...finding(["We will order a CBC, BMP, and chest radiograph."]), label: uniqueKey, uniqueKey, kind: uniqueKey === "chest_radiograph" ? "imaging" : "laboratory", activity: "order", qualifies: true, separatelyReported: false, performedByOther: null })),
  gaps: [], uncertainties: [],
};
export const respiratoryAdmissionCase = { id: "admission-respiratory-context", noteType: "admission" as const, note, sections, extraction, expected: { code: "99223" } };
