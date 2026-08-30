import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyOnchainSignal } from "@/lib/lending/onchain";
import { emptyRelationship, recomputeRelationship, standingFromHistory } from "@/lib/lending/relationship";
import { computeRateQuote, selectRateInputs } from "@/lib/lending/rate";
import { enforceLendingVerdict, parseLendingOutput } from "@/lib/lending/reason";
import type { LoanRecord, UserRelationship } from "@/types/lending";

const CLEAN = "0x111111111111111111111111111111111111c1ea";
const NEW = "0x3333333333333333333333333333333333333333";

function loan(partial: Partial<LoanRecord> & Pick<LoanRecord, "loan_id" | "outcome">): LoanRecord {
  return {
    amount: 10,
    asset: "USDC",
    rate_quoted: 0.18,
    collateral_ratio: 2,
    origin_date: "2026-04-01T00:00:00.000Z",
    due_date: "2026-04-15T00:00:00.000Z",
    repaid_date: partial.outcome === "active" ? null : "2026-04-14T00:00:00.000Z",
    ...partial,
  };
}

function withLoans(wallet: string, loans: LoanRecord[]): UserRelationship {
  return recomputeRelationship({
    ...emptyRelationship(wallet, "2026-04-01T00:00:00.000Z"),
    loans,
  });
}

const WHALE = emptyOnchainSignal(CLEAN, { wallet_age_days: 2000, tx_count: 50_000 });
const GHOST = emptyOnchainSignal(CLEAN, { wallet_age_days: 0, tx_count: 0 });
const MODERATE = emptyOnchainSignal(NEW, { wallet_age_days: 40, tx_count: 12 });

describe("memory primacy, on-chain is gated in code", () => {
  it("selectRateInputs drops ONCHAIN_SIGNAL once total_loans > 0", () => {
    const rel = withLoans(CLEAN, [loan({ loan_id: "l1", outcome: "on_time" })]);
    const selected = selectRateInputs(rel, WHALE);
    assert.equal(selected.primary, "USER_RELATIONSHIP");
    assert.equal(selected.used_onchain, false);
    assert.equal(selected.onchain, null);
    assert.equal(selected.relationship_empty, false);
  });

  it("selectRateInputs uses ONCHAIN_SIGNAL only when total_loans == 0", () => {
    const rel = emptyRelationship(NEW);
    const selected = selectRateInputs(rel, MODERATE);
    assert.equal(selected.primary, "ONCHAIN_SIGNAL");
    assert.equal(selected.used_onchain, true);
    assert.equal(selected.onchain?.tx_count, 12);
    assert.equal(selected.relationship_empty, true);
  });

  it("a whale on-chain signal cannot change terms once a relationship exists", () => {
    const rel = withLoans(CLEAN, [
      loan({ loan_id: "l1", amount: 8, outcome: "on_time" }),
      loan({ loan_id: "l2", amount: 10, outcome: "on_time" }),
      loan({ loan_id: "l3", amount: 12, outcome: "on_time" }),
      loan({ loan_id: "l4", amount: 15, outcome: "on_time" }),
    ]);
    const withWhale = computeRateQuote({ amount: 8, relationship: rel, onchain: WHALE });
    const withGhost = computeRateQuote({ amount: 8, relationship: rel, onchain: GHOST });
    assert.equal(withWhale.used_onchain, false);
    assert.equal(withGhost.used_onchain, false);
    assert.equal(withWhale.apr, withGhost.apr);
    assert.equal(withWhale.collateral_ratio, withGhost.collateral_ratio);
    assert.equal(withWhale.decision, withGhost.decision);
    assert.equal(withWhale.standing_score, withGhost.standing_score);
    assert.equal(withWhale.primary_signal, "USER_RELATIONSHIP");
  });

  it("on-chain DOES change terms when USER_RELATIONSHIP is empty", () => {
    const rel = emptyRelationship(NEW);
    const thin = computeRateQuote({ amount: 8, relationship: rel, onchain: GHOST });
    const rich = computeRateQuote({ amount: 8, relationship: rel, onchain: WHALE });
    assert.equal(thin.used_onchain, true);
    assert.equal(rich.used_onchain, true);
    assert.equal(thin.relationship_empty, true);
    assert.ok(thin.apr > rich.apr, `thin ${thin.apr} should be worse than whale ${rich.apr}`);
    assert.ok(thin.factors.some((f) => /USER_RELATIONSHIP is empty/.test(f.detail)));
  });
});

