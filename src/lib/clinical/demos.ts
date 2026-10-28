import { type ClinicalExtraction, type HpiResult } from "./contracts";
import { emptySections, normalizeDocumentation, type NoteType } from "./input";
import type { MdmLevel } from "./mdm";
import { worksheetCases } from "./worksheet-cases";

export type DemoCase = {
  id: string; title: string; noteType: NoteType; sections: typeof emptySections; note: string;
  extraction: ClinicalExtraction; hpi: HpiResult | null;
  learningFocus?: string;
  group?: "worksheet";
  expected: { problems: MdmLevel | null; data: MdmLevel | null; risk: MdmLevel | null; overall: MdmLevel | null; code: string | null; rationale: string };
};

const ground = (quote: string, explanation: string) => ({ evidence: [quote], uncertain: false, explanation });

function buildCase(type: NoteType, complexity: "lower" | "moderate" | "high"): DemoCase {
  const initial = type === "admission";
  const sections = { ...emptySections };
  let extraction: ClinicalExtraction;
  let expected: DemoCase["expected"];
  if (complexity === "lower") {
    const history = initial
      ? "Hospitalist Medicine - Initial H&P. Entirely fictional teaching encounter.\nReason for evaluation: reassess oral tolerance after observation placement for diarrhea.\nHPI: A fictional 42-year-old adult developed five nonbloody loose stools over the past day after a shared meal. There is no vomiting or abdominal pain. Oral intake improved during the preceding observation period, with two glasses of water tolerated. There has been no syncope or reduced urine output. Observation placement was decided by the referring clinician before this initial hospitalist evaluation; this note does not represent a new admission or escalation decision.\nRelevant ROS obtained: no fever or chest discomfort."
      : "Hospitalist Medicine - Daily Progress Note. Entirely fictional teaching encounter.\nReason for today's review: reassess diarrhea and oral tolerance during the ongoing observation stay.\nInterval history: Nursing reports one loose stool overnight compared with five during the preceding day. The patient ate breakfast and drank water without difficulty and reports less urgency. There is no vomiting or abdominal pain. No dizziness occurred when walking to the bathroom.\nRelevant ROS obtained from the patient: no fever or blood in the stool. This is a subsequent review, not discharge-day management.";
    if (initial) sections.medicalHistory = "No chronic condition requires assessment in this fictional encounter. No recent antibiotics or abdominal surgery are reported. No medication allergies are reported. No daily prescription medications are taken. A household contact had a similar brief illness.";
    sections[initial ? "hpi" : "intervalHistory"] = history;
    sections.examination = "Comfortable, alert, moist mucous membranes. Abdomen soft and nontender. BP 118/72, pulse 78, temperature 36.8 C.";
    const problem = "Acute uncomplicated gastroenteritis is stable and improving; I evaluated symptoms and hydration today.";
    const risk = "After reassessing oral intake, urine output, and the abdominal examination, I decided to continue oral fluids and a regular diet as tolerated without prescription therapy.";
    sections.assessmentPlan = `${problem}\n${risk}\nReassess oral tolerance later in the observation period; return precautions discussed for recurrent vomiting, bloody stools, or worsening pain. No new admission, escalation, or discharge-management decision is included in this encounter.`;
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
      ? "Hospitalist Medicine - Initial H&P. Entirely fictional teaching encounter.\nReason for evaluation: wheezing and exertional dyspnea after observation placement for a COPD exacerbation.\nHPI: A fictional 66-year-old adult with COPD reports three days of increased cough, wheezing, and breathlessness when walking across a room. Rescue inhaler use increased from occasional use to four times yesterday. Symptoms improved after initial inhaled treatment, but exertional breathlessness persists. The patient speaks comfortably at rest and reports no chest pain, hemoptysis, or confusion. Observation placement preceded this initial hospitalist evaluation; no new admission or escalation decision is made in this note.\nRelevant ROS obtained: no fever, vomiting, or leg swelling."
      : "Hospitalist Medicine - Daily Progress Note. Entirely fictional teaching encounter.\nReason for today's review: reassess exertional dyspnea and treatment response during a COPD exacerbation.\nInterval history: Nursing reports fewer rescue nebulizer requests overnight. The patient walked to the bathroom with less breathlessness than yesterday but still wheezes with activity. No supplemental oxygen was required overnight. Oral intake is normal. I reviewed inhaler use and symptoms with the patient.\nRelevant ROS obtained: no chest pain, fever, or hemoptysis. Hypertension and type 2 diabetes are also reassessed today for control and treatment tolerance. This is not discharge-day management.";
    sections.medicalHistory = initial ? "COPD treated with a daily maintenance inhaler and rescue albuterol; no home oxygen. Established hypertension on amlodipine 5 mg daily and type 2 diabetes on metformin 500 mg twice daily. The patient reports taking these medications without recent adverse effects. Former smoker. No reported medication allergies or relevant prior surgery. Family history is unavailable and is not supplied by this example." : "";
    sections.examination = "Alert, speaking full sentences, no accessory muscle use at rest. Mild bilateral expiratory wheeze without focal crackles. Regular heart rhythm, no peripheral edema. BP 124/76, pulse 82, temperature 36.9 C, respiratory rate 18, oxygen saturation 95% on room air.";
    sections.laboratory = "Synthetic results: CBC WBC 7.8 x10^9/L, hemoglobin 13.6 g/dL, platelets 240 x10^9/L. BMP sodium 138 mmol/L, potassium 4.0 mmol/L, creatinine 0.9 mg/dL, glucose 146 mg/dL.";
    sections.cardiac = "An EKG result is listed as sinus rhythm. The note does not document physician review or independent interpretation of this EKG.";
    sections.imaging = "Synthetic chest radiograph report: hyperinflation without focal air-space opacity, edema, or pleural effusion.";
    const hypertension = "Hypertension is stable at the treatment goal; I reviewed control and decided to continue amlodipine 5 mg daily.";
    const diabetes = "Type 2 diabetes is stable at the individualized goal; I reviewed control and decided to continue metformin 500 mg twice daily.";
    const copd = "COPD with an improving, nonsevere exacerbation: I reassessed wheezing, exertional limitation, and response to inhaled treatment. Symptoms remain above baseline without an organ-threatening presentation.";
    const prescription = initial
      ? "I decided to prescribe a short oral prednisone course and continue the maintenance inhaler and rescue bronchodilator after reviewing treatment response and potential adverse effects."
      : "Because oral intake is reliable and respiratory symptoms have improved, I decided to replace IV methylprednisolone with oral prednisone and continue the maintenance inhaler with rescue bronchodilator as needed.";
    sections.assessmentPlan = `${hypertension}\n${diabetes}\n${copd}\n${prescription}\nReassess exertional symptoms and glucose response tomorrow. Routine glucose checks assess treatment response; no intensive toxicity-monitoring decision or escalation of care is represented. Other historical diagnoses are not counted as addressed merely because they appear in a problem list.`;
    const cbc = "I reviewed the newly available CBC ordered by the referring clinician for this encounter; no leukocytosis or anemia changes today's plan.";
    const bmp = "I reviewed the newly available BMP ordered by the referring clinician for this encounter, including renal function and glucose relevant to medication decisions.";
    const xray = "I reviewed the chest radiograph report available for this encounter, without independent image interpretation, to assess for an alternative pulmonary process.";
    sections.dataActivities = `${cbc}\n${bmp}\n${xray}\nNo independent historian, independent test interpretation, or external management discussion was used.`;
    extraction = {
      summary: "An improving, nonsevere COPD exacerbation and two stable chronic illnesses are actively addressed. Prescription decisions and three unique report/panel reviews support moderate elements despite improving symptoms.",
      isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
      problems: [
        { ...ground(hypertension, "Stable chronic condition explicitly evaluated and managed."), label: "Hypertension", problemKey: "hypertension", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Continue amlodipine after reviewing control." },
        { ...ground(diabetes, "A second, distinct stable chronic condition is managed."), label: "Type 2 diabetes", problemKey: "type_2_diabetes", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Continue metformin after reviewing control." },
        { ...ground(copd, "An improving exacerbation remains above baseline; cough and wheeze are manifestations of this same problem, not extra diagnoses."), label: "COPD exacerbation", problemKey: "copd", course: "chronic", addressed: true, criterion: "chronic_flare", management: prescription },
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
    expected = { problems: "Moderate", data: "Moderate", risk: "Moderate", overall: "Moderate", code: initial ? "99222" : "99232", rationale: "An addressed nonsevere chronic flare (also two addressed stable chronic illnesses), three unique documented reviews, and prescription decisions each meet moderate criteria. Improving symptoms and oral transition do not automatically lower MDM. The listed EKG earns no activity credit; routine glucose checks do not establish high risk." };
  } else {
    sections[initial ? "hpi" : "intervalHistory"] = initial
      ? "Hospitalist Medicine - Initial H&P. Entirely fictional teaching encounter.\nReason for evaluation: rapidly worsening dyspnea, orthopnea, and increasing oxygen requirement.\nHPI: A fictional 71-year-old adult with chronic systolic heart failure reports two days of increasing ankle swelling and inability to lie flat, followed by marked breathlessness over the last six hours. The patient normally breathes comfortably without oxygen. Nursing reports an increase from 2 L to 4 L nasal oxygen during evaluation. The patient denies chest pain, fever, or productive cough. This is the first evaluation by this hospitalist team during the stay.\nHistory is obtained directly from the patient; no independent historian is used."
      : "Hospitalist Medicine - Daily Progress Note. Entirely fictional teaching encounter.\nReason for today's review: worsening oxygenation and congestion during treatment of acute decompensated systolic heart failure.\nInterval history: Nursing reports only 350 mL urine output since yesterday's evening diuretic and an increase from 2 L to 4 L nasal oxygen overnight. The patient reports worsening breathlessness at rest and needing to sit upright to sleep. Leg swelling has increased compared with yesterday.\nRelevant ROS obtained: no chest pain, fever, or productive cough. I reassessed the response to diuresis and current oxygen support today; admission severity is not simply carried forward.";
    if (initial) sections.medicalHistory = "Known ischemic cardiomyopathy with previously documented reduced ejection fraction, chronic systolic heart failure, and hypertension. Home medications include an oral loop diuretic and lisinopril. The patient reports taking these medications. Former smoker. No reported drug allergies. Family and surgical history are not available in this example; no additional history is inferred.";
    sections.examination = "Awake, speaking in short sentences, tachypneic with accessory muscle use. Bilateral crackles, elevated jugular venous pressure, and symmetric pitting ankle edema. Respiratory rate 30, pulse 108, BP 154/88, temperature 36.8 C, oxygen saturation 89% on 4 L nasal oxygen.";
    sections.laboratory = "Entirely synthetic results: CBC WBC 10.2 x10^9/L, hemoglobin 12.4 g/dL, platelets 218 x10^9/L. BMP sodium 136 mmol/L, potassium 4.2 mmol/L, bicarbonate 24 mmol/L, BUN 32 mg/dL, creatinine 1.7 mg/dL (previously documented baseline 1.4). The creatinine change is considered in the treatment decision; a separate kidney diagnosis is not established in this example.";
    sections.cardiac = "Synthetic EKG report: sinus tachycardia without new ST elevation. This result is listed only; no physician review or independent interpretation is represented.";
    sections.imaging = "Synthetic chest radiograph report: bilateral interstitial edema and small pleural effusions.";
    const problem = "Acute decompensated systolic heart failure with worsening hypoxemic respiratory failure poses an immediate threat to respiratory organ function; I assessed oxygenation, respiratory effort, congestion, and the inadequate response to treatment.";
    const risk = initial
      ? "Because current oxygen support is inadequate and respiratory status is worsening, I decided to admit the patient to a monitored step-down hospital bed for increased respiratory support and close reassessment."
      : "Because oxygen needs increased and current ward support is inadequate, I decided to escalate hospital-level care from the ward to a monitored step-down bed for increased respiratory support and close reassessment.";
    const diuretic = initial ? "initiate IV loop diuretic treatment" : "intensify IV loop diuretic treatment after reviewing the inadequate response to the prior dose";
    sections.assessmentPlan = `${problem}\n${risk}\nI decided to ${diuretic} and reassess urine output, oxygenation, renal function, and electrolytes. These routine response checks are not claimed as intensive monitoring for drug toxicity.\nThis fictional note assumes an initial or subsequent hospital E/M service as selected, without a distinct separately documented critical-care service, consultation, or discharge service.`;
    const cbc = "I reviewed the newly available CBC ordered by another clinician today, including the white count and hemoglobin relevant to alternative causes of dyspnea.";
    const bmp = "I reviewed the newly available BMP ordered by another clinician today to assess renal function and electrolytes before adjusting diuretic treatment.";
    const xray = "I reviewed the chest radiograph report today to assess congestion; this is report review, not independent image interpretation.";
    sections.dataActivities = `${cbc}\n${bmp}\n${xray}\nNo independent test interpretation, independent historian, or external management discussion is documented for this encounter.`;
    extraction = {
      summary: "A documented organ-threatening problem and an actual decision to escalate hospital-level care establish high problems and management risk.",
      isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
      problems: [{ ...ground(problem, "The documented respiratory organ threat is supported by current findings and active management. Heart failure and its respiratory manifestation are grouped here rather than added as diagnosis points."), label: "Decompensated heart failure with hypoxemic respiratory failure", problemKey: "heart_failure_respiratory_threat", course: "acute", addressed: true, criterion: "organ_threat", management: "Escalate respiratory support and hospital care, initiate IV diuresis, and reassess response." }],
      data: [
        { ...ground(cbc, "One CBC panel review."), label: "CBC review", kind: "laboratory", activity: "review", uniqueKey: "cbc", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(bmp, "One BMP panel review."), label: "BMP review", kind: "laboratory", activity: "review", uniqueKey: "bmp", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(xray, "Report review, not independent interpretation."), label: "Chest radiograph report", kind: "imaging", activity: "review", uniqueKey: "chest_radiograph", qualifies: true, separatelyReported: false, performedByOther: null },
        { ...ground(sections.cardiac, "Listed EKG findings do not establish physician activity."), label: "Listed EKG report", kind: "cardiac", activity: "result_only", uniqueKey: "ecg", qualifies: false, separatelyReported: null, performedByOther: null },
      ],
      risks: [{ ...ground(risk, "The actual admission or escalation decision supplies high management risk; the bed name and IV medication alone do not."), decision: initial ? "Admit for increased hospital-level support" : "Escalate ward care to step-down", criterion: "admission_or_escalation_decision" }],
      gaps: [{ question: "Does this fictional encounter remain within the selected hospital E/M family, without a distinct critical-care service?", educationalExplanation: "A separately documented critical-care service requires assessment under a different family. The assumption here is hospital E/M, not a decision that critical care should or should not be performed.", evidence: [sections.assessmentPlan.split("\n")[3]], uncertain: true }], uncertainties: [],
    };
    expected = { problems: "High", data: "Moderate", risk: "High", overall: "High", code: initial ? "99223" : "99233", rationale: "The documented respiratory organ threat and actual admission/escalation decision satisfy two high elements. Three unique report/panel reviews support moderate data. IV diuresis, a listed EKG, a diagnosis count, or hospital location alone do not establish high MDM." };
  }
  const note = normalizeDocumentation({ noteType: type, inputMode: "sections", fullNote: "", sections });
  const hpi: HpiResult | null = initial ? {
    status: "available", originalHpi: sections.hpi,
    sentences: [{ text: sections.hpi, sourceQuotes: [sections.hpi] }], suggestedHpi: sections.hpi,
    clarificationQuestions: ["Is the documented symptom timeline accurate and complete for this fictional encounter?"],
    warnings: ["This prepared example preserves an already clear HPI. Review it against the original; wording does not alter MDM."],
  } : null;
  const topic = complexity === "lower" ? "improving gastroenteritis" : complexity === "moderate" ? "COPD exacerbation and chronic disease review" : "decompensated heart failure with respiratory compromise";
  return { id: `${type}-${complexity}`, title: `${initial ? "Admission H&P" : "Progress Note"} — ${complexity === "lower" ? "lower" : complexity} complexity: ${topic}`, learningFocus: expected.rationale, noteType: type, sections, note, extraction, hpi, expected };
}

// Explicit expected values are checked by independent rule tests, not derived
// from the label or generated by the model.
export const demoCases: DemoCase[] = [
  ...(["admission", "progress"] as const).flatMap((type) => (["lower", "moderate", "high"] as const).map((level) => buildCase(type, level))),
  ...worksheetCases,
];

export function resolvePreparedCase(id: string | null, note: string, noteType: NoteType) {
  return demoCases.find((sample) => sample.id === id && sample.noteType === noteType && sample.note === note) ?? null;
}
