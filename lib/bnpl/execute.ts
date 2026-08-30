/**
 * Single source of truth for whether TRACE broadcasts Base Sepolia payouts.
 * sendMerchantPayout, Under the hood, and Agent infrastructure must all use this.
 */
export function payoutIsLive(raw = process.env.BASE_EXECUTE) {
  const v = (raw || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function settlementPayoutLabel(execute: boolean) {
  return execute ? "Live on Base Sepolia" : "Simulated on this testnet";
}
