import { FRESH_WALLET, TREASURY_VAULT } from "@/lib/counterparties";
import type { TreasuryRequest } from "@/types";

export const SCENARIOS: Record<"typical" | "oversized" | "unknown", TreasuryRequest> = {
  typical: {
    scenario: "typical",
    action: "transfer",
    token: "USDT",
    amount: 500,
    recipient: TREASURY_VAULT,
    note: "Routine settlement to the treasury vault.",
  },
  oversized: {
    scenario: "oversized",
    action: "transfer",
    token: "USDT",
    amount: 2400,
    recipient: TREASURY_VAULT,
    note: "Same vault, amount well above historical average.",
  },
  unknown: {
    scenario: "unknown",
    action: "transfer",
    token: "USDT",
    amount: 400,
    recipient: FRESH_WALLET,
    note: "New unlabeled recipient. No counterparty profile.",
  },
};

export function requestFromBody(body: Partial<TreasuryRequest>): TreasuryRequest {
  if (body.scenario && body.scenario !== "custom" && SCENARIOS[body.scenario]) {
    return { ...SCENARIOS[body.scenario] };
  }
  return {
    scenario: "custom",
    action: body.action || "transfer",
    token: (body.token || "USDT").toUpperCase(),
    amount: Number(body.amount ?? 0),
    recipient: (body.recipient || "").trim() || TREASURY_VAULT,
    note: body.note,
  };
}
