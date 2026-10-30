import { z } from "zod";
import { clinicalExtractionSchema, hpiSchema } from "./contracts";
import { mdmResultSchema } from "./mdm";
import { billingContextSchema, emptyBillingContext } from "./billing-context";

export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  documentSource: z.enum(["synthetic", "deidentified", "user_provided"]).default("synthetic"),
  billingContext: billingContextSchema.default(emptyBillingContext),
  origin: z.enum(["openai", "prepared_demo"]),
  model: z.string().nullable(),
  demoCaseId: z.string().nullable(),
  exampleRationale: z.string().nullable(),
  extraction: clinicalExtractionSchema,
  mdm: mdmResultSchema,
  // Explicit reassessment retains the original rule version and conclusions.
  previousMdmAssessments: z.array(mdmResultSchema).optional(),
  hpi: hpiSchema.extend({ suggestedHpi: z.string(), warnings: z.array(z.string()) }).nullable(),
});
export type SavedReport = z.infer<typeof reportSchema>;
