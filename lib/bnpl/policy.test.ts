import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyOnchainSignal } from "@/lib/bnpl/onchain";
import { computeApproval, selectPolicyInputs } from "@/lib/bnpl/policy";
import { emptyRelationship, recomputeRelationship, standingFromHistory } from "@/lib/bnpl/relationship";
import { enforceBnplVerdict, parseBnplOutput } from "@/lib/bnpl/reason";
import type { PurchaseRecord, UserRelationship } from "@/types/bnpl";

const CLEAN = "0x111111111111111111111111111111111111c1ea";
const NEW = "0x3333333333333333333333333333333333333333";

function paid(amount: number, status: "on_time" | "late") {
  return {
    amount,
    due_date: "2026-04-15T00:00:00.000Z",
    paid_date: status === "on_time" ? "2026-04-14T00:00:00.000Z" : "2026-04-20T00:00:00.000Z",
    status,
  };
}

function purchase(
  partial: Partial<PurchaseRecord> & Pick<PurchaseRecord, "purchase_id" | "outcome">,
): PurchaseRecord {
  const amount = partial.amount ?? 12;
  const n = partial.installments ?? 2;
  const each = amount / n;
  return {
    merchant: "Demo Shop",
    amount,
    installments: n,
    approved_date: "2026-04-01T00:00:00.000Z",
    schedule:
      partial.schedule ??
      (partial.outcome === "active"
        ? [
            { amount: each, due_date: "2026-04-15T00:00:00.000Z", paid_date: null, status: "pending" },
            { amount: each, due_date: "2026-04-29T00:00:00.000Z", paid_date: null, status: "pending" },
          ]
        : Array.from({ length: n }, () =>
            paid(each, partial.outcome === "completed_late" ? "late" : "on_time"),
          )),
    ...partial,
  };
}

function withPurchases(wallet: string, purchases: PurchaseRecord[]): UserRelationship {
  return recomputeRelationship({
    ...emptyRelationship(wallet, "2026-04-01T00:00:00.000Z"),
    purchases,
  });
}

const WHALE = emptyOnchainSignal(CLEAN, { wallet_age_days: 2000, tx_count: 50_000 });
const GHOST = emptyOnchainSignal(CLEAN, { wallet_age_days: 0, tx_count: 0 });
const MODERATE = emptyOnchainSignal(NEW, { wallet_age_days: 40, tx_count: 12 });

describe("BNPL memory primacy — on-chain is gated in code", () => {
  it("selectPolicyInputs drops ONCHAIN_SIGNAL once total_purchases > 0", () => {
    const rel = withPurchases(CLEAN, [purchase({ purchase_id: "p1", outcome: "completed_on_time" })]);
    const selected = selectPolicyInputs(rel, WHALE);
    assert.equal(selected.primary, "USER_RELATIONSHIP");
    assert.equal(selected.used_onchain, false);
    assert.equal(selected.onchain, null);
    assert.equal(selected.relationship_empty, false);
  });

  it("selectPolicyInputs uses ONCHAIN_SIGNAL only when total_purchases == 0", () => {
    const rel = emptyRelationship(NEW);
    const selected = selectPolicyInputs(rel, MODERATE);
    assert.equal(selected.primary, "ONCHAIN_SIGNAL");
    assert.equal(selected.used_onchain, true);
    assert.equal(selected.onchain?.tx_count, 12);
  });

  it("a whale on-chain signal cannot change terms once a relationship exists", () => {
    const rel = withPurchases(CLEAN, [
      purchase({ purchase_id: "p1", amount: 12, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", amount: 18, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p3", amount: 24, outcome: "completed_on_time" }),
    ]);
    const withWhale = computeApproval({ amount: 12, relationship: rel, onchain: WHALE });
    const withGhost = computeApproval({ amount: 12, relationship: rel, onchain: GHOST });
    assert.equal(withWhale.used_onchain, false);
    assert.equal(withGhost.used_onchain, false);
    assert.equal(withWhale.limit, withGhost.limit);
    assert.equal(withWhale.installments, withGhost.installments);
    assert.equal(withWhale.decision, withGhost.decision);
    assert.equal(withWhale.primary_signal, "USER_RELATIONSHIP");
  });

  it("on-chain DOES change terms when USER_RELATIONSHIP is empty", () => {
    const rel = emptyRelationship(NEW);
    const thin = computeApproval({ amount: 12, relationship: rel, onchain: GHOST });
    const rich = computeApproval({ amount: 12, relationship: rel, onchain: WHALE });
    assert.equal(thin.used_onchain, true);
    assert.ok(thin.limit < rich.limit);
    assert.ok(thin.factors.some((f) => /No purchase history exists/.test(f.detail)));
  });
});

