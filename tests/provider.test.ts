import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { configuredApiKey, requestStructured as requestStructuredRaw, ProviderError, providerErrorMessage, emptyCallUsage } from "../src/lib/clinical/provider-client";
import { tokenCostMicros, UsageLimitError } from "../src/lib/clinical/limits";
import { clinicalExtractionSchema, groundExtraction, hpiSchema, validateHpi } from "../src/lib/clinical/contracts";
import { demoCases } from "../src/lib/clinical/demos";
import { evaluateMdm } from "../src/lib/clinical/mdm";

const schema = z.object({ value: z.string() }).strict();
// Existing contract fixtures focus on generation; provide its token preflight.
const requestStructured: typeof requestStructuredRaw = (args) => requestStructuredRaw({ ...args, fetcher: async (url, init) => {
  if (String(url).endsWith("/input_tokens")) return Response.json({ input_tokens: 100 });
  return args.fetcher!(url, init);
} });
const configuration = { schema, name: "test", instructions: "Test fixture.", documentation: "Fictional note.", apiKey: "fake-test-key", model: "test-model" };
const output = (value: unknown, status = "completed") => ({ status, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
test("provider transport uses strict structured output, server auth, and store=false", async () => {
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fake-test-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.equal(body.model, "test-model");
    assert.equal(body.text.format.schema.additionalProperties, false);
    return Response.json(output({ value: "verified" }));
  };
  assert.deepEqual(await requestStructured({ ...configuration, fetcher }), { value: "verified" });
});
test("malformed, incomplete, refused, and schema-invalid output never becomes an assessment", async () => {
  const responses = [output({ value: 3 }), output({ value: "text" }, "incomplete"), { status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }, { unexpected: true }, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not JSON" }] }] }];
  for (const response of responses) await assert.rejects(() => requestStructured({ ...configuration, fetcher: async () => Response.json(response) }), ProviderError);
});
test("provider quota and credential errors have safe categories", async () => {
  for (const [status, code] of [[429, "quota"], [401, "configuration"], [500, "unavailable"]] as const) {
    await assert.rejects(() => requestStructured({ ...configuration, fetcher: async () => new Response("Sensitive provider details", { status }) }), (error: unknown) => error instanceof ProviderError && error.code === code && !error.message.includes("Sensitive"));
  }
});
test("missing API key prevents any provider request", async () => {
  let called = false;
  await assert.rejects(() => requestStructured({ ...configuration, apiKey: "", fetcher: async () => { called = true; return Response.json({}); } }), ProviderError);
  assert.equal(called, false);
});

test("exhausted credits and account limits get actionable messages rather than an automatic retry", () => {
  assert.match(providerErrorMessage(new ProviderError("quota", 429, "credit_balance_exhausted")), /credit balance is exhausted/);
  assert.match(providerErrorMessage(new ProviderError("quota", 429, "project_spend_limit_exceeded")), /billing or usage limit/);
  assert.match(providerErrorMessage(new ProviderError("quota", 429, "rate_limit_exceeded")), /try later/);
  assert.ok(!providerErrorMessage(new ProviderError("quota", 429, "credit_balance_exhausted")).includes("try later"));
});

test("provider errors retain safe billing codes without exposing provider messages or notes", async () => {
  await assert.rejects(() => requestStructured({ ...configuration, fetcher: async () => Response.json({ error: { code: "credit_balance_exhausted", message: "Private provider details" } }, { status: 429 }) }), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.providerCode, "credit_balance_exhausted");
    assert.ok(!error.message.includes("Private"));
    assert.ok(!providerErrorMessage(error).includes("Private"));
    return true;
  });
});

test("placeholder and incorrectly pasted credentials are rejected without an API call", async () => {
  for (const value of ["PASTE_YOUR_OPENAI_API_KEY_HERE", "REPLACE_WITH_YOUR_OPENAI_API_KEY", '"fake-key"', "OPENAI_API_KEY=fake-key"]) {
    let called = false;
    await assert.rejects(() => requestStructured({ ...configuration, apiKey: value, fetcher: async () => { called = true; return Response.json({}); } }), ProviderError);
    assert.equal(called, false);
  }
  assert.equal(configuredApiKey("  fake-test-key  "), "fake-test-key");
});

