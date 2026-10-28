// Configuration preflight: prints variable names/statuses, never secret values.
// This does not call OpenAI, connect to a database, or change configuration.
import dotenv from "dotenv";
dotenv.config({ quiet: true });
const preparedOnly = process.argv.includes("--prepared");
const placeholder = (value) => !value || /YOUR[_-]|REPLACE_|PASTE_|USER:PASSWORD/.test(value);
let failed = false;
function check(name, valid, required = true) {
  console.log(`${valid ? "PASS" : required ? "FAIL" : "NOTICE"} ${name}${!valid ? ": missing, placeholder, or invalid" : ": configured"}`);
  if (!valid && required) failed = true;
}
for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  const value = process.env[name];
  let valid = !placeholder(value);
  try {
    const url = new URL(value);
    valid &&= ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname && url.username && url.password && url.pathname.length > 1);
    // Neon requires encrypted connections. Preserve the supplied Neon options.
    if (url.hostname.endsWith(".neon.tech")) valid &&= ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"));
  } catch { valid = false; }
  check(name, valid);
}
check("AUTH_SECRET", !placeholder(process.env.AUTH_SECRET) && Buffer.byteLength(process.env.AUTH_SECRET || "") >= 32);
if (process.env.AUTH_URL) {
  let valid = false;
  try {
    const url = new URL(process.env.AUTH_URL);
    valid = url.protocol === "https:" || url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (process.env.VERCEL) valid &&= url.protocol === "https:";
  } catch { /* Only status is reported. */ }
  check("AUTH_URL", valid);
} else console.log("NOTICE AUTH_URL: unset; Auth.js must infer the trusted deployment host.");
const key = process.env.OPENAI_API_KEY?.trim();
check("OPENAI_API_KEY", !placeholder(key) && !/^["']|["']$|[\r\n]|^OPENAI_API_KEY\s*=/.test(key || ""), !preparedOnly);
console.log("NOTICE OPENAI_MODEL: configured value or existing default; provider access/model availability still require a live synthetic test.");
console.log(failed ? "Configuration preflight failed. See README.md; no values were printed." : "Configuration preflight passed for the selected mode; runtime/deployment tests are still required.");
process.exitCode = failed ? 1 : 0;
