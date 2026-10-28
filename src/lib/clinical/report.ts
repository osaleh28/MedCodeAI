import { z } from "zod";
import { clinicalExtractionSchema, hpiSchema } from "./contracts";
import { mdmResultSchema } from "./mdm";

export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  documentSource: z.enum(["synthetic", "deidentified"]).default("synthetic"),
  origin: z.enum(["openai", "prepared_demo"]),
  model: z.string().nullable(),
  demoCaseId: z.string().nullable(),
  exampleRationale: z.string().nullable(),
  extraction: clinicalExtractionSchema,
  mdm: mdmResultSchema,
  hpi: hpiSchema.extend({ suggestedHpi: z.string(), warnings: z.array(z.string()) }).nullable(),
});
export type SavedReport = z.infer<typeof reportSchema>;