test("full structured extraction and separate HPI responses validate before rules are evaluated", async () => {
  const sample = demoCases.find((item) => item.id === "admission-moderate")!;
  const extraction = await requestStructured({ ...configuration, schema: clinicalExtractionSchema, fetcher: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(!("potentialCode" in body.text.format.schema.properties));
    assert.ok(!("overall" in body.text.format.schema.properties));
    return Response.json(output(sample.extraction));
  } });
  const hpi = await requestStructured({ ...configuration, schema: hpiSchema, fetcher: async () => Response.json(output({ status: sample.hpi!.status, originalHpi: sample.hpi!.originalHpi, sentences: sample.hpi!.sentences, clarificationQuestions: sample.hpi!.clarificationQuestions })) });
  assert.equal(validateHpi(hpi, sample.note).status, "available");
  const mdm = evaluateMdm(groundExtraction(extraction, sample.note), sample.note, sample.noteType);
  assert.equal(mdm.potentialCode, "99222");
});

test("preflight includes instructions and schema; 20,001 input tokens never starts generation", async () => {
  const usage = emptyCallUsage();
  let calls = 0;
  await assert.rejects(() => requestStructuredRaw({ ...configuration, usage, fetcher: async (url, init) => {
    calls++;
    assert.ok(String(url).endsWith("/input_tokens"));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.instructions, configuration.instructions);
    assert.equal(body.text.format.schema.additionalProperties, false);
    return Response.json({ input_tokens: 20_001 });
  } }), UsageLimitError);
  assert.equal(calls, 1);
  assert.equal(usage.chargedMicros, 0);
});

test("token preflight failure fails closed without generation or a charge", async () => {
  for (const response of [Response.json({ unexpected: true }), Response.json({}, { status: 500 })]) {
    const usage = emptyCallUsage(); let calls = 0;
    await assert.rejects(() => requestStructuredRaw({ ...configuration, usage, fetcher: async () => { calls++; return response; } }), ProviderError);
    assert.equal(calls, 1); assert.equal(usage.chargedMicros, 0);
  }
});

test("20,000 input tokens accepted; analysis and HPI get distinct output ceilings", async () => {
  for (const [name, limit] of [["source_clinical_extraction", 6500], ["hpi_suggestion", 2000]] as const) {
    const usage = emptyCallUsage();
    await requestStructuredRaw({ ...configuration, name, usage, fetcher: async (url, init) => {
      if (String(url).endsWith("/input_tokens")) return Response.json({ input_tokens: 20_000 });
      assert.equal(JSON.parse(String(init?.body)).max_output_tokens, limit);
      assert.equal(usage.chargedMicros, tokenCostMicros(20_000, limit));
      return Response.json({ ...output({ value: "verified" }), usage: { input_tokens: 20_000, output_tokens: 30 } });
    } });
    assert.equal(usage.chargedMicros, tokenCostMicros(20_000, 30));
    assert.equal(usage.inputTokens, 20_000); assert.equal(usage.outputTokens, 30);
  }
});

test("invalid or incomplete paid output is charged before validation", async () => {
  for (const status of ["completed", "incomplete"]) {
    const usage = emptyCallUsage();
    await assert.rejects(() => requestStructured({ ...configuration, usage, fetcher: async () => Response.json({ ...output({ value: 3 }, status), usage: { input_tokens: 100, output_tokens: 80 } }) }), ProviderError);
    assert.equal(usage.chargedMicros, tokenCostMicros(100, 80));
  }
});

test("lost response and missing usage retain the maximum possible dispatched cost", async () => {
  for (const mode of ["lost", "missing_usage", "malformed_usage", "refused"]) {
    const usage = emptyCallUsage();
    try {
      await requestStructured({ ...configuration, usage, fetcher: async () => {
        if (mode === "lost") throw new Error("connection lost");
        if (mode === "refused") return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] });
        return Response.json({ ...output({ value: "verified" }), ...(mode === "malformed_usage" ? { usage: { input_tokens: -1, output_tokens: 0 } } : {}) });
      } });
    } catch (error) { assert.ok(error instanceof ProviderError); }
    assert.equal(usage.chargedMicros, tokenCostMicros(100, 6500));
  }
});
