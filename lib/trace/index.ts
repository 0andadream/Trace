/**
 * Trace is the reusable reputation / memory layer.
 * Alex (lending: lib/lending; treasury: lib/agent, lib/desk, lib/base) consumes it.
 *
 * Persistence: Sibyl Memory (lib/memory).
 * Lending rate: lib/lending/rate.ts — USER_RELATIONSHIP primary, ONCHAIN_SIGNAL only when total_loans == 0.
 */
export { buildCounterpartyProfile, buildReputation, listCounterparties } from "@/lib/memory/derive";
export { computeRiskScore } from "@/lib/risk/score";
export { decideFromScore } from "@/lib/policy/decide";
export { ceilingCheck } from "@/lib/policy/ceiling";
export { computeRateQuote, selectRateInputs } from "@/lib/lending/rate";
export { standingFromHistory, recomputeRelationship } from "@/lib/lending/relationship";
export { borrowCeilingCheck } from "@/lib/lending/ceiling";
