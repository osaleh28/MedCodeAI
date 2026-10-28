import { type ClinicalExtraction, type HpiResult } from "./contracts";
import { emptySections, normalizeDocumentation, type NoteType } from "./input";
import type { MdmLevel } from "./mdm";

type DemoCase = {
  id: string; title: string; noteType: NoteType; sections: typeof emptySections; note: string;
  extraction: ClinicalExtraction; hpi: HpiResult | null;
  expected: { problems: MdmLevel; data: MdmLevel; risk: MdmLevel; overall: MdmLevel; code: string; rationale: string };
};

const ground = (quote: string, explanation: string) => ({ evidence: [quote], uncertain: false, explanation });

function buildCase(type: NoteType, complexity: "lower" | "moderate" | "high"): DemoCase {
  const initial = type === "admission";
  const sections = { ...emptySections };
  let extraction: ClinicalExtraction;
  let expected: DemoCase["expected"];
  if (complexity === "lower") {
    const history = initial
      ? "A fictional adult developed nonbloody diarrhea yesterday after a shared meal. There is no vomiting or abdominal pain. Oral intake is improving. Observation placement occurred before this initial hospitalist evaluation."
      : "The fictional adult reports fewer loose stools and normal oral intake today. There is no vomiting or abdominal pain.";
    sections[initial ? "hpi" : "intervalHistory"] = history;
    sections.examination = "Comfortable, alert, moist mucous membranes. Abdomen soft and nontender. BP 118/72, pulse 78, temperature 36.8 C.";
    const problem = "Acute uncomplicated gastroenteritis is stable and improving; I evaluated symptoms and hydration today.";
    const risk = "Continue oral fluids and a regular diet as tolerated. This supportive management has low risk. No prescription medication changes or escalation decisions were made.";
    sections.assessmentPlan = `${problem}\n${risk}`;
    sections.dataActivities = "No diagnostic tests were ordered or reviewed, no external records were reviewed, and no independent historian or external clinician discussion was used for this encounter.";
    extraction = {
      summary: "Fictional stable, uncomplicated illness with supportive management and explicitly no diagnostic data activities.",
      isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
      problems: [{ ...ground(problem, "An acute uncomplicated condition is explicitly evaluated."), label: "Gastroenteritis", problemKey: "gastroenteritis", course: "acute", addressed: true, criterion: "uncomplicated_acute", management: "Hydration assessment and supportive care." }],
      data: [], risks: [{ ...ground(risk, "A low-risk supportive management decision is documented."), decision: "Continue oral hydration", criterion: "low_management" }],
      gaps: [{ question: "Were there other activities actually performed that are not reflected in this fictional note?", educationalExplanation: "Only documented work is evaluated; this question is not a suggestion to add work that did not occur.", evidence: [], uncertain: true }], uncertainties: [],
    };
    expected = { problems: "Low", data: "Straightforward", risk: "Low", overall: "Low", code: initial ? "99221" : "99231", rationale: "A documented uncomplicated acute problem and low-risk management establish two low elements; data is minimal. Observation placement alone is not credited as an admission decision." };
  } else if (complexity === "moderate") {
    sections[initial ? "hpi" : "intervalHistory"] = initial
      ? "A fictional adult is evaluated after hospital observation placement for improving cough. There is no dyspnea at rest. The clinician also evaluates established hypertension and type 2 diabetes today."
      : "The fictional adult reports an improving cough and no dyspnea at rest. Established hypertension and type 2 diabetes are reassessed today.";
    sections.medicalHistory = initial ? "Established hypertension and type 2 diabetes." : "";
    sections.examination = "Alert and comfortable. Lungs clear. BP 124/76, pulse 82, respiratory rate 16, oxygen saturation 97% on room air.";
    sections.laboratory = "Synthetic results: CBC WBC 7.8 x10^9/L, hemoglobin 13.6 g/dL, platelets 240 x10^9/L. BMP sodium 138 mmol/L, potassium 4.0 mmol/L, creatinine 0.9 mg/dL, glucose 146 mg/dL.";
    sections.cardiac = "An EKG result is listed as sinus rhythm. The note does not document physician review or independent interpretation of this EKG.";
    sections.imaging = "Synthetic chest radiograph report: no focal air-space opacity.";
    const hypertension = "Hypertension is stable at the treatment goal; I reviewed control and decided to continue amlodipine 5 mg daily.";
    const diabetes = "Type 2 diabetes is stable at the individualized goal; I reviewed control and decided to continue metformin 500 mg twice daily.";
    sections.assessmentPlan = `${hypertension}\n${diabetes}\nImproving uncomplicated cough: continue supportive care.`;
    const cbc = "I reviewed the CBC results for this encounter.";
    const bmp = "I reviewed the BMP results for this encounter.";
    const xray = "I reviewed the chest radiograph report for this encounter, without independent image interpretation.";
    sections.dataActivities = `${cbc}\n${bmp}\n${xray}\nNo independent historian, independent test interpretation, or external management discussion was used.`;
    extraction = {
      summary: "Two distinct stable chronic illnesses are addressed with prescription decisions and three documented unique test reviews.",
      isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
      problems: [
        { ...ground(hypertension, "Stable chronic condition explicitly evaluated and managed."), label: "Hypertension", problemKey: "hypertension", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Continue amlodipine after reviewing control." },
        { ...ground(diabetes, "A second, distinct stable chronic condition is managed."), label: "Type 2 diabetes", problemKey: "type_2_diabetes", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Continue metformin after reviewing control." },
        { ...ground("Improving uncomplicated cough: continue supportive care.", "An uncomplicated symptom is addressed."), label: "Cough", problemKey: "cough", course: "acute", addressed: true, criterion: "uncomplicated_acute", management: "Supportive care." },
      ],
      data: [
        { ...ground(cbc, "CBC is one panel, not one test per value."), label: "CBC review", kind: "laboratory", activity: "review", uniqueKey: "cbc", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(bmp, "BMP is one panel."), label: "BMP review", kind: "laboratory", activity: "review", uniqueKey: "bmp", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(xray, "Report review is distinct from independent interpretation."), label: "Chest radiograph report", kind: "imaging", activity: "review", uniqueKey: "chest_radiograph", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(sections.cardiac, "No EKG activity credit is supported."), label: "Listed EKG result", kind: "cardiac", activity: "result_only", uniqueKey: "ecg", qualifies: false, separatelyReported: null, performedByOther: null },
      ],
      risks: [{ ...ground(hypertension, "An explicit prescription continuation decision is documented; this is not just a medication list."), decision: "Continue prescription therapy after assessment", criterion: "prescription_decision" }],
      gaps: [{ question: "Was any EKG review or interpretation actually performed by the reporting clinician?", educationalExplanation: "A listed result does not establish physician review or a qualifying independent interpretation.", evidence: [sections.cardiac], uncertain: true }], uncertainties: [],
    };
    expected = { problems: "Moderate", data: "Moderate", risk: "Moderate", overall: "Moderate", code: initial ? "99222" : "99232", rationale: "Two stable chronic illnesses, three unique documented test reviews, and explicit prescription management each meet a moderate element. EKG listing earns no activity credit." };
  } else {
    sections[initial ? "hpi" : "intervalHistory"] = initial
      ? "A fictional adult has rapidly worsening shortness of breath over 6 hours and is evaluated for the first time by this hospitalist team after arrival to the observation unit. Oxygen requirements are increasing."
      : "The fictional adult has worsening shortness of breath since the prior hospital evaluation. Oxygen requirements increased over the last 2 hours.";
    sections.examination = "Respiratory distress with accessory muscle use. Respiratory rate 32, pulse 118, BP 102/64, oxygen saturation 84% despite supplemental oxygen.";
    sections.laboratory = "Synthetic CBC: WBC 16.2 x10^9/L, hemoglobin 12.4 g/dL. BMP: sodium 136 mmol/L, potassium 4.2 mmol/L, creatinine 1.1 mg/dL.";
    sections.imaging = "Synthetic chest radiograph report: extensive bilateral air-space opacities.";
    const problem = "Acute hypoxemic respiratory failure is worsening and poses an immediate threat to respiratory organ function; I evaluated oxygenation and respiratory effort and directed escalation of treatment.";
    const risk = "I decided to escalate hospital-level care by transferring the patient to the ICU for advanced respiratory support because current support is inadequate.";
    sections.assessmentPlan = `${problem}\n${risk}\nThis fictional note represents a hospital E/M service; no separately documented critical-care service or discharge service is included.`;
    const cbc = "I reviewed the CBC results today.";
    const bmp = "I reviewed the BMP results today.";
    const xray = "I reviewed the chest radiograph report today.";
    sections.dataActivities = `${cbc}\n${bmp}\n${xray}\nNo independent test interpretation, independent historian, or external management discussion is documented for this encounter.`;
    extraction = {
      summary: "A documented organ-threatening problem and an actual decision to escalate hospital-level care establish high problems and management risk.",
      isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
      problems: [{ ...ground(problem, "The clinician explicitly documents and manages an organ threat, with supporting respiratory findings."), label: "Acute hypoxemic respiratory failure", problemKey: "respiratory_failure", course: "acute", addressed: true, criterion: "organ_threat", management: "Escalation of respiratory treatment and level of care." }],
      data: [
        { ...ground(cbc, "One CBC panel review."), label: "CBC review", kind: "laboratory", activity: "review", uniqueKey: "cbc", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(bmp, "One BMP panel review."), label: "BMP review", kind: "laboratory", activity: "review", uniqueKey: "bmp", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(xray, "Report review, not independent interpretation."), label: "Chest radiograph report", kind: "imaging", activity: "review", uniqueKey: "chest_radiograph", qualifies: true, separatelyReported: false, performedByOther: null },
      ],
      risks: [{ ...ground(risk, "The actual escalation decision, not ICU status alone, supports the risk category."), decision: "Escalate hospital care to ICU", criterion: "admission_or_escalation_decision" }],
      gaps: [{ question: "Was a distinct critical-care service actually performed and separately documented?", educationalExplanation: "If so, a different code family may be appropriate; this example assumes an in-scope hospital E/M service only.", evidence: [sections.assessmentPlan.split("\n")[2]], uncertain: true }], uncertainties: [],
    };
    expected = { problems: "High", data: "Moderate", risk: "High", overall: "High", code: initial ? "99223" : "99233", rationale: "High problems and high management risk satisfy two elements despite only moderate data. The case does not equate ICU location or abnormal values with high risk." };
  }
  const note = normalizeDocumentation({ noteType: type, inputMode: "sections", fullNote: "", sections });
  const hpi: HpiResult | null = initial ? {
    status: "available", originalHpi: sections.hpi,
    sentences: [{ text: sections.hpi, sourceQuotes: [sections.hpi] }], suggestedHpi: sections.hpi,
    clarificationQuestions: ["Is the documented symptom timeline accurate and complete for this fictional encounter?"],
    warnings: ["This prepared example preserves an already clear HPI. Review it against the original; wording does not alter MDM."],
  } : null;
  return { id: `${type}-${complexity}`, title: `${initial ? "Admission H&P" : "Progress Note"} — ${complexity === "lower" ? "lower-complexity" : `${complexity}-complexity`} example`, noteType: type, sections, note, extraction, hpi, expected };
}

// Explicit expected values are checked by independent rule tests, not derived
// from the label or generated by the model.
export const demoCases: DemoCase[] = (["admission", "progress"] as const).flatMap((type) => (["lower", "moderate", "high"] as const).map((level) => buildCase(type, level)));

export function resolvePreparedCase(id: string | null, note: string, noteType: NoteType) {
  return demoCases.find((sample) => sample.id === id && sample.noteType === noteType && sample.note === note) ?? null;
}
