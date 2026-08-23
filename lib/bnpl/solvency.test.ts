import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyOnchainSignal } from "@/lib/bnpl/onchain";
import { computeApproval } from "@/lib/bnpl/policy";
import { emptyRelationship, recomputeRelationship } from "@/lib/bnpl/relationship";
import { agentOutstandingExposure, solvencyCheck, type SolvencySnapshot } from "@/lib/bnpl/solvency";
import type { PurchaseRecord, UserRelationship } from "@/types/bnpl";

const CLEAN = "0x111111111111111111111111111111111111c1ea";
const WHALE = emptyOnchainSignal(CLEAN, { wallet_age_days: 2000, tx_count: 50_000 });

function snap(partial: Partial<SolvencySnapshot> = {}): SolvencySnapshot {
  return {
    wallet_usdc: 100,
    wallet_eth: 0,
    spendable_usd: 100,
    exposure: 0,
    reserve: 5,
    execute: false,
    simulated_balance: true,
    ...partial,
  };
}

function withActive(amount: number): UserRelationship {
  const p: PurchaseRecord = {
    purchase_id: "open-1",
    amount,
    merchant: "Demo Shop",
    installments: 1,
    approved_date: "2026-04-01T00:00:00.000Z",
    schedule: [{ amount, due_date: "2026-04-15T00:00:00.000Z", paid_date: null, status: "pending" }],
    outcome: "active",
    payout_mode: "simulated",
    payout_amount: amount,
    payout_date: "2026-04-01T00:00:00.000Z",
    payout_tx_hash: null,
    payout_to: "0x00000000000000000000000000000000000000b1",
  };
  return recomputeRelationship({ ...emptyRelationship(CLEAN), purchases: [p] });
}

describe("agent solvency ceiling", () => {
  it("declines when payout would breach MIN_AGENT_RESERVE, ignoring a clean book", () => {
    const cleanBook = recomputeRelationship({
      ...emptyRelationship(CLEAN),
      purchases: [
        {
          purchase_id: "p1",
          amount: 12,
          merchant: "Northwind",
          installments: 1,
          approved_date: "2026-04-01T00:00:00.000Z",
          schedule: [
            {
              amount: 12,
              due_date: "2026-04-08T00:00:00.000Z",
              paid_date: "2026-04-07T00:00:00.000Z",
              status: "on_time",
              repayment_kind: "attested",
            },
          ],
          outcome: "completed_on_time",
        },
      ],
    });
    const q = computeApproval({
      amount: 12,
      relationship: cleanBook,
      onchain: WHALE,
      solvency: snap({ spendable_usd: 10, wallet_usdc: 10, reserve: 10, execute: false, exposure: 0 }),
    });
    assert.equal(q.decision, "Decline");
    assert.equal(q.outcome, "insolvent_declined");
    assert.equal(q.skipped_scoring, true);
    assert.equal(q.used_onchain, false);
    assert.match(q.ceiling.reason, /MIN_AGENT_RESERVE/);
    assert.match(q.ceiling.reason, /User reputation was not used/);
  });

  it("does not insolvency-decline when deployable cash covers the payout", () => {
    const rel = emptyRelationship("0x3333333333333333333333333333333333333333");
    const q = computeApproval({
      amount: 12,
      relationship: rel,
      onchain: emptyOnchainSignal(rel.wallet_address, { wallet_age_days: 40, tx_count: 12 }),
      solvency: snap({ spendable_usd: 100, reserve: 5, exposure: 0 }),
    });
    assert.notEqual(q.outcome, "insolvent_declined");
    assert.notEqual(q.decision, "Decline");
  });

  it("simulated mode counts existing exposure against the same wallet figure", () => {
    const check = solvencyCheck(
      12,
      snap({ spendable_usd: 20, reserve: 5, exposure: 10, execute: false, simulated_balance: true }),
    );
    // effective cash = 20 - 10 = 10; after 12 → -2 < 5
    assert.equal(check.blocked, true);
    assert.equal(check.outcome, "insolvent_declined");
  });

  it("execute mode does not double-count exposure already reflected in the wallet", () => {
    const check = solvencyCheck(
      12,
      snap({ spendable_usd: 20, reserve: 5, exposure: 80, execute: true, simulated_balance: false }),
    );
    // cash 20 - 12 = 8 >= 5
    assert.equal(check.blocked, false);
  });
});

describe("outstanding exposure book", () => {
  it("sums unpaid active plans across users", () => {
    const a = withActive(12);
    const b = withActive(20);
    assert.equal(agentOutstandingExposure([a, b]), 32);
  });
});
