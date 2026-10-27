import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";

// Database-backed so limits also apply across Vercel instances. Expired windows
// are reused; no passwords or raw email addresses are written to this table.
export async function allowAuthAttempt(email: string, operation: "login" | "register") {
  const key = createHash("sha256").update(`${operation}:${email}`).digest("hex");
  const rows = await getDb().$queryRaw<{ attempts: number }[]>`
    INSERT INTO "AuthThrottle" ("key", "attempts", "windowStart")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AuthThrottle"."windowStart" < NOW() - INTERVAL '15 minutes'
        THEN 1 ELSE "AuthThrottle"."attempts" + 1 END,
      "windowStart" = CASE WHEN "AuthThrottle"."windowStart" < NOW() - INTERVAL '15 minutes'
        THEN NOW() ELSE "AuthThrottle"."windowStart" END
    RETURNING "attempts"
  `;
  return rows[0].attempts <= (operation === "login" ? 10 : 5);
}
