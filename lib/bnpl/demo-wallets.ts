/** Seeded demo wallets. Quote-as addresses for judges, not funded keys. */
import { recomputeRelationship } from "@/lib/bnpl/relationship";
import type { PurchaseRecord, UserRelationship } from "@/types/bnpl";

export const CLEAN_BUYER = "0x111111111111111111111111111111111111c1ea";
export const PENALIZED_BUYER = "0x222222222222222222222222222222222222d00d";

function paid(amount: number, due: string, paidAt: string, status: "on_time" | "late"): PurchaseRecord["schedule"][number] {
  return { amount, due_date: due, paid_date: paidAt, status };
}

function cleanPurchases(): PurchaseRecord[] {
  return [
    {
      purchase_id: "buy-clean-1",
      amount: 12,
      merchant: "Test Shop",
      installments: 2,
      approved_date: "2026-04-01T12:00:00.000Z",
      schedule: [
        paid(6, "2026-04-15T12:00:00.000Z", "2026-04-14T09:00:00.000Z", "on_time"),
        paid(6, "2026-04-29T12:00:00.000Z", "2026-04-28T11:00:00.000Z", "on_time"),
      ],
      outcome: "completed_on_time",
    },
    {
      purchase_id: "buy-clean-2",
      amount: 18,
      merchant: "Test Shop",
      installments: 3,
      approved_date: "2026-05-01T12:00:00.000Z",
      schedule: [
        paid(6, "2026-05-15T12:00:00.000Z", "2026-05-14T10:00:00.000Z", "on_time"),
        paid(6, "2026-05-29T12:00:00.000Z", "2026-05-28T10:00:00.000Z", "on_time"),
        paid(6, "2026-06-12T12:00:00.000Z", "2026-06-10T10:00:00.000Z", "on_time"),
      ],
      outcome: "completed_on_time",
    },
    {
      purchase_id: "buy-clean-3",
      amount: 24,
      merchant: "Test Shop",
      installments: 4,
      approved_date: "2026-06-15T12:00:00.000Z",
      schedule: [
        paid(6, "2026-06-29T12:00:00.000Z", "2026-06-28T10:00:00.000Z", "on_time"),
        paid(6, "2026-07-13T12:00:00.000Z", "2026-07-12T10:00:00.000Z", "on_time"),
        paid(6, "2026-07-27T12:00:00.000Z", "2026-07-26T10:00:00.000Z", "on_time"),
        paid(6, "2026-08-10T12:00:00.000Z", "2026-08-09T10:00:00.000Z", "on_time"),
      ],
      outcome: "completed_on_time",
    },
  ];
}

function penalizedPurchases(): PurchaseRecord[] {
  return [
    {
      purchase_id: "buy-pen-1",
      amount: 20,
      merchant: "Test Shop",
      installments: 2,
      approved_date: "2026-04-01T12:00:00.000Z",
      schedule: [
        paid(10, "2026-04-15T12:00:00.000Z", "2026-04-14T12:00:00.000Z", "on_time"),
        paid(10, "2026-04-29T12:00:00.000Z", "2026-04-28T12:00:00.000Z", "on_time"),
      ],
      outcome: "completed_on_time",
    },
    {
      purchase_id: "buy-pen-2",
      amount: 24,
      merchant: "Test Shop",
      installments: 2,
      approved_date: "2026-05-01T12:00:00.000Z",
      schedule: [
        paid(12, "2026-05-15T12:00:00.000Z", "2026-05-20T12:00:00.000Z", "late"),
        paid(12, "2026-05-29T12:00:00.000Z", "2026-06-04T12:00:00.000Z", "late"),
      ],
      outcome: "completed_late",
    },
    {
      purchase_id: "buy-pen-3",
      amount: 30,
      merchant: "Test Shop",
      installments: 3,
      approved_date: "2026-06-01T12:00:00.000Z",
      schedule: [
        paid(10, "2026-06-15T12:00:00.000Z", "2026-06-14T12:00:00.000Z", "on_time"),
        { amount: 10, due_date: "2026-06-29T12:00:00.000Z", paid_date: null, status: "pending" },
        { amount: 10, due_date: "2026-07-13T12:00:00.000Z", paid_date: null, status: "pending" },
      ],
      outcome: "defaulted",
    },
  ];
}

function book(wallet: string, purchases: PurchaseRecord[], first: string, last: string): UserRelationship {
  return recomputeRelationship({
    wallet_address: wallet,
    first_seen: first,
    last_seen: last,
    purchases,
    quotes: [],
    total_purchases: 0,
    on_time_count: 0,
    late_count: 0,
    default_count: 0,
    active_count: 0,
    total_purchased: 0,
    total_repaid: 0,
    override_count: 0,
    override_outcomes: [],
    snapshot: {
      last_outcome: null,
      open_plans: 0,
      standing: 0,
      trust_note: "No history with this agent.",
    },
    current_limit: 0,
    current_standing_score: 0,
  });
}

/** Contrasting books always visible in the public log: clean vs late/defaulted. */
export function demoBooks(): UserRelationship[] {
  return [
    book(CLEAN_BUYER, cleanPurchases(), "2026-04-01T12:00:00.000Z", "2026-07-14T16:00:00.000Z"),
    book(PENALIZED_BUYER, penalizedPurchases(), "2026-04-01T12:00:00.000Z", "2026-06-20T12:00:00.000Z"),
  ];
}
