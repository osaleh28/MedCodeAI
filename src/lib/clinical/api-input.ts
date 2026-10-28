export class InputError extends Error {}

export function sameOrigin(request: Request) {
  try { return new URL(request.headers.get("origin") ?? "").origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function readLimitedJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new InputError("Use a JSON request.");
  if (Number(request.headers.get("content-length")) > 128_000) throw new InputError("The submitted documentation is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Documentation is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 128_000) { await reader.cancel(); throw new InputError("The submitted documentation is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
  catch { throw new InputError("The submitted JSON is invalid."); }
}
