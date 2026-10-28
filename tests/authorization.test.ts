import test from "node:test";
import assert from "node:assert/strict";
import { findOwnedAnalysis } from "../src/lib/owned-analysis";

const records = [{ id: "record-a", userId: "user-a", note: "Fictional A" }, { id: "record-b", userId: "user-b", note: "Fictional B" }];
const fetchRecord = async (where: { id: string; userId: string }) => records.find((record) => record.id === where.id && record.userId === where.userId) ?? null;
test("owner can read a saved analysis", async () => {
  assert.equal((await findOwnedAnalysis(fetchRecord, "user-a", "record-a"))?.note, "Fictional A");
});
test("another user's direct record ID is not accessible", async () => {
  assert.equal(await findOwnedAnalysis(fetchRecord, "user-a", "record-b"), null);
  assert.equal(await findOwnedAnalysis(fetchRecord, "user-b", "record-a"), null);
});
test("missing identity never reaches the database reader", async () => {
  let called = false;
  const read = async () => { called = true; return records[0]; };
  assert.equal(await findOwnedAnalysis(read, null, "record-a"), null);
  assert.equal(called, false);
});
test("query is bound to session identity and a mismatching returned owner is denied", async () => {
  let captured: unknown;
  const read = async (where: { id: string; userId: string }) => { captured = where; return records[1]; };
  assert.equal(await findOwnedAnalysis(read, "user-a", "record-b"), null);
  assert.deepEqual(captured, { id: "record-b", userId: "user-a" });
});
