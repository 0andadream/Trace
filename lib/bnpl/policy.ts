/**
 * APPROVAL_POLICY (deterministic, code, not LLM)
 *
 * Memory primacy: on-chain wallet history may only set terms when
 * USER_RELATIONSHIP.total_purchases === 0. The moment this agent has
 * approved a purchase for the wallet, ONCHAIN_SIGNAL is dropped
 * (selectPolicyInputs returns onchain: null) and never enters
 * fromRelationship().
 *
 * That gate lives here, not in a prompt. Tests lock it.
 *
 * Asymmetry: a single default caps standing at 0.12 and Declines,
 * even with large completed volume. Clean repeat buyers get a higher
 * limit and up to 4 installments. New wallets stay on short plans (1–2).
 * Users may pay in full instead. Trace interest is higher when standing is lower.
 * Active unpaid plans reduce available limit.
 */
import { round2 } from "@/lib/format";
import { maxActivePlans, maxPurchaseAmount, purchaseCeilingCheck } from "@/lib/bnpl/ceiling";
import {
  limitFromStanding,
  onchainBaseline,
  outstandingBalance,
  standingFromHistory,
} from "@/lib/bnpl/relationship";
import { solvencyCheck, type SolvencySnapshot } from "@/lib/bnpl/solvency";
import type { ApprovalTerms, OnchainSignal, UserRelationship } from "@/types/bnpl";

export const DECLINE_STANDING = 0.18;
export const INSTALLMENT_SPACING_DAYS = 14;
export const SHORT_PLAN_DAYS = 7;

export type PolicyInputs = {
  primary: "USER_RELATIONSHIP" | "ONCHAIN_SIGNAL";
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  used_onchain: boolean;
  relationship_empty: boolean;
};

export function selectPolicyInputs(relationship: UserRelationship, onchain: OnchainSignal): PolicyInputs {
  const relationship_empty = relationship.total_purchases === 0;
  if (!relationship_empty) {
    return {
      primary: "USER_RELATIONSHIP",
      relationship,
      onchain: null,
      used_onchain: false,
      relationship_empty: false,
    };
  }
  return {
    primary: "ONCHAIN_SIGNAL",
    relationship,
    onchain,
    used_onchain: true,
    relationship_empty: true,
  };
}

export function buildDueDates(n: number, from = new Date()): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const days = n === 1 ? SHORT_PLAN_DAYS : INSTALLMENT_SPACING_DAYS * (i + 1);
    dates.push(new Date(from.getTime() + days * 86400000).toISOString());
  }
  return dates;
}

export function splitInstallments(amount: number, n: number) {
  if (n <= 0) return { amounts: [] as number[], each: 0 };
  const each = round2(amount / n);
  const amounts = Array.from({ length: n }, () => each);
  const drift = round2(amount - each * n);
  if (amounts.length) amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + drift);
  return { amounts, each };
}

function onchainTier(signal: OnchainSignal) {
  return onchainBaseline(signal.wallet_age_days || 0, signal.tx_count || 0);
}

function planLength(standing: number, late: number, defaults: number) {
  if (defaults >= 1 || standing < DECLINE_STANDING) return 0;
  if (late >= 1) return 2;
  return 4;
}

/** Lesser standing → higher Trace interest. Floor 2%, ceiling 26%. */
export function interestRateFromStanding(standing: number) {
  const s = Math.max(0, Math.min(1, standing));
  return round2(Math.max(0.02, Math.min(0.26, 0.24 * (1 - s) + 0.02)));
}

export function resolveInstallmentCount(
  maxN: number,
  opts?: { pay_in_full?: boolean; installments?: number },
) {
  if (maxN <= 0) return 0;
  if (opts?.pay_in_full) return 1;
  const want = opts?.installments;
  if (typeof want === "number" && Number.isFinite(want)) {
    return Math.min(maxN, Math.max(1, Math.floor(want)));
  }
  return maxN;
}

function pricedPlan(
  principal: number,
  standing: number,
  maxN: number,
  opts?: { pay_in_full?: boolean; installments?: number },
) {
  const n = resolveInstallmentCount(maxN, opts);
  const rate = interestRateFromStanding(standing);
  const interest = round2(principal * rate);
  const total = round2(principal + interest);
  const split = n > 0 ? splitInstallments(total, n) : { amounts: [] as number[], each: 0 };
  return {
    n,
    maxN,
    rate,
    interest,
    total,
    split,
    due_dates: n > 0 ? buildDueDates(n) : ([] as string[]),
    pay_in_full: Boolean(opts?.pay_in_full) || n === 1,
  };
}

