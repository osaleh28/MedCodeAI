import { z } from "zod";
import { hasGroundedEvidence, type ClinicalExtraction, type EvidenceFinding } from "./contracts";
import type { NoteType } from "./input";

export const RULE_VERSION = "hospital-mdm-2023-public-v1";
export const ruleSources = [
  { title: "AMA hospital E/M guidelines, effective January 2023 (Table 1 and hospital descriptors)", url: "https://www.ama-assn.org/system/files/2023-e-m-descriptors-guidelines.pdf" },
  { title: "AMA E/M clarifications, updated January 2026", url: "https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management-em-revisions-faqs" },
  { title: "CMS Evaluation and Management Services, May 2026", url: "https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf" },
];
export const levels = ["Straightforward", "Low", "Moderate", "High"] as const;
// Intentionally limited verified identity catalog. Unmapped diagnostic tests are
// displayed but cannot earn definite unique-test credit in this MVP.
export const supportedTestKeys = new Set(["blood_count", "metabolic_panel", "electrocardiogram", "chest_radiograph"]);
export type MdmLevel = typeof levels[number];
const levelSchema = z.enum(levels);
const elementSchema = z.object({
  level: levelSchema.nullable(), minimum: levelSchema, maximum: levelSchema,
  explanation: z.string(), credited: z.array(z.string()), excluded: z.array(z.string()), evidence: z.array(z.string()),
});
export const mdmResultSchema = z.object({
  ruleVersion: z.string(), assessedAt: z.string(),
  problems: elementSchema, data: elementSchema, risk: elementSchema,
  overall: levelSchema.nullable(), minimum: levelSchema, maximum: levelSchema,
  potentialCode: z.enum(["99221", "99222", "99223", "99231", "99232", "99233"]).nullable(),
  explanation: z.string(), uncertaintyNotice: z.string(), limitations: z.array(z.string()),
});
export type MdmResult = z.infer<typeof mdmResultSchema>;
type Element = z.infer<typeof elementSchema>;
type Scored = EvidenceFinding & { name: string };
const numberOf = (level: MdmLevel) => levels.indexOf(level);
const unique = (values: string[]) => [...new Set(values)];

function element(score: number, unresolved: boolean, explanation: string, accepted: Scored[], excluded: string[]): Element {
  return {
    level: unresolved && score < 3 ? null : levels[score], minimum: levels[score], maximum: levels[unresolved ? 3 : score],
    explanation, credited: accepted.map((item) => item.name), excluded,
    evidence: unique(accepted.flatMap((item) => item.evidence)),
  };
}

