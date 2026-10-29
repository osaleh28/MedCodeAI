// Recalculate one explicitly selected saved analysis using its existing AI
// extraction. No new provider request, note changes, or batch updates.
// Run npm test to compile the current rule engine before using this script.
import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { evaluateMdm, RULE_VERSION } from "../.npm-cache/unit-tests/src/lib/clinical/mdm.js";
import { reportSchema } from "../.npm-cache/unit-tests/src/lib/clinical/report.js";
dotenv.config({ quiet: true });
const args = process.argv.slice(2);
const [id] = args;
assert.ok(id && /^[a-zA-Z0-9_-]{1,128}$/.test(id) && args.slice(1).every((arg) => arg === "--apply"), "Usage: node scripts/reassess-analysis.mjs <analysis-id> [--apply]");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
const summarize = (mdm) => ({ ruleVersion: mdm.ruleVersion, data: { level: mdm.data.level, minimum: mdm.data.minimum, maximum: mdm.data.maximum, credited: mdm.data.credited.length, excluded: mdm.data.excluded.length }, overall: mdm.overall, potentialCode: mdm.potentialCode, minimumSupportedCode: mdm.minimumSupportedCode });
try {
  await db.connect();
  const { rows } = await db.query('SELECT id, "syntheticNote", "noteType", "structuredAnalysis" FROM "BillingAnalysis" WHERE id=$1', [id]);
  assert.equal(rows.length, 1, "The selected saved analysis was not found.");
  const record = rows[0], previous = reportSchema.parse(record.structuredAnalysis);
  assert.ok(["admission", "progress"].includes(record.noteType), "Explicit encounter type required.");
  if (previous.mdm.ruleVersion === RULE_VERSION) {
    console.log(JSON.stringify({ id, status: "already current", assessment: summarize(previous.mdm) }));
  } else {
    const mdm = evaluateMdm(previous.extraction, record.syntheticNote, record.noteType);
    const updatedReport = { ...record.structuredAnalysis, mdm, previousMdmAssessments: [...(previous.previousMdmAssessments ?? []), previous.mdm] };
    reportSchema.parse(updatedReport);
    console.log(JSON.stringify({ id, apply: args.includes("--apply"), before: summarize(previous.mdm), after: summarize(mdm) }));
    if (args.includes("--apply")) {
      const result = await db.query(`UPDATE "BillingAnalysis" SET "structuredAnalysis"=$2::jsonb, "problemsComplexity"=$3, "dataComplexity"=$4, "riskComplexity"=$5, "mdmComplexity"=$6, "suggestedCptCode"=$7, rationale=$8, "updatedAt"=NOW() WHERE id=$1 AND "structuredAnalysis"=$9::jsonb AND "syntheticNote"=$10 AND "noteType"=$11`, [
        id, JSON.stringify(updatedReport), mdm.problems.level ?? "Indeterminate", mdm.data.level ?? "Indeterminate", mdm.risk.level ?? "Indeterminate", mdm.overall ?? (mdm.minimumSupportedCode ? `At least ${mdm.minimum}` : "Indeterminate"), mdm.potentialCode ?? mdm.minimumSupportedCode, mdm.explanation, JSON.stringify(record.structuredAnalysis), record.syntheticNote, record.noteType,
      ]);
      assert.equal(result.rowCount, 1, "The analysis changed during review; no update was applied. Review again.");
      console.log("Saved assessment recalculated; previous MDM retained. No OpenAI request was made.");
    }
  }
} finally { await db.end(); }