function blockedTerms(
  rel: UserRelationship,
  reason: string,
  max: number,
  maxActive: number,
  extra: Partial<ApprovalTerms> = {},
): ApprovalTerms {
  return {
    outcome: extra.outcome ?? null,
    limit: 0,
    available: 0,
    installments: 0,
    installment_amount: 0,
    due_dates: [],
    reduced_limit: null,
    standing_score: 0,
    outstanding: outstandingBalance(rel),
    active_plans: rel.active_count,
    payout_amount: 0,
    principal: 0,
    interest_rate: 0,
    interest_amount: 0,
    total_due: 0,
    max_installments: 0,
    pay_in_full: false,
    agent_exposure: extra.agent_exposure ?? 0,
    primary_signal: rel.total_purchases === 0 ? "ONCHAIN_SIGNAL" : "USER_RELATIONSHIP",
    used_onchain: false,
    relationship_empty: rel.total_purchases === 0,
    skipped_scoring: true,
    factors: [
      { id: extra.outcome === "insolvent_declined" ? "insolvent_declined" : "ceiling_blocked", detail: reason },
      {
        id: "scoring_skipped",
        detail:
          extra.outcome === "insolvent_declined"
            ? "This refusal is the agent's own solvency ceiling. User standing and on-chain history were not used."
            : "This refusal is a hard execution ceiling. Standing, on-chain history, and the LLM were not used.",
      },
    ],
    ceiling: { blocked: true, max, max_active: maxActive, reason },
    ...extra,
    decision: extra.decision ?? "Ceiling blocked",
  };
}

function applySolvency(terms: ApprovalTerms, amount: number, solvency?: SolvencySnapshot): ApprovalTerms {
  if (!solvency) return terms;
  const payout =
    terms.decision === "Approve" || terms.decision === "Approve with reduced limit"
      ? terms.reduced_limit ?? amount
      : 0;
  const check = solvencyCheck(payout, solvency);
  const withBook = { ...terms, payout_amount: payout, agent_exposure: solvency.exposure };
  if (!check.blocked || payout <= 0) return withBook;
  return {
    ...withBook,
    decision: "Decline",
    outcome: "insolvent_declined",
    installments: 0,
    installment_amount: 0,
    due_dates: [],
    reduced_limit: null,
    payout_amount: 0,
    principal: 0,
    interest_rate: 0,
    interest_amount: 0,
    total_due: 0,
    max_installments: 0,
    pay_in_full: false,
    skipped_scoring: true,
    used_onchain: false,
    factors: [
      { id: "insolvent_declined", detail: check.reason },
      {
        id: "scoring_skipped",
        detail: "This refusal is the agent's own solvency ceiling. User standing and on-chain history were not used.",
      },
    ],
    ceiling: {
      ...withBook.ceiling,
      blocked: true,
      reason: check.reason,
    },
  };
}

function fromOnchain(
  amount: number,
  signal: OnchainSignal,
  rel: UserRelationship,
  opts?: { pay_in_full?: boolean; installments?: number },
): ApprovalTerms {
  const max = maxPurchaseAmount();
  const tier = onchainTier(signal);
  const over = amount > tier.limit;
  const approved = over ? tier.limit : amount;
  const plan = pricedPlan(approved, tier.standing, tier.installments, opts);
  return {
    decision: over ? "Approve with reduced limit" : "Approve",
    outcome: null,
    limit: tier.limit,
    available: tier.limit,
    installments: plan.n,
    installment_amount: plan.split.each,
    due_dates: plan.due_dates,
    reduced_limit: over ? tier.limit : null,
    standing_score: tier.standing,
    outstanding: 0,
    active_plans: rel.active_count,
    payout_amount: approved,
    principal: approved,
    interest_rate: plan.rate,
    interest_amount: plan.interest,
    total_due: plan.total,
    max_installments: plan.maxN,
    pay_in_full: plan.pay_in_full,
    agent_exposure: 0,
    primary_signal: "ONCHAIN_SIGNAL",
    used_onchain: true,
    relationship_empty: true,
    skipped_scoring: false,
    factors: [
      { id: "relationship_empty", detail: "USER_RELATIONSHIP is empty. No purchase history exists." },
      { id: `onchain_${tier.id}`, detail: tier.detail },
      {
        id: "onchain_cap",
        detail: `ONCHAIN_SIGNAL cannot produce a limit above ${tier.limit} or a plan longer than ${tier.installments} installment${tier.installments === 1 ? "" : "s"}. One on-time purchase this agent records will beat this baseline.`,
      },
      {
        id: "trace_interest",
        detail: `Trace interest ${Math.round(plan.rate * 100)}% (lower standing, higher interest). You receive ${approved}, repay ${plan.total}.`,
      },
    ],
    ceiling: {
      blocked: false,
      max,
      max_active: maxActivePlans(),
      reason: `Under ceiling (max ${max}, max active plans ${maxActivePlans()}).`,
    },
  };
}