describe("APPROVAL_POLICY", () => {
  it("clean multi-purchase history beats any on-chain baseline", () => {
    const clean = withPurchases(CLEAN, [
      purchase({ purchase_id: "p1", amount: 12, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", amount: 18, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p3", amount: 24, outcome: "completed_on_time" }),
    ]);
    const relQuote = computeApproval({ amount: 12, relationship: clean, onchain: WHALE });
    const newQuote = computeApproval({
      amount: 12,
      relationship: emptyRelationship(NEW),
      onchain: WHALE,
    });
    assert.equal(relQuote.decision, "Approve");
    assert.ok(relQuote.limit > newQuote.limit);
    assert.ok(relQuote.installments > newQuote.installments);
    assert.equal(relQuote.used_onchain, false);
    assert.equal(newQuote.installments, 2);
  });

  it("a single default has an outsized effect despite decent volume", () => {
    const penalized = withPurchases(CLEAN, [
      purchase({ purchase_id: "p1", amount: 20, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", amount: 24, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p3", amount: 30, outcome: "defaulted" }),
    ]);
    const q = computeApproval({ amount: 12, relationship: penalized, onchain: WHALE });
    const fresh = computeApproval({
      amount: 12,
      relationship: emptyRelationship(NEW),
      onchain: WHALE,
    });
    assert.ok(penalized.total_purchased > 50);
    assert.equal(penalized.current_standing_score, standingFromHistory(penalized));
    assert.ok(penalized.current_standing_score <= 0.12);
    assert.equal(q.decision, "Decline");
    assert.ok(
      q.limit < fresh.limit,
      `defaulted limit ${q.limit} should be below new-whale limit ${fresh.limit}`,
    );
    assert.equal(q.used_onchain, false);
  });

  it("one on-time purchase improves limit and plan length vs the same wallet's on-chain baseline", () => {
    const before = computeApproval({
      amount: 12,
      relationship: emptyRelationship(NEW),
      onchain: MODERATE,
    });
    const afterRel = withPurchases(NEW, [
      purchase({ purchase_id: "live-1", amount: 12, outcome: "completed_on_time" }),
    ]);
    const after = computeApproval({ amount: 12, relationship: afterRel, onchain: MODERATE });
    assert.equal(before.used_onchain, true);
    assert.equal(after.used_onchain, false);
    assert.ok(after.limit > before.limit);
    assert.ok(after.installments > before.installments);
    assert.ok(after.factors.some((f) => /ONCHAIN_SIGNAL not used/.test(f.detail)));
  });

  it("an open plan does not jump standing above the on-chain cap", () => {
    const open = withPurchases(NEW, [purchase({ purchase_id: "open-1", amount: 12, outcome: "active" })]);
    assert.equal(open.on_time_count, 0);
    assert.ok(open.current_standing_score <= 0.38);
  });

  it("score 50 is a $3k limit; scores below 50 stay under $3k", () => {
    process.env.MAX_PURCHASE_AMOUNT = "10000";
    const open = withPurchases(NEW, [purchase({ purchase_id: "open-1", amount: 12, outcome: "active" })]);
    const mid = withPurchases(
      CLEAN,
      Array.from({ length: 22 }, (_, i) =>
        purchase({ purchase_id: `mid-${i}`, amount: 12, outcome: "completed_on_time" }),
      ),
    );
    assert.ok(open.current_standing_score < 0.5);
    assert.ok(open.current_limit < 3000);
    assert.equal(mid.current_standing_score, 0.5);
    assert.equal(mid.current_limit, 3000);
  });

  it("score 95 unlocks the $10k purchase ceiling", () => {
    process.env.MAX_PURCHASE_AMOUNT = "10000";
    const rel = withPurchases(
      CLEAN,
      Array.from({ length: 112 }, (_, i) =>
        purchase({ purchase_id: `top-${i}`, amount: 12, outcome: "completed_on_time" }),
      ),
    );
    assert.equal(rel.current_standing_score, 0.95);
    assert.equal(rel.current_limit, 10000);
    const q = computeApproval({ amount: 10000, relationship: rel, onchain: WHALE });
    assert.equal(q.decision, "Approve");
    assert.equal(q.limit, 10000);
    assert.equal(q.skipped_scoring, false);
  });

  it("standing rises slowly while limit still increases after on-time completions", () => {
    const open = withPurchases(NEW, [purchase({ purchase_id: "open-1", amount: 12, outcome: "active" })]);
    const one = withPurchases(NEW, [
      purchase({ purchase_id: "live-1", amount: 12, outcome: "completed_on_time" }),
    ]);
    const three = withPurchases(NEW, [
      purchase({ purchase_id: "p1", amount: 12, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", amount: 18, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p3", amount: 24, outcome: "completed_on_time" }),
    ]);
    assert.ok(
      one.current_standing_score - open.current_standing_score < 0.03,
      `standing jumped ${open.current_standing_score} → ${one.current_standing_score}`,
    );
    assert.ok(one.current_limit > open.current_limit);
    assert.ok(three.current_limit > one.current_limit);
    assert.ok(three.current_standing_score < 0.5);
    assert.ok(three.current_limit < 3000);
  });

  it("active outstanding reduces available limit for a new purchase", () => {
    const rel = withPurchases(CLEAN, [
      purchase({ purchase_id: "p1", amount: 12, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", amount: 20, installments: 2, outcome: "active" }),
    ]);
    const q = computeApproval({ amount: 12, relationship: rel, onchain: GHOST });
    assert.ok(q.outstanding > 0);
    assert.ok(q.available < q.limit);
    assert.ok(q.factors.some((f) => /outstanding/.test(f.detail)));
  });
});

describe("Trace interest and pay-in-full", () => {
  it("lower standing has higher interest", () => {
    const thin = computeApproval({
      amount: 12,
      relationship: emptyRelationship(NEW),
      onchain: GHOST,
    });
    const established = computeApproval({
      amount: 12,
      relationship: emptyRelationship(NEW),
      onchain: WHALE,
    });
    assert.ok(thin.interest_rate > established.interest_rate);
    assert.ok((thin.total_due || 0) > (thin.principal || 0));
  });

  it("pay_in_full is a single payment of principal plus interest", () => {
    const clean = withPurchases(CLEAN, [
      purchase({ purchase_id: "p1", amount: 12, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", amount: 18, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p3", amount: 24, outcome: "completed_on_time" }),
    ]);
    const q = computeApproval({ amount: 12, relationship: clean, onchain: WHALE, pay_in_full: true });
    assert.equal(q.installments, 1);
    assert.equal(q.pay_in_full, true);
    assert.ok((q.total_due || 0) >= 12);
  });

  it("relationship books can take up to 4 installments", () => {
    const clean = withPurchases(CLEAN, [
      purchase({ purchase_id: "p1", amount: 12, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", amount: 18, outcome: "completed_on_time" }),
      purchase({ purchase_id: "p3", amount: 24, outcome: "completed_on_time" }),
    ]);
    const q = computeApproval({ amount: 12, relationship: clean, onchain: WHALE });
    assert.equal(q.max_installments, 4);
    assert.equal(q.installments, 4);
  });
});

describe("hard ceilings", () => {
  it("MAX_PURCHASE_AMOUNT blocks before scoring", () => {
    process.env.MAX_PURCHASE_AMOUNT = "80";
    const clean = withPurchases(CLEAN, [
      purchase({ purchase_id: "p1", outcome: "completed_on_time" }),
      purchase({ purchase_id: "p2", outcome: "completed_on_time" }),
      purchase({ purchase_id: "p3", outcome: "completed_on_time" }),
    ]);
    const q = computeApproval({ amount: 81, relationship: clean, onchain: WHALE });
    assert.equal(q.decision, "Ceiling blocked");
    assert.equal(q.skipped_scoring, true);
    assert.equal(q.used_onchain, false);
    assert.match(q.ceiling.reason, /MAX_PURCHASE_AMOUNT/);
  });

  it("MAX_ACTIVE_PLANS blocks a new purchase before scoring", () => {
    process.env.MAX_ACTIVE_PLANS = "2";
    const rel = withPurchases(CLEAN, [
      purchase({ purchase_id: "a", outcome: "active" }),
      purchase({ purchase_id: "b", outcome: "active" }),
    ]);
    const q = computeApproval({ amount: 12, relationship: rel, onchain: WHALE });
    assert.equal(q.decision, "Ceiling blocked");
    assert.equal(q.skipped_scoring, true);
    assert.match(q.ceiling.reason, /MAX_ACTIVE_PLANS/);
  });
});

describe("LLM cannot change numeric output", () => {
  it("enforceBnplVerdict keeps code decision/terms even if the model lies", () => {
    const rel = withPurchases(CLEAN, [purchase({ purchase_id: "p1", outcome: "completed_on_time" })]);
    const terms = computeApproval({ amount: 12, relationship: rel, onchain: WHALE });
    const parsed = parseBnplOutput(
      `Decision: Decline\n\nReasoning:\n- Wallet age 2000 days, 50000 txs, whale.\n- I raised the limit to 10000.\n\nTerms: limit 10000 · 12 installments`,
    );
    const enforced = enforceBnplVerdict({
      parsed,
      terms,
      relationship: rel,
      onchain: WHALE,
      amount: 12,
      merchant: "Demo Shop",
      source: "grok-4.6",
      raw: "lie",
    });
    assert.equal(enforced.decision, terms.decision);
    assert.match(enforced.terms, new RegExp(String(terms.installments)));
    assert.ok(!enforced.reasoning.some((l) => /Wallet age|50000 txs/i.test(l)));
    assert.ok(enforced.reasoning.some((l) => /ONCHAIN_SIGNAL not used/i.test(l)));
  });

  it("empty relationship reasoning is forced into the output", () => {
    const rel = emptyRelationship(NEW);
    const terms = computeApproval({ amount: 12, relationship: rel, onchain: MODERATE });
    const enforced = enforceBnplVerdict({
      parsed: { decision: "Approve", reasoning: ["Looks fine."], terms: "Terms: limit 999" },
      terms,
      relationship: rel,
      onchain: MODERATE,
      amount: 12,
      merchant: "Demo Shop",
      source: "grok-4.6",
      raw: "",
    });
    assert.ok(enforced.reasoning.some((l) => /No purchase history exists/.test(l)));
    assert.equal(enforced.decision, terms.decision);
  });
});

describe("load-bearing sequence a–d (in memory)", () => {
  it("new → repay on time → better terms → reset-equivalent empty is back to on-chain", () => {
    const a = computeApproval({
      amount: 12,
      relationship: emptyRelationship(NEW),
      onchain: MODERATE,
    });
    assert.equal(a.used_onchain, true);
    assert.ok(a.factors.some((f) => /No purchase history exists/.test(f.detail)));
    const limitNew = a.limit;
    const nNew = a.installments;

    const after = withPurchases(NEW, [
      purchase({ purchase_id: "live-1", amount: 12, outcome: "completed_on_time" }),
    ]);
    const c = computeApproval({ amount: 12, relationship: after, onchain: MODERATE });
    assert.equal(c.used_onchain, false);
    assert.ok(c.limit > limitNew);
    assert.ok(c.installments > nNew);
    assert.ok(c.factors.some((f) => /ONCHAIN_SIGNAL not used/.test(f.detail)));

    const d = computeApproval({
      amount: 12,
      relationship: emptyRelationship(NEW),
      onchain: MODERATE,
    });
    assert.equal(d.limit, limitNew);
    assert.equal(d.installments, nNew);
    assert.equal(d.used_onchain, true);
  });
});
