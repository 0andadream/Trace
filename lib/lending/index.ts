/**
 * Lending agent on the Trace reputation layer.
 * USER_RELATIONSHIP (Sibyl) is primary. ONCHAIN_SIGNAL is fallback for new wallets.
 */
export { computeRateQuote, selectRateInputs } from "@/lib/lending/rate";
export { standingFromHistory, recomputeRelationship, emptyRelationship } from "@/lib/lending/relationship";
export { borrowCeilingCheck, maxBorrowAmount, minCollateralRatio } from "@/lib/lending/ceiling";
export { fetchOnchainSignal } from "@/lib/lending/onchain";
export { runQuote, runBorrow, runRepay, runSupply, lendingSnapshot } from "@/lib/lending/run";
