/**
 * Trace is the reusable reputation / memory layer.
 * Alex (lib/agent, lib/desk, lib/base) is the first agent that consumes it.
 *
 * Persistence: Sibyl Memory (lib/memory).
 * Scoring: lib/risk/score.ts
 * Decision cutoffs: lib/policy/decide.ts (0.30 / 0.60)
 */
export { buildCounterpartyProfile, buildReputation, listCounterparties } from "@/lib/memory/derive";
export { computeRiskScore } from "@/lib/risk/score";
export { decideFromScore } from "@/lib/policy/decide";
export { ceilingCheck } from "@/lib/policy/ceiling";
