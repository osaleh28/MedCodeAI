// Exercises actual progressive-enhancement forms/server actions over local HTTP.
// It does not bypass Credentials authorization or mint a test session.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { compare } from "bcryptjs";

dotenv.config({ quiet: true });
const base = new URL(process.env.MEDCODE_TEST_URL || process.env.AUTH_URL || "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Authentication tests must target localhost.");
const email = `auth-audit-${randomUUID()}@example.invalid`;
const password = randomBytes(24).toString("base64");
const cookies = new Map();
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
const decode = (value) => value.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options, redirect: "manual", signal: AbortSignal.timeout(30_000),
    headers: { Origin: base.origin, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...options.headers },
  });
  for (const value of response.headers.getSetCookie()) {
    const first = value.split(";")[0], index = first.indexOf("=");
    const key = first.slice(0, index), content = first.slice(index + 1);
    if (!content || /max-age=0(?:;|$)/i.test(value)) cookies.delete(key);
    else cookies.set(key, content);
  }
  return response;
}
async function form(path, values) {
  const page = await request(path);
  assert.equal(page.status, 200);
  const html = await page.text(), body = new FormData();
  for (const [tag] of html.matchAll(/<input\b[^>]*>/g)) {
    if (!tag.includes('type="hidden"')) continue;
    const name = tag.match(/name="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION")) body.append(decode(name), decode(tag.match(/value="([^"]*)"/)?.[1] || ""));
  }
  assert.ok([...body.keys()].length, "Server-action form metadata is required.");
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return request(path, { method: "POST", body });
}
function redirectedTo(response, path) {
  assert.ok([303, 307].includes(response.status), `Expected redirect to ${path}; received ${response.status}.`);
  assert.equal(new URL(response.headers.get("location"), base).pathname, path);
}

await db.connect();
try {
  redirectedTo(await request("/dashboard"), "/login");
  const registration = { name: "Synthetic Portfolio Audit", email, password, confirmPassword: password, syntheticOnly: "on" };
  const invalid = await form("/register", { ...registration, confirmPassword: "different-password" });
  assert.equal(invalid.status, 200);
  assert.ok((await invalid.text()).includes("match"));
  assert.equal((await db.query('SELECT id FROM "User" WHERE email=$1', [email])).rowCount, 0);
  redirectedTo(await form("/register", registration), "/login");
  const stored = (await db.query('SELECT id, "passwordHash" FROM "User" WHERE email=$1', [email])).rows[0];
  assert.ok(stored && stored.passwordHash !== password);
  assert.ok(await compare(password, stored.passwordHash));
  const duplicate = await form("/register", registration);
  assert.equal(duplicate.status, 200);
  assert.ok((await duplicate.text()).includes("Unable to create this account"));
  const wrong = await form("/login", { email, password: "incorrect-password-123" });
  assert.equal(wrong.status, 200);
  assert.ok((await wrong.text()).includes("Unable to sign in"));
  redirectedTo(await form("/login", { email: email.toUpperCase(), password }), "/dashboard");
  assert.equal((await request("/dashboard")).status, 200);
  const session = await request("/api/auth/session");
  assert.equal((await session.json()).user.id, stored.id);
  assert.ok(cookies.has("authjs.session-token"));
  const refreshed = await request("/api/auth/session");
  assert.equal((await refreshed.json()).user.id, stored.id);
  redirectedTo(await form("/dashboard", {}), "/");
  assert.ok(!cookies.has("authjs.session-token"));
  assert.deepEqual(await (await request("/api/auth/session")).json(), null);
  redirectedTo(await request("/dashboard/new"), "/login");
  console.log("PASS registration, confirmation validation, duplicate account, bcrypt storage, wrong-password rejection, real Credentials login, session refresh, logout, and protected routes.");
} finally {
  await db.query('DELETE FROM "User" WHERE email=$1 AND name=$2', [email, "Synthetic Portfolio Audit"]);
  const keys = ["login", "register"].map((operation) => createHash("sha256").update(`${operation}:${email}`).digest("hex"));
  await db.query('DELETE FROM "AuthThrottle" WHERE key = ANY($1::text[])', [keys]);
  await db.end();
  console.log("Removed only this authentication test's temporary account and throttle entries.");
}
