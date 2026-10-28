import type { ClinicalExtraction, HpiResult } from "./contracts";
import type { DemoCase } from "./demos";
import { emptySections, normalizeDocumentation, type NoteType } from "./input";

// Original fictional cases inspired by the supplied legacy worksheet's topics.
// Outcomes are based on the current public hospital MDM framework, not the
// worksheet's diagnosis/data point totals or a diagnosis-to-risk lookup table.
const evidence = (quote: string, explanation: string) => ({ evidence: [quote], uncertain: false, explanation });
const baseExtraction = (): ClinicalExtraction => ({
  summary: "", isClinicalNote: true, encounterConcerns: [], problemsComplete: true, dataComplete: true, riskComplete: true,
  problems: [], data: [], risks: [], gaps: [], uncertainties: [],
});

function twoTestReview(extraction: ClinicalExtraction, sections: typeof emptySections) {
  sections.laboratory = "Entirely synthetic results: CBC WBC 7.5 x10^9/L, hemoglobin 13.2 g/dL, platelets 228 x10^9/L; BMP sodium 138 mmol/L, potassium 4.1 mmol/L, creatinine 0.9 mg/dL.";
  const cbc = "I reviewed the newly available CBC ordered by another clinician for today's encounter.";
  const bmp = "I reviewed the newly available BMP ordered by another clinician for today's encounter.";
  sections.dataActivities = `${cbc}\n${bmp}\nNo other qualifying tests, external records, independent historians, independent interpretations, or external discussions were used today.`;
  extraction.data = [
    { ...evidence(cbc, "One CBC panel review; individual values are not separate tests."), label: "CBC review", kind: "laboratory", activity: "review", uniqueKey: "cbc", qualifies: true, separatelyReported: false, performedByOther: null },
    { ...evidence(bmp, "One BMP panel review."), label: "BMP review", kind: "laboratory", activity: "review", uniqueKey: "bmp", qualifies: true, separatelyReported: false, performedByOther: null },
  ];
}

function complete(id: string, title: string, noteType: NoteType, learningFocus: string, sections: typeof emptySections, extraction: ClinicalExtraction, expected: DemoCase["expected"]): DemoCase {
  const note = normalizeDocumentation({ noteType, inputMode: "sections", fullNote: "", sections });
  const hpi: HpiResult | null = noteType === "admission" ? {
    status: "available", originalHpi: sections.hpi, sentences: [{ text: sections.hpi, sourceQuotes: [sections.hpi] }], suggestedHpi: sections.hpi,
    clarificationQuestions: ["Is any part of this fictional symptom timeline unclear or incomplete?"],
    warnings: ["This prepared wording preserves the source HPI. It does not alter the coding assessment."],
  } : null;
  return { id, title, noteType, learningFocus, group: "worksheet", sections, note, extraction, expected, hpi };
}

