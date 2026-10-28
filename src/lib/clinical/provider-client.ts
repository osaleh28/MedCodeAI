import { z } from "zod";

export class ProviderError extends Error {
  constructor(
    public readonly code: "configuration" | "timeout" | "refusal" | "invalid_output" | "unavailable" | "quota",
    public readonly status?: number,
    public readonly providerCode?: string,
  ) {
    super(`AI provider error: ${code}`);
    this.name = "ProviderError";
  }
}

export function providerErrorMessage(error: ProviderError) {
  if (error.code === "quota") {
    if (error.providerCode === "credit_balance_exhausted") return "Live AI analysis is unavailable because this demo's OpenAI API credit balance is exhausted. Run a prepared example, or contact the demo owner. Nothing was saved.";
    if (["insufficient_quota", "project_spend_limit_exceeded", "organization_spend_limit_exceeded", "organization_usage_limit_exceeded"].includes(error.providerCode ?? "")) return "The demo's OpenAI API billing or usage limit was reached. Run a prepared example, or contact the demo owner. Nothing was saved.";
    return "The AI provider's quota or rate limit was reached. Please try later or run a prepared example.";
  }
  return {
    configuration: "Live AI analysis is currently unavailable. You can run an unchanged prepared example or try again later.",
    timeout: "The AI request timed out. Nothing was saved. Please try again later.",
    refusal: "The AI provider could not process this documentation. Nothing was saved. Try a fictional demonstration case.",
    invalid_output: "The AI response could not be validated. Nothing was saved or assigned a code. Please try again later.",
    unavailable: "The AI service is unavailable. Nothing was saved. Please try again later.",
  }[error.code];
}

export function configuredApiKey(value: string | undefined) {
  const key = value?.trim();
  if (!key || /^(PASTE_|REPLACE_|YOUR_)/.test(key)) throw new ProviderError("configuration", undefined, "missing_api_key");
  if (/^["']|["']$/.test(key) || /[\r\n]/.test(key) || /^OPENAI_API_KEY\s*=/.test(key)) {
    throw new ProviderError("configuration", undefined, "malformed_api_key");
  }
  return key;
}

// Transport is injectable for deterministic tests. Credentials are supplied only
// by the server wrapper; no browser module imports this client.
export async function requestStructured<T extends z.ZodType>({
  schema, name, instructions, documentation, apiKey, model, fetcher = fetch,
}: { schema: T; name: string; instructions: string; documentation: string | { sourceSpans: { id: number; text: string }[] }; apiKey: string; model: string; fetcher?: typeof fetch }): Promise<z.infer<T>> {
  const key = configuredApiKey(apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);
  try {
    const schemaJson = z.toJSONSchema(schema, { target: "draft-7" });
    delete schemaJson.$schema;
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, max_output_tokens: 6500, instructions,
        input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ syntheticDocumentation: documentation }) }] }],
        text: { format: { type: "json_schema", name, strict: true, schema: schemaJson } },
      }),
    });
    if (!response.ok) {
      const providerError = await response.json().catch(() => null);
      const candidate: unknown = providerError?.error?.code;
      const safeCode = typeof candidate === "string" && /^[a-z0-9_]{1,80}$/.test(candidate) ? candidate : undefined;
      throw new ProviderError(response.status === 429 ? "quota" : [401, 403].includes(response.status) ? "configuration" : "unavailable", response.status, safeCode);
    }
    const raw: unknown = await response.json();
    const envelope = z.object({ status: z.string(), output: z.array(z.object({
      type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    })) }).safeParse(raw);
    if (!envelope.success) throw new ProviderError("invalid_output");
    const content = envelope.data.output.flatMap((item) => item.content ?? []);
    if (content.some((item) => item.type === "refusal")) throw new ProviderError("refusal");
    if (envelope.data.status !== "completed") throw new ProviderError("invalid_output");
    const text = content.filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("");
    if (!text || text.length > 100_000) throw new ProviderError("invalid_output");
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new ProviderError("invalid_output"); }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ProviderError("invalid_output");
    return parsed.data;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted) throw new ProviderError("timeout");
    throw new ProviderError("unavailable");
  } finally { clearTimeout(timeout); }
}
