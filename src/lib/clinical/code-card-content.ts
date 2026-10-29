import { mapHospitalCode, type MdmLevel } from "./mdm";
import type { NoteType } from "./input";

export const codeCardLevels = [
  {
    level: 1, mdm: "Low" as MdmLevel, label: "Straightforward or low",
    problems: "An uncomplicated acute illness, one stable chronic condition, or at least two minor problems can meet low problem complexity. A single minor, self-limited problem may be straightforward.",
    data: "Low data: two qualifying unique test/source activities, or an assessment requiring an independent historian. Straightforward data may be minimal or absent.",
    risk: "Minimal or low management risk, supported by the actual decisions and patient context. Supportive care can qualify; a treatment list alone does not establish risk.",
    example: "An uncomplicated illness addressed today plus a low-risk supportive-care decision can establish two low elements, even with minimal data.",
    breakdown: "Problems: Low · Data: Straightforward · Risk: Low → Overall: Low",
  },
  {
    level: 2, mdm: "Moderate" as MdmLevel, label: "Moderate",
    problems: "Examples include a nonsevere chronic-illness flare, two stable chronic illnesses actually managed, a new problem with uncertain prognosis, systemic acute illness, or a complicated injury.",
    data: "Meet one data category: at least three qualifying Category 1 items; an eligible independent test interpretation; or a qualifying external discussion of management or test interpretation.",
    risk: "Prescription management after assessment can support moderate risk. Other examples include certain procedural decisions or care significantly limited by social circumstances, with relevant context.",
    example: "A nonsevere COPD exacerbation is assessed and prescription treatment is selected or deliberately continued. Moderate problems and moderate management risk can support this level even when data is low.",
    breakdown: "Problems: Moderate · Data: Low · Risk: Moderate → Overall: Moderate",
  },
  {
    level: 3, mdm: "High" as MdmLevel, label: "High",
    problems: "A severe chronic-illness exacerbation, or an acute/chronic condition posing a near-term threat to life or organ function, can support high problem complexity. Show the clinical context, not just a diagnosis label.",
    data: "Meet two of these three categories: Category 1 with at least three qualifying items; eligible independent interpretation; qualifying external management/test-interpretation discussion. More tests alone do not create a second category.",
    risk: "Examples include a supported hospitalization or hospital-care escalation decision, intensive drug-toxicity monitoring, specified high-risk major-surgery decisions, parenteral controlled medication management, or a new poor-prognosis care-limitation decision.",
    example: "A condition threatening organ function is actively managed, with a documented high-risk decision. Those two high elements can establish high MDM even when data is moderate.",
    breakdown: "Problems: High · Data: Moderate · Risk: High → Overall: High",
  },
] as const;

export function getHospitalCodeCards(noteType: NoteType) {
  const minutes = noteType === "admission" ? [40, 55, 75] : [25, 35, 50];
  return codeCardLevels.map((card, index) => ({ ...card, code: mapHospitalCode(noteType, card.mdm), minutes: minutes[index] }));
}

export const noteDocumentationGuidance: Record<NoteType, { title: string; text: string }[]> = {
  admission: [
    { title: "Reason for evaluation and HPI", text: "Describe the presenting problem, timeline, relevant baseline and change, prior treatment and response, and the source of history. Include relevant medical history, medications and allergies." },
    { title: "Relevant examination", text: "Record the medically appropriate findings and relevant vital signs actually assessed. Explain findings that inform severity or management." },
    { title: "Assessment and admission plan", text: "Describe each problem actually evaluated, its current status, your treatment choices and rationale. Explain an admission or escalation decision when made; distinguish it from placement already decided by someone else." },
  ],
  progress: [
    { title: "Reason for today's review", text: "Identify the condition being followed and why it needs assessment today. Describe interval events, symptoms, treatment response, and relevant nursing or consultant information with its source." },
    { title: "Current clinical status", text: "Document the medically appropriate examination and relevant findings today. Explain improvement, persistent symptoms or deterioration in context; avoid relying on a copied diagnosis list." },
    { title: "Today's decisions", text: "Show what you evaluated and decided to start, change, continue, stop or defer, and why. Reasoned continuation can count. Routine inpatient care is not automatically a new hospitalization or escalation decision." },
  ],
};
