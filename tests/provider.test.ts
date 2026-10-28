import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { requestStructured, ProviderError } from "../src/lib/clinical/provider-client";
import { clinicalExtractionSchema, groundExtraction, hpiSchema, validateHpi } from "../src/lib/clinical/contracts";
import { demoCases } from "../src/lib/clinical/demos";
import { evaluateMdm } from "../src/lib/clinical/mdm";

const schema = z.object({ value: z.string() }).strict();
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
