/**
 * BNPL agent on the Trace reputation layer.
 * USER_RELATIONSHIP (Sibyl) is primary. ONCHAIN_SIGNAL is fallback for new wallets.
 */
export { computeApproval, selectPolicyInputs } from "@/lib/bnpl/policy";
export {
  standingFromHistory,
  standingBreakdown,
  recomputeRelationship,
  emptyRelationship,
} from "@/lib/bnpl/relationship";
export { purchaseCeilingCheck, maxPurchaseAmount, maxActivePlans } from "@/lib/bnpl/ceiling";
export { fetchOnchainSignal } from "@/lib/bnpl/onchain";
export { runPurchaseQuote, runAcceptPurchase, runRepayInstallment, bnplSnapshot } from "@/lib/bnpl/run";
export { solvencyCheck, minAgentReserve, agentOutstandingExposure } from "@/lib/bnpl/solvency";