function stableConditions() {
  const sections = { ...emptySections }, extraction = baseExtraction();
  sections.intervalHistory = "A fictional hospital patient reports no new symptoms. Hypertension and type 2 diabetes are both reassessed during this subsequent encounter.";
  sections.examination = "Comfortable and alert. BP 126/74, pulse 76. No new examination concerns.";
  const hypertension = "Hypertension remains at the individualized treatment goal; I assessed blood pressure control and medication tolerance and decided to continue amlodipine.";
  const diabetes = "Type 2 diabetes remains at the individualized treatment goal; I assessed glucose control and medication safety and decided to continue metformin.";
  sections.assessmentPlan = `${hypertension}\n${diabetes}`;
  twoTestReview(extraction, sections);
  extraction.summary = "Two stable chronic conditions are actively managed with two qualifying panel reviews and documented prescription decisions.";
  extraction.problems = [
    { ...evidence(hypertension, "A distinct stable chronic illness is addressed."), label: "Hypertension", problemKey: "hypertension", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Continue prescription after assessing control and tolerance." },
    { ...evidence(diabetes, "A second distinct stable chronic illness is addressed."), label: "Type 2 diabetes", problemKey: "diabetes", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Continue prescription after assessing control and safety." },
  ];
  extraction.risks = [{ ...evidence(hypertension, "A prescription continuation decision follows an actual assessment."), decision: "Continue prescription therapy after evaluation", criterion: "prescription_decision" }];
  return complete("worksheet-stable-conditions", "Worksheet practice — two stable conditions, two tests", "progress", "Moderate problems + low data + moderate management risk can support moderate overall MDM.", sections, extraction,
    { problems: "Moderate", data: "Low", risk: "Moderate", overall: "Moderate", code: "99232", rationale: "Two addressed stable chronic conditions and prescription management establish two moderate elements. CBC and BMP supply two unique reviews, so data remains low." });
}

function nonsevereFlare() {
  const sections = { ...emptySections }, extraction = baseExtraction();
  sections.hpi = "A fictional adult with established asthma reports increased wheezing over 2 days. Breathing improves after initial inhaled treatment. There is no confusion, exhaustion, or dyspnea at rest.";
  sections.medicalHistory = "Established asthma; no other condition is evaluated in this example.";
  sections.examination = "Alert, speaking full sentences, mild expiratory wheeze. Respiratory rate 18; oxygen saturation 96% on room air.";
  const problem = "Asthma has an acute, nonsevere exacerbation; I evaluated the change from baseline and response to treatment. There is no documented threat to life or respiratory organ function.";
  const risk = "After assessing benefits and adverse effects, I decided to prescribe a short oral corticosteroid course and adjust the inhaled prescription regimen.";
  sections.assessmentPlan = `${problem}\n${risk}\nObservation placement preceded this evaluation; no new admission or escalation decision is represented here.`;
  twoTestReview(extraction, sections);
  extraction.summary = "An explicitly nonsevere chronic exacerbation is treated with prescription decisions; hospital location does not establish severe disease or high risk.";
  extraction.problems = [{ ...evidence(problem, "The clinician documents a nonsevere exacerbation of a chronic condition."), label: "Asthma exacerbation", problemKey: "asthma", course: "chronic", addressed: true, criterion: "chronic_flare", management: "Evaluate response and adjust prescription treatment." }];
  extraction.risks = [{ ...evidence(risk, "The actual prescribing decision supports the management category."), decision: "Adjust prescription treatment", criterion: "prescription_decision" }];
  return complete("worksheet-nonsevere-flare", "Worksheet practice — nonsevere asthma exacerbation", "admission", "A chronic flare is not automatically severe or high MDM; the documented clinical status and management decisions matter.", sections, extraction,
    { problems: "Moderate", data: "Low", risk: "Moderate", overall: "Moderate", code: "99222", rationale: "A nonsevere chronic exacerbation and prescription management meet two moderate elements. Two panel reviews remain low data; neither hospital status nor the word exacerbation establishes high MDM." });
}

function routineMonitoring() {
  const sections = { ...emptySections }, extraction = baseExtraction();
  sections.intervalHistory = "A fictional adult with chronic heart failure reports baseline exercise tolerance and no new edema. This condition is evaluated today.";
  sections.examination = "Comfortable. No peripheral edema or new respiratory findings. BP 118/70, pulse 74.";
  const problem = "Chronic heart failure is stable at the individualized treatment goal; I evaluated symptoms, volume status, and the response to the current regimen.";
  const risk = "After reviewing treatment response and tolerance, I decided to continue the prescribed oral diuretic regimen.";
  const purpose = "Today's panel review assesses general clinical status and treatment response; this encounter does not involve intensive laboratory monitoring for a serious drug toxicity.";
  sections.assessmentPlan = `${problem}\n${risk}\n${purpose}`;
  twoTestReview(extraction, sections);
  extraction.summary = "One stable chronic illness, two panel reviews, and prescription continuation; routine follow-up testing is not intensive toxicity monitoring.";
  extraction.problems = [{ ...evidence(problem, "One stable chronic condition is actually addressed."), label: "Stable chronic heart failure", problemKey: "heart_failure", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Assess response and continue treatment." }];
  extraction.risks = [{ ...evidence(risk, "Prescription management is present, but intensive toxicity monitoring is explicitly absent."), decision: "Continue assessed prescription regimen", criterion: "prescription_decision" }];
  return complete("worksheet-routine-monitoring", "Worksheet practice — routine monitoring is not intensive toxicity monitoring", "progress", "One moderate risk element does not make the entire encounter moderate or high.", sections, extraction,
    { problems: "Low", data: "Low", risk: "Moderate", overall: "Low", code: "99231", rationale: "Problems and data are both low, while prescription management is moderate. The two-of-three rule gives low overall MDM. Routine testing does not independently establish high management risk." });
}

function intensiveToxicity() {
  const sections = { ...emptySections }, extraction = baseExtraction();
  sections.hpi = "A fictional adult with a confirmed acute pulmonary embolism has worsening dyspnea and right ventricular dysfunction. The initial hospitalist evaluation addresses the documented cardiopulmonary threat and ongoing anticoagulation.";
  sections.examination = "Tachypneic and requiring supplemental oxygen. The clinician documents threatened cardiopulmonary function in the assessment.";
  const problem = "The acute pulmonary embolism threatens cardiopulmonary organ function; I evaluated the worsening respiratory status and right ventricular dysfunction and actively managed this problem.";
  const risk = "I managed the intravenous unfractionated heparin infusion and instituted laboratory monitoring every 6 hours to detect excessive anticoagulation and prevent potentially fatal bleeding; I reviewed the monitoring plan and adjusted the infusion in response to the measured aPTT.";
  sections.assessmentPlan = `${problem}\n${risk}\nThe monitoring specifically evaluates serious treatment toxicity, not only therapeutic response. This example assumes a qualifying initial hospital E/M service without a separately documented critical-care service.`;
  sections.laboratory = "Entirely synthetic aPTT results are reviewed during the infusion; the laboratory activity and its role are documented below.";
  const activity = "I reviewed today's aPTT result in managing heparin-related bleeding risk.";
  sections.dataActivities = `${activity}\nNo other qualifying data activities are documented.`;
  extraction.summary = "An organ-threatening problem and a documented intensive toxicity-monitoring decision establish two high elements; unfamiliar diagnostic identity remains unresolved.";
  extraction.problems = [{ ...evidence(problem, "Organ threat is explicitly assessed by the clinician rather than inferred from an isolated abnormal result."), label: "Acute pulmonary embolism with threatened cardiopulmonary function", problemKey: "pulmonary_embolism", course: "acute", addressed: true, criterion: "organ_threat", management: "Evaluate and actively manage cardiopulmonary threat." }];
  extraction.risks = [{ ...evidence(risk, "The agent, serious toxicity, laboratory monitoring schedule, and management response are all documented."), decision: "Manage heparin with intensive laboratory toxicity monitoring", criterion: "toxicity_monitoring" }];
  extraction.data = [{ ...evidence(activity, "Review is documented, but aPTT identity credit is outside this MVP's verified test catalog."), label: "aPTT review", kind: "laboratory", activity: "review", uniqueKey: "aptt", qualifies: true, separatelyReported: false, performedByOther: null }];
  extraction.uncertainties = ["The aPTT review is visible but receives no definite data credit in the limited MVP catalog. Its use as toxicity monitoring is evaluated separately under management risk."];
  return complete("worksheet-intensive-toxicity", "Worksheet practice — intensive heparin toxicity monitoring", "admission", "High-risk monitoring requires a documented serious toxicity and an actual monitoring/management plan. The medication name alone is insufficient.", sections, extraction,
    { problems: "High", data: null, risk: "High", overall: "High", code: "99223", rationale: "Explicit organ threat and intensive drug-toxicity monitoring establish two high elements. Unresolved aPTT test-identity credit does not change the conclusion because the other two elements are definitively high." });
}

function existingDnr() {
  const sections = { ...emptySections }, extraction = baseExtraction();
  sections.intervalHistory = "A fictional adult has an existing DNR order from a prior encounter. No resuscitation or treatment-limitation decision was made or revisited today. Hypertension is assessed at this subsequent visit.";
  sections.examination = "Comfortable, BP 124/72, pulse 72. No new symptoms.";
  const problem = "Hypertension is stable at the individualized goal; I evaluated control and medication tolerance.";
  const risk = "After evaluating control and tolerance, I decided to continue the prescribed amlodipine regimen.";
  sections.assessmentPlan = `${problem}\n${risk}\nThe existing DNR order is background status, not a new management decision in this encounter.`;
  twoTestReview(extraction, sections);
  extraction.summary = "Existing code status is distinguished from today's actual management work.";
  extraction.problems = [{ ...evidence(problem, "One stable chronic illness is addressed today."), label: "Hypertension", problemKey: "hypertension", course: "chronic", addressed: true, criterion: "stable_chronic", management: "Assess control and tolerance." }];
  extraction.risks = [{ ...evidence(risk, "Prescription continuation is the documented management decision; historical code status earns no new risk credit."), decision: "Continue prescription after assessment", criterion: "prescription_decision" }];
  return complete("worksheet-existing-dnr", "Worksheet practice — existing DNR status alone", "progress", "An existing DNR order does not by itself establish a current high-risk management decision.", sections, extraction,
    { problems: "Low", data: "Low", risk: "Moderate", overall: "Low", code: "99231", rationale: "Stable hypertension and two panel reviews are low; prescription management is moderate. The pre-existing DNR status does not supply a current care-limitation decision or raise the overall MDM." });
}

function currentCareLimitation() {
  const sections = { ...emptySections }, extraction = baseExtraction();
  sections.intervalHistory = "A fictional adult with advanced chronic lung disease has worsening respiratory symptoms during the hospital stay. The patient participates in today's discussion of prognosis and treatment preferences.";
  sections.examination = "Increased work of breathing and rising oxygen requirement are documented during today's evaluation.";
  const problem = "The chronic lung disease now has a severe exacerbation threatening respiratory organ function; I evaluated the deterioration and actively managed the condition today.";
  const risk = "Because of the poor prognosis, I discussed resuscitation and treatment limits with the patient today and made a new, documented decision not to attempt resuscitation or intubation, consistent with the patient's informed preferences.";
  sections.assessmentPlan = `${problem}\n${risk}\nThis is a fictional subsequent hospital E/M encounter; no separate critical-care, discharge, or separately reported advance-care-planning service is represented.`;
  twoTestReview(extraction, sections);
  extraction.summary = "Today's severe problem and new prognosis-based care-limitation decision are distinct from merely listing a pre-existing code status.";
  extraction.problems = [{ ...evidence(problem, "A severe current exacerbation is explicitly assessed and managed."), label: "Severe chronic lung disease exacerbation", problemKey: "chronic_lung_disease", course: "chronic", addressed: true, criterion: "severe_chronic_flare", management: "Evaluate and manage the deterioration." }];
  extraction.risks = [{ ...evidence(risk, "A current decision is documented with poor-prognosis context and the patient's informed preferences."), decision: "New prognosis-based resuscitation and treatment-limitation decision", criterion: "resuscitation_limitation" }];
  return complete("worksheet-current-care-limitation", "Worksheet practice — new prognosis-based care-limitation decision", "progress", "Evaluate the documented decision made today and its context; a high risk element still requires another high element for high overall MDM.", sections, extraction,
    { problems: "High", data: "Low", risk: "High", overall: "High", code: "99233", rationale: "A severe current exacerbation and a new prognosis-based care-limitation decision establish two high elements. Two panel reviews contribute only low data; no diagnostic point totals are used." });
}

export const worksheetCases: DemoCase[] = [stableConditions(), nonsevereFlare(), routineMonitoring(), intensiveToxicity(), existingDnr(), currentCareLimitation()];
