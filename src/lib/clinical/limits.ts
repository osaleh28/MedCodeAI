// Shared by browser validation, provider transport, and the database budget.
export const MAX_NOTE_CHARACTERS = 12_000;
export const MAX_INPUT_TOKENS = 20_000;
export const ANALYSIS_OUTPUT_TOKENS = 6_500;
export const HPI_OUTPUT_TOKENS = 2_000;
export const LIVE_ANALYSES_PER_DAY = 10;
export const DAILY_BUDGET_MICROS = 1_000_000;
export const MONTHLY_BUDGET_MICROS = 20_000_000;

// USD microdollars; uncached GPT-4.1 mini rates verified 2026-10-29.
// A different model must have reviewed pricing before it can make live calls.
export const BUDGET_MODELS = ["gpt-4.1-mini", "gpt-4.1-mini-2025-04-14"] as const;
export function tokenCostMicros(input: number, output: number) {
  return Math.ceil((input * 4 + output * 16) / 10);
}
export function maximumAnalysisCostMicros(includeHpi: boolean) {
  return tokenCostMicros(MAX_INPUT_TOKENS, ANALYSIS_OUTPUT_TOKENS)
    + (includeHpi ? tokenCostMicros(MAX_INPUT_TOKENS, HPI_OUTPUT_TOKENS) : 0);
}

export class UsageLimitError extends Error {
  constructor(message: string, public readonly retryAfter = 60) { super(message); this.name = "UsageLimitError"; }
}