function fromRelationship(
  amount: number,
  rel: UserRelationship,
  opts?: { pay_in_full?: boolean; installments?: number },
): ApprovalTerms {
  const max = maxPurchaseAmount();
  const standing = standingFromHistory(rel);
  const gross = limitFromStanding(standing, rel.default_count, rel.on_time_count, rel.late_count);
  const outstanding = outstandingBalance(rel);
  const available = round2(Math.max(0, gross - outstanding));
  const maxN = planLength(standing, rel.late_count, rel.default_count);
  const snap = rel.snapshot;
  const factors = [
    {
      id: "relationship_history",
      detail: `${rel.total_purchases} purchase${rel.total_purchases === 1 ? "" : "s"} this agent approved: ${rel.on_time_count} completed_on_time, ${rel.late_count} completed_late, ${rel.default_count} defaulted. ONCHAIN_SIGNAL not used.`,
    },
  ];
  if (snap?.trust_note) {
    factors.push({
      id: "relationship_snapshot",
      detail: `Snapshot last_outcome=${snap.last_outcome ?? "none"} open_plans=${snap.open_plans} standing=${snap.standing}. ${snap.trust_note}`,
    });
  }

  if (rel.default_count >= 1) {
    factors.push({
      id: "default_asymmetric",
      detail: `${rel.default_count} default${rel.default_count === 1 ? "" : "s"} in this agent's book. Standing capped at ${standing}; limit cut regardless of volume (${rel.total_purchased} purchased).`,
    });
  } else if (rel.late_count >= 1) {
    factors.push({
      id: "late_penalty",
      detail: `${rel.late_count} late-completed plan${rel.late_count === 1 ? "" : "s"} this agent approved. Limit and plan length are worse than a clean book.`,
    });
  } else {
    factors.push({
      id: "clean_repeat",
      detail: `Clean repeat buyer with this agent. Standing ${standing}, gross limit ${gross}.`,
    });
  }

  if (outstanding > 0) {
    factors.push({
      id: "active_outstanding",
      detail: `${rel.active_count} active plan${rel.active_count === 1 ? "" : "s"} with ${outstanding} outstanding. Available ${available}.`,
    });
  }

  const ceil = {
    blocked: false,
    max,
    max_active: maxActivePlans(),
    reason: `Under ceiling (max ${max}, max active plans ${maxActivePlans()}).`,
  };

  if (standing < DECLINE_STANDING || available <= 0) {
    return {
      decision: "Decline",
      outcome: null,
      limit: gross,
      available,
      installments: 0,
      installment_amount: 0,
      due_dates: [],
      reduced_limit: null,
      standing_score: standing,
      outstanding,
      active_plans: rel.active_count,
      payout_amount: 0,
      principal: 0,
      interest_rate: interestRateFromStanding(standing),
      interest_amount: 0,
      total_due: 0,
      max_installments: maxN,
      pay_in_full: false,
      agent_exposure: 0,
      primary_signal: "USER_RELATIONSHIP",
      used_onchain: false,
      relationship_empty: false,
      skipped_scoring: false,
      factors,
      ceiling: ceil,
    };
  }

  const over = amount > available;
  const approved = over ? available : amount;
  const plan = pricedPlan(approved, standing, maxN, opts);
  factors.push({
    id: "trace_interest",
    detail: `Trace interest ${Math.round(plan.rate * 100)}% (lower standing, higher interest). You receive ${approved}, repay ${plan.total}.`,
  });
  return {
    decision: over ? "Approve with reduced limit" : "Approve",
    outcome: null,
    limit: gross,
    available,
    installments: plan.n,
    installment_amount: plan.split.each,
    due_dates: plan.due_dates,
    reduced_limit: over ? available : null,
    standing_score: standing,
    outstanding,
    active_plans: rel.active_count,
    payout_amount: approved,
    principal: approved,
    interest_rate: plan.rate,
    interest_amount: plan.interest,
    total_due: plan.total,
    max_installments: plan.maxN,
    pay_in_full: plan.pay_in_full,
    agent_exposure: 0,
    primary_signal: "USER_RELATIONSHIP",
    used_onchain: false,
    relationship_empty: false,
    skipped_scoring: false,
    factors,
    ceiling: ceil,
  };
}

export function computeApproval(input: {
  amount: number;
  relationship: UserRelationship;
  onchain: OnchainSignal;
  solvency?: SolvencySnapshot;
  pay_in_full?: boolean;
  installments?: number;
}): ApprovalTerms {
  const ceil = purchaseCeilingCheck(input.amount, input.relationship.active_count);
  if (ceil.blocked) {
    return applySolvency(
      blockedTerms(input.relationship, ceil.reason, ceil.max, ceil.maxActive, {
        agent_exposure: input.solvency?.exposure ?? 0,
      }),
      input.amount,
      input.solvency,
    );
  }

  const selected = selectPolicyInputs(input.relationship, input.onchain);
  let terms: ApprovalTerms;
  if (selected.used_onchain) {
    if (!selected.onchain) {
      throw new Error("ONCHAIN_SIGNAL required when USER_RELATIONSHIP.total_purchases == 0");
    }
    terms = fromOnchain(input.amount, selected.onchain, selected.relationship, {
      pay_in_full: input.pay_in_full,
      installments: input.installments,
    });
  } else {
    terms = fromRelationship(input.amount, selected.relationship, {
      pay_in_full: input.pay_in_full,
      installments: input.installments,
    });
  }
  return applySolvency(terms, input.amount, input.solvency);
}