describe("RATE_POLICY", () => {
  it("clean multi-loan history beats any on-chain baseline", () => {
    const clean = withLoans(CLEAN, [
      loan({ loan_id: "l1", amount: 8, outcome: "on_time" }),
      loan({ loan_id: "l2", amount: 10, outcome: "on_time" }),
      loan({ loan_id: "l3", amount: 12, outcome: "on_time" }),
      loan({ loan_id: "l4", amount: 15, outcome: "on_time" }),
    ]);
    const relQuote = computeRateQuote({ amount: 8, relationship: clean, onchain: WHALE });
    const newQuote = computeRateQuote({
      amount: 8,
      relationship: emptyRelationship(NEW),
      onchain: WHALE,
    });
    assert.equal(relQuote.decision, "Approve");
    assert.equal(relQuote.apr, 0.06);
    assert.ok(relQuote.apr < newQuote.apr);
    assert.ok(relQuote.collateral_ratio <= newQuote.collateral_ratio);
    assert.equal(relQuote.used_onchain, false);
    assert.equal(newQuote.used_onchain, true);
  });

  it("a single default has an outsized effect despite decent volume", () => {
    const penalized = withLoans(CLEAN, [
      loan({ loan_id: "l1", amount: 15, outcome: "on_time" }),
      loan({ loan_id: "l2", amount: 18, outcome: "on_time" }),
      loan({
        loan_id: "l3",
        amount: 20,
        outcome: "defaulted",
        repaid_date: null,
        due_date: "2026-06-15T00:00:00.000Z",
      }),
    ]);
    const q = computeRateQuote({ amount: 8, relationship: penalized, onchain: WHALE });
    const fresh = computeRateQuote({
      amount: 8,
      relationship: emptyRelationship(NEW),
      onchain: WHALE,
    });
    assert.ok(penalized.total_borrowed > 40);
    assert.equal(penalized.current_standing_score, standingFromHistory(penalized));
    assert.ok(penalized.current_standing_score <= 0.12);
    assert.equal(q.decision, "Decline");
    assert.ok(q.apr > fresh.apr, "defaulted book must be more expensive than a new whale");
    assert.equal(q.used_onchain, false);
  });

  it("one on-time repayment improves the rate vs the same wallet's on-chain baseline", () => {
    const empty = emptyRelationship(NEW);
    const before = computeRateQuote({ amount: 8, relationship: empty, onchain: MODERATE });
    const afterRel = withLoans(NEW, [loan({ loan_id: "live-1", amount: 8, outcome: "on_time" })]);
    const after = computeRateQuote({ amount: 8, relationship: afterRel, onchain: MODERATE });
    assert.equal(before.used_onchain, true);
    assert.equal(after.used_onchain, false);
    assert.ok(after.apr < before.apr, `after ${after.apr} vs before ${before.apr}`);
    assert.ok(after.factors.some((f) => /ONCHAIN_SIGNAL not used/.test(f.detail)));
    assert.ok(after.factors.some((f) => /on_time/.test(f.detail)));
  });

  it("late repayment worsens terms vs a clean book of the same size", () => {
    const clean = withLoans(CLEAN, [
      loan({ loan_id: "a", outcome: "on_time" }),
      loan({ loan_id: "b", outcome: "on_time" }),
    ]);
    const late = withLoans(CLEAN, [
      loan({ loan_id: "a", outcome: "on_time" }),
      loan({
        loan_id: "b",
        outcome: "late",
        repaid_date: "2026-04-20T00:00:00.000Z",
        due_date: "2026-04-15T00:00:00.000Z",
      }),
    ]);
    const cq = computeRateQuote({ amount: 8, relationship: clean, onchain: GHOST });
    const lq = computeRateQuote({ amount: 8, relationship: late, onchain: GHOST });
    assert.ok(lq.apr > cq.apr);
  });
});

