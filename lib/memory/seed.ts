import {
  OKX_DEX_ROUTER,
  OPS_WALLET,
  REJECTED_A,
  REJECTED_B,
  TREASURY_VAULT,
  VENDOR_DESK,
} from "@/lib/counterparties";
import type { ActionRecord } from "@/types";

function rec(
  partial: Omit<ActionRecord, "seed" | "reasoning" | "userOverride" | "overrideDirection"> & {
    userOverride?: boolean;
    overrideDirection?: ActionRecord["overrideDirection"];
    reasoning?: string[];
  },
): ActionRecord {
  return {
    ...partial,
    seed: true,
    userOverride: partial.userOverride ?? false,
    overrideDirection: partial.overrideDirection ?? null,
    reasoning: partial.reasoning ?? [],
  };
}

const VAULT_AMOUNTS = [100, 150, 200, 250, 300, 350, 400, 450, 500, 500, 550, 600, 650, 700, 800, 900];

export const SEED_ACTIONS: ActionRecord[] = [
  ...VAULT_AMOUNTS.map((amount, i) =>
    rec({
      id: `seed-vault-${String(i + 1).padStart(2, "0")}`,
      at: new Date(Date.UTC(2026, 6, 15 + i, 14, 0, 0)).toISOString(),
      action: "transfer",
      token: i === 4 || i === 11 ? "USDC" : "USDT",
      amount,
      recipient: TREASURY_VAULT,
      counterpartyLabel: "Treasury Vault",
      outcome: "success",
      decision: "Proceed",
      riskScore: 0.08,
    }),
  ),
  rec({
    id: "seed-vendor-01",
    at: "2026-08-02T11:00:00.000Z",
    action: "transfer",
    token: "USDT",
    amount: 150,
    recipient: VENDOR_DESK,
    counterpartyLabel: "Vendor Desk",
    outcome: "success",
    decision: "Proceed",
    riskScore: 0.18,
  }),
  rec({
    id: "seed-vendor-02",
    at: "2026-08-06T11:00:00.000Z",
    action: "transfer",
    token: "USDT",
    amount: 180,
    recipient: VENDOR_DESK,
    counterpartyLabel: "Vendor Desk",
    outcome: "success",
    decision: "Proceed",
    riskScore: 0.16,
  }),
  rec({
    id: "seed-vendor-03",
    at: "2026-08-12T11:00:00.000Z",
    action: "transfer",
    token: "USDT",
    amount: 220,
    recipient: VENDOR_DESK,
    counterpartyLabel: "Vendor Desk",
    outcome: "success",
    decision: "Proceed",
    riskScore: 0.19,
  }),
  rec({
    id: "seed-swap-01",
    at: "2026-08-04T16:20:00.000Z",
    action: "swap",
    token: "USDT",
    amount: 400,
    recipient: OKX_DEX_ROUTER,
    counterpartyLabel: "OKX DEX Router",
    outcome: "success",
    decision: "Proceed",
    riskScore: 0.14,
  }),
  rec({
    id: "seed-swap-02",
    at: "2026-08-09T16:20:00.000Z",
    action: "swap",
    token: "USDC",
    amount: 600,
    recipient: OKX_DEX_ROUTER,
    counterpartyLabel: "OKX DEX Router",
    outcome: "success",
    decision: "Proceed",
    riskScore: 0.15,
  }),
  rec({
    id: "seed-reject-a",
    at: "2026-08-08T09:10:00.000Z",
    action: "transfer",
    token: "USDT",
    amount: 800,
    recipient: REJECTED_A,
    counterpartyLabel: "Rejected recipient A",
    outcome: "rejected",
    decision: "Hold for approval",
    riskScore: 0.72,
    reasoning: [
      "No prior interactions with this counterparty.",
      "Agent history includes 0 successful sends to unverified recipients at the time of this hold.",
      "User confirmation was not granted; recorded as rejected.",
    ],
  }),
  rec({
    id: "seed-reject-b",
    at: "2026-08-14T09:10:00.000Z",
    action: "transfer",
    token: "USDT",
    amount: 1200,
    recipient: REJECTED_B,
    counterpartyLabel: "Rejected recipient B",
    outcome: "rejected",
    decision: "Hold for approval",
    riskScore: 0.74,
    reasoning: [
      "No prior interactions with this counterparty.",
      "Similar unverified recipients were rejected in 1 previous case.",
      "User confirmation was not granted; recorded as rejected.",
    ],
  }),
  rec({
    id: "seed-override-ops",
    at: "2026-08-16T13:40:00.000Z",
    action: "transfer",
    token: "USDT",
    amount: 250,
    recipient: OPS_WALLET,
    counterpartyLabel: "Ops Wallet",
    outcome: "success",
    decision: "Hold for approval",
    riskScore: 0.64,
    userOverride: true,
    overrideDirection: "approved",
    reasoning: [
      "No prior interactions with this counterparty at decision time.",
      "User overrode the Hold and approved the transfer.",
      "Recorded as a successful user override.",
    ],
  }),
];
