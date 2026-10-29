import "server-only";
import { getDb } from "@/lib/db";
import { reserveBudget, settleBudget, type Reservation } from "./clinical/usage-budget";

export function reserveAiUsage(userId: string, includeHpi: boolean) {
  return getDb().$transaction((tx) => reserveBudget(tx, userId, includeHpi), { maxWait: 5_000, timeout: 10_000 });
}
export function settleAiUsage(reservation: Reservation, cost: number, inputTokens: number, outputTokens: number) {
  return getDb().$transaction((tx) => settleBudget(tx, reservation, cost, inputTokens, outputTokens), { maxWait: 5_000, timeout: 10_000 });
}