describe("hard ceilings", () => {
  it("MAX_BORROW_AMOUNT blocks before scoring, independent of standing", () => {
    process.env.MAX_BORROW_AMOUNT = "50";
    const clean = withLoans(CLEAN, [
      loan({ loan_id: "l1", outcome: "on_time" }),
      loan({ loan_id: "l2", outcome: "on_time" }),
      loan({ loan_id: "l3", outcome: "on_time" }),
      loan({ loan_id: "l4", outcome: "on_time" }),
    ]);
    const q = computeRateQuote({ amount: 51, relationship: clean, onchain: WHALE });
    assert.equal(q.decision, "Ceiling blocked");
    assert.equal(q.skipped_scoring, true);
    assert.equal(q.used_onchain, false);
    assert.match(q.ceiling.reason, /MAX_BORROW_AMOUNT/);
  });

  it("collateral ratio never goes below MIN_COLLATERAL_RATIO", () => {
    process.env.MIN_COLLATERAL_RATIO = "1.5";
    const clean = withLoans(CLEAN, [
      loan({ loan_id: "l1", outcome: "on_time" }),
      loan({ loan_id: "l2", outcome: "on_time" }),
      loan({ loan_id: "l3", outcome: "on_time" }),
      loan({ loan_id: "l4", outcome: "on_time" }),
    ]);
    const q = computeRateQuote({ amount: 8, relationship: clean, onchain: GHOST });
    assert.ok(q.collateral_ratio >= 1.5);
  });
});

describe("LLM cannot change numeric output", () => {
  it("enforceLendingVerdict keeps code decision/score even if the model lies", () => {
    const rel = withLoans(CLEAN, [loan({ loan_id: "l1", outcome: "on_time" })]);
    const quote = computeRateQuote({ amount: 8, relationship: rel, onchain: WHALE });
    const parsed = parseLendingOutput(
      `Decision: Decline\n\nReasoning:\n- Wallet age 2000 days, 50000 txs, blue-chip DeFi user.\n- I lowered APR to 1% because the chain looks great.\n\nScore: 0.99`,
    );
    const enforced = enforceLendingVerdict({
      parsed,
      quote,
      relationship: rel,
      onchain: WHALE,
      amount: 8,
      asset: "USDC",
      source: "grok-4.6",
      raw: "lie",
    });
    assert.equal(enforced.decision, quote.decision);
    assert.equal(enforced.score, quote.standing_score);
    assert.ok(!enforced.reasoning.some((l) => /Wallet age|50000 txs/i.test(l)));
    assert.ok(enforced.reasoning.some((l) => /ONCHAIN_SIGNAL not used/i.test(l)));
  });

  it("empty relationship reasoning is forced into the output", () => {
    const rel = emptyRelationship(NEW);
    const quote = computeRateQuote({ amount: 8, relationship: rel, onchain: MODERATE });
    const enforced = enforceLendingVerdict({
      parsed: {
        decision: "Approve",
        reasoning: ["Looks fine."],
        score: 0.9,
      },
      quote,
      relationship: rel,
      onchain: MODERATE,
      amount: 8,
      asset: "USDC",
      source: "grok-4.6",
      raw: "",
    });
    assert.ok(enforced.reasoning.some((l) => l.includes("USER_RELATIONSHIP is empty.")));
    assert.equal(enforced.decision, quote.decision);
    assert.equal(enforced.score, quote.standing_score);
  });
});

describe("load-bearing sequence a–d (in memory)", () => {
  it("new → repay on time → cheaper → reset-equivalent empty is back to on-chain", () => {
    const wallet = NEW;
    const chain = MODERATE;

    const a = computeRateQuote({
      amount: 8,
      relationship: emptyRelationship(wallet),
      onchain: chain,
    });
    assert.equal(a.used_onchain, true);
    assert.equal(a.relationship_empty, true);
    assert.ok(a.factors.some((f) => /USER_RELATIONSHIP is empty/.test(f.detail)));
    const aprNew = a.apr;

    const afterRepay = withLoans(wallet, [loan({ loan_id: "live-1", amount: 8, outcome: "on_time" })]);
    const c = computeRateQuote({ amount: 8, relationship: afterRepay, onchain: chain });
    assert.equal(c.used_onchain, false);
    assert.ok(c.apr < aprNew);
    assert.ok(c.factors.some((f) => /on_time/.test(f.detail)));
    assert.ok(c.factors.some((f) => /ONCHAIN_SIGNAL not used/.test(f.detail)));

    const d = computeRateQuote({
      amount: 8,
      relationship: emptyRelationship(wallet),
      onchain: chain,
    });
    assert.equal(d.apr, aprNew);
    assert.equal(d.used_onchain, true);
    assert.equal(d.relationship_empty, true);
  });
});