function assessProblems(extraction: ClinicalExtraction, note: string): Element {
  const accepted: Scored[] = [], excluded: string[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  let unresolved = !extraction.problemsComplete;
  for (const item of extraction.problems) {
    if (item.addressed === false) { excluded.push(`${item.label}: background condition, not addressed.`); continue; }
    if (!hasGroundedEvidence(item, note) || item.addressed !== true || item.criterion === "unknown" || !item.problemKey.trim()) {
      unresolved = true; excluded.push(`${item.label}: relevance, category, or evidence is uncertain.`); continue;
    }
    const key = item.problemKey.trim().toLowerCase();
    if (seen.has(key)) { excluded.push(`${item.label}: duplicate problem.`); continue; }
    seen.add(key); counts.set(item.criterion, (counts.get(item.criterion) ?? 0) + 1);
    accepted.push({ ...item, name: `${item.label} — ${item.criterion.replaceAll("_", " ")}` });
  }
  const count = (criterion: string) => counts.get(criterion) ?? 0;
  const any = (...criteria: string[]) => criteria.some((criterion) => count(criterion) > 0);
  let score = 0;
  if (any("severe_chronic_flare", "organ_threat")) score = 3;
  else if (count("stable_chronic") >= 2 || any("chronic_flare", "new_uncertain_prognosis", "systemic_acute", "complicated_injury")) score = 2;
  else if (count("minor") >= 2 || any("stable_chronic", "uncomplicated_acute", "stable_acute")) score = 1;
  if (!accepted.length) unresolved = true;
  return element(score, unresolved, "Only distinct problems actually addressed with traceable evidence contribute. Clinical status must come from documentation, not laboratory abnormalities alone.", accepted, excluded);
}

// Identity grouping only, never a keyword-based complexity classifier. Overlapping
// panels/components and repeat values share one potential data-credit identity.
export function canonicalTestKey(key: string) {
  const value = key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const aliases: Record<string, string> = {
    cbc: "blood_count", cbc_with_differential: "blood_count", cbc_without_differential: "blood_count",
    complete_blood_count: "blood_count", wbc: "blood_count", hemoglobin: "blood_count", platelets: "blood_count",
    bmp: "metabolic_panel", cmp: "metabolic_panel", basic_metabolic_panel: "metabolic_panel", comprehensive_metabolic_panel: "metabolic_panel",
    sodium: "metabolic_panel", potassium: "metabolic_panel", creatinine: "metabolic_panel", glucose: "metabolic_panel",
    ecg: "electrocardiogram", ekg: "electrocardiogram", ecg_12_lead: "electrocardiogram",
  };
  return aliases[value] ?? value;
}

function assessData(extraction: ClinicalExtraction, note: string): Element {
  const accepted: Scored[] = [], excluded: string[] = [];
  let unresolved = !extraction.dataComplete;
  const interpretationKeys = new Set<string>();
  const category1 = new Set<string>();
  let historian = false, interpretation = false, discussion = false;
  const eligible = extraction.data.filter((item) => {
    if (item.activity === "result_only") { excluded.push(`${item.label}: result listing alone earns no activity credit.`); return false; }
    if (item.qualifies === false || item.separatelyReported === true) { excluded.push(`${item.label}: nonqualifying or separately reported activity.`); return false; }
    if (!hasGroundedEvidence(item, note) || item.qualifies !== true || !item.uniqueKey.trim()) {
      unresolved = true; excluded.push(`${item.label}: qualifying activity or identity cannot be confirmed.`); return false;
    }
    const requiredKind = { external_record: "records", independent_historian: "historian", external_discussion: "discussion" }[item.activity as "external_record" | "independent_historian" | "external_discussion"];
    if ((requiredKind && item.kind !== requiredKind) || (!requiredKind && !["laboratory", "cardiac", "imaging", "other"].includes(item.kind))) {
      unresolved = true; excluded.push(`${item.label}: activity and source type conflict.`); return false;
    }
    if (["order", "review", "independent_interpretation"].includes(item.activity)) {
      const identity = canonicalTestKey(item.uniqueKey);
      if (["pulse_oximetry", "spo2", "oxygen_saturation"].includes(identity)) { excluded.push(`${item.label}: oximetry is not a qualifying unique test.`); return false; }
      if (!supportedTestKeys.has(identity)) { unresolved = true; excluded.push(`${item.label}: unique test identity is outside this MVP's verified catalog; no definite credit.`); return false; }
    }
    if (["independent_interpretation", "external_discussion"].includes(item.activity)
      && (item.separatelyReported !== false || (item.activity === "independent_interpretation" && item.performedByOther !== true))) {
      unresolved = true; excluded.push(`${item.label}: separate reporting or test performer is unconfirmed.`); return false;
    }
    return true;
  });
  for (const item of eligible) if (item.activity === "independent_interpretation") interpretationKeys.add(canonicalTestKey(item.uniqueKey));
  for (const item of eligible) {
    const key = canonicalTestKey(item.uniqueKey);
    if (["order", "review"].includes(item.activity)) {
      if (interpretationKeys.has(key)) { excluded.push(`${item.label}: interpretation credited separately; duplicate test credit excluded conservatively.`); continue; }
      const identity = `test:${key}`;
      if (category1.has(identity)) { excluded.push(`${item.label}: same test/panel already counted.`); continue; }
      category1.add(identity);
    } else if (item.activity === "external_record") {
      const identity = `source:${key}`;
      if (category1.has(identity)) { excluded.push(`${item.label}: same external source already counted.`); continue; }
      category1.add(identity);
    } else if (item.activity === "independent_historian") {
      if (historian) { excluded.push(`${item.label}: historian category already represented.`); continue; }
      historian = true;
    } else if (item.activity === "independent_interpretation") interpretation = true;
    else if (item.activity === "external_discussion") discussion = true;
    accepted.push({ ...item, name: `${item.label} — ${item.activity.replaceAll("_", " ")}` });
  }
  const total = category1.size + Number(historian);
  const moderateCategories = Number(total >= 3) + Number(interpretation) + Number(discussion);
  const score = moderateCategories >= 2 ? 3 : moderateCategories >= 1 ? 2 : category1.size >= 2 || historian ? 1 : 0;
  return element(score, unresolved,
    `${category1.size} unique test/source credit(s); historian ${historian ? "credited once" : "not credited"}; ${moderateCategories} qualifying data category/categories. Displayed results, repeated values, and order/review of the same test are not additive.`, accepted, excluded);
}

function assessRisk(extraction: ClinicalExtraction, note: string): Element {
  const accepted: Scored[] = [], excluded: string[] = [];
  let score = 0, unresolved = !extraction.riskComplete;
  const scores: Record<string, number> = {
    minimal_support: 0, low_management: 1,
    prescription_decision: 2, minor_procedure_with_risk: 2, major_procedure_without_risk: 2, social_constraint: 2,
    toxicity_monitoring: 3, major_procedure_with_risk: 3, emergency_major_procedure: 3,
    admission_or_escalation_decision: 3, resuscitation_limitation: 3, parenteral_controlled_medication: 3,
  };
  for (const item of extraction.risks) {
    if (!hasGroundedEvidence(item, note) || !(item.criterion in scores)) {
      unresolved = true; excluded.push(`${item.decision}: management decision or risk basis is uncertain.`); continue;
    }
    score = Math.max(score, scores[item.criterion]);
    accepted.push({ ...item, name: `${item.decision} — ${item.criterion.replaceAll("_", " ")}` });
  }
  if (!accepted.length) unresolved = true;
  return element(score, unresolved, "Risk reflects documented management decisions. Being in a hospital, having many diagnoses, routine medication lists, and abnormal tests do not themselves establish high management risk.", accepted, excluded);
}

export function mapHospitalCode(type: NoteType, level: MdmLevel) {
  const codes = type === "admission" ? ["99221", "99221", "99222", "99223"] as const : ["99231", "99231", "99232", "99233"] as const;
  return codes[numberOf(level)];
}

export function evaluateMdm(extraction: ClinicalExtraction, note: string, noteType: NoteType): MdmResult {
  const problems = assessProblems(extraction, note), data = assessData(extraction, note), risk = assessRisk(extraction, note);
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[1];
  const minimum = levels[median([problems, data, risk].map((item) => numberOf(item.minimum)))];
  const maximum = levels[median([problems, data, risk].map((item) => numberOf(item.maximum)))];
  const inScope = extraction.isClinicalNote && extraction.encounterConcerns.length === 0;
  const overall = minimum === maximum && inScope ? minimum : null;
  const potentialCode = overall ? mapHospitalCode(noteType, overall) : null;
  return {
    ruleVersion: RULE_VERSION, assessedAt: new Date().toISOString(), problems, data, risk, overall, minimum, maximum, potentialCode,
    explanation: overall
      ? `At least two MDM elements meet or exceed ${overall.toLowerCase()} complexity. Under the confirmed ${noteType === "admission" ? "initial" : "subsequent"} hospital encounter assumption, the potential code is ${potentialCode}.`
      : !inScope ? "The documentation does not reliably establish an in-scope clinical encounter. No code was assigned."
        : `Unresolved documentation permits MDM from ${minimum.toLowerCase()} to ${maximum.toLowerCase()}. A reliable final level and code cannot be determined.`,
    uncertaintyNotice: "Educational assessment, not validated coding advice. Clinical categories are AI interpretations of the original note, not verified facts. Missing information is never treated as work performed.",
    limitations: [
      "Public AMA 2023 hospital MDM framework; CMS May 2026 context; reviewed October 27, 2026. This is not an exhaustive implementation of the licensed 2026 CPT manual or payer policies.",
      "Initial/subsequent inpatient or observation encounter assumed by the user; note titles do not establish eligibility. No time-based coding, consultations, critical care, discharge, same-day admission/discharge, modifiers, or payer-specific edits.",
      "Uncertain findings are excluded from definite credit. If unresolved evidence could change the overall level, the result is indeterminate. Two unambiguous high elements can still establish high MDM despite an unknown third element.",
      "Test identity/overlap, external-source eligibility, independent interpretation, separate reporting, and clinical severity require human review. Unverifiable activities are not credited.",
      "Definite test identities in this MVP are limited to blood-count panels, overlapping metabolic panels, ECG, and chest radiographs. Other studies remain visible but unresolved rather than guessed into unique-test credit.",
      "Only original documentation is evaluated; HPI wording suggestions do not enter the coding engine.",
    ],
  };
}
