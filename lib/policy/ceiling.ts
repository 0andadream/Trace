import type { TreasuryRequest } from "@/types";

export function maxTxAmountUsdc() {
  const n = Number(process.env.MAX_TX_AMOUNT_USDC ?? 25);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

export function usdEstimate(request: Pick<TreasuryRequest, "token" | "amount">) {
  const token = (request.token || "").trim().toUpperCase();
  if (token === "ETH" || token === "WETH" || token === "NATIVE") {
    const ethUsd = Number(process.env.ETH_USD ?? 2000);
    return request.amount * (Number.isFinite(ethUsd) && ethUsd > 0 ? ethUsd : 2000);
  }
  return request.amount;
}

export function ceilingCheck(request: Pick<TreasuryRequest, "token" | "amount">) {
  const max = maxTxAmountUsdc();
  const usd = usdEstimate(request);
  const blocked = usd > max;
  return {
    blocked,
    max,
    usd,
    reason: blocked
      ? `Requested ~$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })} exceeds MAX_TX_AMOUNT_USDC ($${max}). Ceiling block is independent of risk score and memory.`
      : `Under ceiling ($${max}).`,
  };
}
