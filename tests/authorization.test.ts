import test from "node:test";
import assert from "node:assert/strict";
import { deleteOwnedAnalysis, findOwnedAnalysis } from "../src/lib/owned-analysis";

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

test("deletion is scoped to the session owner; foreign IDs leave records untouched", async () => {
  const remaining = [...records];
  const remove = async (where: { id: string; userId: string }) => {
    const index = remaining.findIndex((record) => record.id === where.id && record.userId === where.userId);
    if (index < 0) return { count: 0 };
    remaining.splice(index, 1);
    return { count: 1 };
  };
  assert.equal(await deleteOwnedAnalysis(remove, "user-a", "record-b"), false);
  assert.deepEqual(remaining, records);
  assert.equal(await deleteOwnedAnalysis(remove, "user-a", "record-a"), true);
  assert.deepEqual(remaining, [records[1]]);
  assert.equal(await deleteOwnedAnalysis(remove, "user-a", "record-a"), false);
});

test("missing identity and invalid IDs cannot reach the database deleter", async () => {
  let called = false;
  const remove = async () => { called = true; return { count: 1 }; };
  for (const [userId, id] of [[null, "record-a"], [undefined, "record-a"], ["user-a", ""], ["user-a", "a".repeat(129)]] as const) assert.equal(await deleteOwnedAnalysis(remove, userId, id), false);
  assert.equal(called, false);
});
