import { z } from "zod";
import { potentialIdentifiers } from "./privacy";
import { billingContextSchema, emptyBillingContext } from "./billing-context";
import { MAX_NOTE_CHARACTERS } from "./limits";

export const sectionLabels = {
  hpi: "History of Present Illness (HPI)",
  medicalHistory: "Relevant Medical History",
  intervalHistory: "Interval History / Subjective",
  examination: "Physical Examination",
  laboratory: "Laboratory Studies",
  cardiac: "EKG / Cardiac Studies",
  imaging: "Radiology / Imaging",
  otherStudies: "Other Diagnostic Studies",
  dataActivities: "Data Review and Interpretation Activities",
  assessmentPlan: "Assessment & Plan",
} as const;

export type SectionKey = keyof typeof sectionLabels;
export type NoteType = "admission" | "progress";
export const noteLabels: Record<NoteType, string> = { admission: "Admission H&P", progress: "Progress Note" };
export const sectionKeys = (type: NoteType): SectionKey[] => [
  ...(type === "admission" ? ["hpi", "medicalHistory"] as const : ["intervalHistory"] as const),
  "examination", "laboratory", "cardiac", "imaging", "otherStudies", "dataActivities", "assessmentPlan",
];

const text = z.string().max(MAX_NOTE_CHARACTERS, "Keep each documentation field within 12,000 characters.");
const sectionsSchema = z.object({
  hpi: text, medicalHistory: text, intervalHistory: text, examination: text,
  laboratory: text, cardiac: text, imaging: text, otherStudies: text, dataActivities: text, assessmentPlan: text,
}).strict();
export const emptySections: z.infer<typeof sectionsSchema> = {
  hpi: "", medicalHistory: "", intervalHistory: "", examination: "", laboratory: "", cardiac: "", imaging: "", otherStudies: "", dataActivities: "", assessmentPlan: "",
};

export const analysisInputSchema = z.object({
  noteType: z.enum(["admission", "progress"]),
  inputMode: z.enum(["full", "sections"]),
  fullNote: text,
  sections: sectionsSchema,
  // Legacy fields remain accepted for previously loaded forms. New records
  // classify verified prepared examples on the server; other input is neutral.
  documentSource: z.enum(["synthetic", "deidentified", "user_provided"]).optional(),
  privacyConfirmed: z.boolean().optional(),
  deidentificationConfirmed: z.boolean().optional(),
  // Compatibility with the previously deployed fictional-only form.
  syntheticOnly: z.boolean().optional(),
  // Accepted only for compatibility with previously loaded forms. The selected
  // noteType establishes the workflow; no separate confirmation is required.
  encounterConfirmed: z.boolean().optional(),
  improveHpi: z.boolean(),
  providerMode: z.enum(["openai", "prepared_demo"]),
  sampleId: z.string().max(80).nullable(),
  billingContext: billingContextSchema.default(emptyBillingContext),
}).strict().superRefine((input, ctx) => {
  const confirmed = input.privacyConfirmed === true || (input.privacyConfirmed === undefined && input.documentSource !== "deidentified" && input.syntheticOnly === true);
  if (!confirmed) ctx.addIssue({ code: "custom", message: "Confirm that the documentation contains no identifying patient information and may be submitted for this demonstration.", path: ["privacyConfirmed"] });
  const note = normalizeDocumentation(input);
  if (!note.trim()) ctx.addIssue({ code: "custom", message: "Enter documentation in at least one active field.", path: ["fullNote"] });
  if (note.length > MAX_NOTE_CHARACTERS) ctx.addIssue({ code: "custom", message: "Keep the combined documentation within 12,000 characters, including section headings.", path: ["fullNote"] });
  if (input.noteType === "progress" && input.improveHpi) ctx.addIssue({ code: "custom", message: "HPI improvement is available for Admission H&P only.", path: ["improveHpi"] });
});

export type AnalysisInput = z.infer<typeof analysisInputSchema>;
export function normalizeDocumentation(input: { noteType: NoteType; inputMode: "full" | "sections"; fullNote: string; sections: typeof emptySections }) {
  if (input.inputMode === "full") return input.fullNote.trim();
  return sectionKeys(input.noteType)
    .filter((key) => input.sections[key].trim())
    .map((key) => `${sectionLabels[key]}\n${input.sections[key].trim()}`)
    .join("\n\n");
}

// Best-effort rejection of obvious identifiers is an extra guard, not de-identification.
// Consent is mandatory; no automated detector can prove that text is synthetic.
export function containsObviousIdentifiers(note: string) {
  return potentialIdentifiers(note).length > 0;
}
