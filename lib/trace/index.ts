/**
 * Trace is the reusable reputation / memory layer.
 * Alex (BNPL: lib/bnpl; treasury: lib/agent, lib/desk, lib/base) consumes it.
 *
 * Persistence: Sibyl Memory (lib/memory).
 * BNPL terms: lib/bnpl/policy.ts — USER_RELATIONSHIP primary, ONCHAIN_SIGNAL only when total_purchases == 0.
 */
export { buildCounterpartyProfile, buildReputation, listCounterparties } from "@/lib/memory/derive";
export { computeRiskScore } from "@/lib/risk/score";
export { decideFromScore } from "@/lib/policy/decide";
export { ceilingCheck } from "@/lib/policy/ceiling";
export { computeApproval, selectPolicyInputs } from "@/lib/bnpl/policy";
export { standingFromHistory, recomputeRelationship } from "@/lib/bnpl/relationship";
export { purchaseCeilingCheck } from "@/lib/bnpl/ceiling";
