import { z } from "zod";
import { potentialIdentifiers } from "./privacy";

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

const text = z.string().max(24_000, "Keep each documentation field within 24,000 characters.");
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
  documentSource: z.enum(["synthetic", "deidentified"]).default("synthetic"),
  privacyConfirmed: z.boolean().optional(),
  deidentificationConfirmed: z.boolean().default(false),
  // Compatibility with the previously deployed fictional-only form.
  syntheticOnly: z.boolean().optional(),
  encounterConfirmed: z.literal(true, { error: "Confirm the encounter assumptions before continuing." }),
  improveHpi: z.boolean(),
  providerMode: z.enum(["openai", "prepared_demo"]),
  sampleId: z.string().max(80).nullable(),
}).strict().superRefine((input, ctx) => {
  const confirmed = input.privacyConfirmed === true || (input.privacyConfirmed === undefined && input.documentSource === "synthetic" && input.syntheticOnly === true);
  if (!confirmed) ctx.addIssue({ code: "custom", message: "Confirm that the documentation contains no identifying patient information and may be submitted for this demonstration.", path: ["privacyConfirmed"] });
  if (input.documentSource === "deidentified" && !input.deidentificationConfirmed) ctx.addIssue({ code: "custom", message: "Confirm that this real-case note has already been fully de-identified and you are authorized to use it.", path: ["deidentificationConfirmed"] });
  if (input.providerMode === "prepared_demo" && input.documentSource !== "synthetic") ctx.addIssue({ code: "custom", message: "Prepared examples are fictional teaching notes. Use live AI for de-identified real-case notes.", path: ["documentSource"] });
  const note = normalizeDocumentation(input);
  if (!note.trim()) ctx.addIssue({ code: "custom", message: "Enter documentation in at least one active field.", path: ["fullNote"] });
  if (note.length > 24_000) ctx.addIssue({ code: "custom", message: "Keep the combined documentation within 24,000 characters.", path: ["fullNote"] });
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
