import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { allowAuthAttempt } from "@/lib/throttle";
import { analysisInputSchema, containsObviousIdentifiers, normalizeDocumentation, noteLabels, sectionKeys } from "@/lib/clinical/input";
import { groundExtraction, validateHpi } from "@/lib/clinical/contracts";
import { InputError, readLimitedJson, sameOrigin } from "@/lib/clinical/api-input";
import { resolvePreparedCase } from "@/lib/clinical/demos";
import { evaluateMdm } from "@/lib/clinical/mdm";
import { extractClinicalDocumentation, getAiConfiguration, improveHpi } from "@/lib/clinical/openai";
import { ProviderError, providerErrorMessage } from "@/lib/clinical/provider-client";
import { reportSchema } from "@/lib/clinical/report";
import { addProgressClarifications } from "@/lib/clinical/progress-guidance";
import { emptyBillingContext } from "@/lib/clinical/billing-context";

export const runtime = "nodejs";
export const maxDuration = 60;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Sign in to analyze documentation." }, 401);
    if (!sameOrigin(request)) return json({ error: "Submit documentation from this application's form." }, 403);
    const parsed = analysisInputSchema.safeParse(await readLimitedJson(request));
    if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);
    const input = parsed.data;
    const note = normalizeDocumentation(input);
    if (containsObviousIdentifiers(note)) return json({ error: "A potential patient full name, date of birth, or hospital MRN was detected. Remove these before submitting. Historical calendar dates are not automatically blocked. Nothing was sent to the AI provider or saved. This limited check does not certify de-identification." }, 400);
    const prepared = input.providerMode === "prepared_demo" ? resolvePreparedCase(input.sampleId, note, input.noteType) : null;
    if (input.providerMode === "prepared_demo" && !prepared) return json({ error: "Prepared mode requires an unchanged built-in example. Use live AI for edited documentation." }, 400);
    const configuration = prepared ? null : getAiConfiguration();
    const billingContext = prepared ? emptyBillingContext : input.billingContext;
    if (!(await allowAuthAttempt(user.id, prepared ? "demo" : "analysis"))) return json({ error: "Analysis limit reached. Try again in 15 minutes." }, 429);

    // HPI is a separate operation on the original documentation, never an input
    // to the MDM engine. Prepared fixtures are clearly labeled and never mixed
    // with model output or used as a silent fallback for provider failures.
    const [extracted, hpi] = prepared ? [prepared.extraction, input.improveHpi && prepared.hpi ? validateHpi(prepared.hpi, note) : null] : await Promise.all([
      extractClinicalDocumentation(note, input.noteType, billingContext),
      input.improveHpi ? improveHpi(input.inputMode === "sections" ? input.sections.hpi.trim() : note) : Promise.resolve(null),
    ]);
    const extraction = addProgressClarifications(groundExtraction(extracted, note), note, input.noteType);
    const mdm = evaluateMdm(extraction, note, input.noteType);
    const report = reportSchema.parse({ schemaVersion: 1, documentSource: input.documentSource, billingContext, origin: input.providerMode, model: configuration?.model ?? null,
      demoCaseId: prepared?.id ?? null, exampleRationale: prepared?.expected.rationale ?? null, extraction, mdm, hpi });
    const record = await getDb().billingAnalysis.create({ data: {
      userId: user.id, title: prepared?.title ?? `${noteLabels[input.noteType]} analysis`,
      syntheticNote: note, syntheticDataConfirmed: input.documentSource === "synthetic", noteType: input.noteType, inputMode: input.inputMode,
      // Enforce active-field persistence on the server as well as the form.
      // A crafted request must not retain an inactive workflow's hidden draft.
      submittedInput: { documentSource: input.documentSource, billingContext, privacyConfirmed: true, deidentificationConfirmed: input.deidentificationConfirmed, fullNote: input.inputMode === "full" ? input.fullNote : "", sections: input.inputMode === "sections" ? Object.fromEntries(sectionKeys(input.noteType).map((key) => [key, input.sections[key]])) : {} },
      structuredAnalysis: report, problemsComplexity: mdm.problems.level ?? "Indeterminate", dataComplexity: mdm.data.level ?? "Indeterminate", riskComplexity: mdm.risk.level ?? "Indeterminate",
      mdmComplexity: mdm.overall ?? (mdm.minimumSupportedCode ? `At least ${mdm.minimum}` : "Indeterminate"), suggestedCptCode: mdm.potentialCode ?? mdm.minimumSupportedCode, rationale: mdm.explanation,
      documentationGaps: extraction.gaps, hpiRevision: hpi?.suggestedHpi || null,
    }, select: { id: true } });
    return json(record, 201);
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    if (error instanceof ProviderError) {
      console.error("[analysis] AI request failed", { category: error.code, status: error.status, providerCode: error.providerCode });
      return json({ error: providerErrorMessage(error) }, error.code === "quota" ? 429 : error.code === "configuration" ? 503 : 502);
    }
    // No raw exceptions, SQL parameters, note text, credentials, or provider payloads.
    console.error("[analysis] Request failed", { category: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: "The analysis could not be completed and saved. Please try again later." }, 500);
  }
}
