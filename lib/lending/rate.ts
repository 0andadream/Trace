/**
 * RATE_POLICY (deterministic — code, not LLM)
 *
 * Memory primacy: on-chain wallet history may only set terms when
 * USER_RELATIONSHIP.total_loans === 0. The moment this agent has originated
 * a loan with the wallet, ONCHAIN_SIGNAL is dropped (selectRateInputs returns
 * onchain: null) and never enters fromRelationship().
 *
 * That gate lives here, not in a prompt. Tests lock it.
 *
 * Asymmetry: a single default caps standing at 0.12 even with large volume.
 * Clean repeat borrowers get cheaper APR / lower collateral, down to the
 * MIN_COLLATERAL_RATIO floor and MIN_APR. New wallets stay conservative —
 * even a high-activity chain history cannot beat one on-time repayment
 * this agent recorded.
 */
import { round2 } from "@/lib/format";
import { applyCollateralFloor, borrowCeilingCheck, maxBorrowAmount } from "@/lib/lending/ceiling";
import { standingFromHistory } from "@/lib/lending/relationship";
import type { OnchainSignal, RateQuote, UserRelationship } from "@/types/lending";

export const MIN_APR = 0.06;
export const MAX_APR = 0.36;
export const KNOWN_BASE_APR = 0.12;
export const DECLINE_STANDING = 0.18;

export type RateInputs = {
  primary: "USER_RELATIONSHIP" | "ONCHAIN_SIGNAL";
  relationship: UserRelationship;
  /** Null once any loan exists. Callers must not pass a non-null on-chain signal into fromRelationship. */
  onchain: OnchainSignal | null;
  used_onchain: boolean;
  relationship_empty: boolean;
};

export function selectRateInputs(relationship: UserRelationship, onchain: OnchainSignal): RateInputs {
  const relationship_empty = relationship.total_loans === 0;
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

function clampApr(n: number) {
  return round2(Math.max(MIN_APR, Math.min(MAX_APR, n)));
}

function onchainTier(signal: OnchainSignal) {
  const age = signal.wallet_age_days || 0;
  const txs = signal.tx_count || 0;
  if (age < 7 || txs < 3) {
    return {
      id: "thin" as const,
      apr: 0.24,
      collateral: 2.5,
      limitFrac: 0.2,
      standing: 0.22,
      detail: `Thin on-chain baseline: age ${age}d, ${txs} txs. Conservative new-borrower terms.`,
    };
  }
  if (age < 90 || txs < 30) {
    return {
      id: "moderate" as const,
      apr: 0.18,
      collateral: 2.0,
      limitFrac: 0.4,
      standing: 0.32,
      detail: `Moderate on-chain baseline: age ${age}d, ${txs} txs. Still conservative — no loans originated by this agent.`,
    };
  }
  return {
    id: "established" as const,
    apr: 0.16,
    collateral: 1.8,
    limitFrac: 0.5,
    standing: 0.38,
    detail: `Established on-chain wallet: age ${age}d, ${txs} txs. On-chain standing is capped below any on-time relationship history.`,
  };
}

function fromOnchain(amount: number, asset: string, signal: OnchainSignal): RateQuote {
  const max = maxBorrowAmount();
  const tier = onchainTier(signal);
  const ratio = applyCollateralFloor(tier.collateral);
  const limit = round2(max * tier.limitFrac);
  const over = amount > limit;
  return {
    decision: over ? "Approve with reduced limit" : "Approve",
    apr: clampApr(tier.apr),
    collateral_ratio: ratio,
    required_collateral: round2(amount * ratio),
    max_borrow_for_user: limit,
    reduced_limit: over ? limit : null,
    standing_score: tier.standing,
    primary_signal: "ONCHAIN_SIGNAL",
    used_onchain: true,
    relationship_empty: true,
    skipped_scoring: false,
    factors: [
      { id: "relationship_empty", detail: "USER_RELATIONSHIP is empty." },
      { id: `onchain_${tier.id}`, detail: tier.detail },
      {
        id: "onchain_cap",
        detail: `ONCHAIN_SIGNAL cannot produce standing above 0.38 or APR below 16%. One on-time loan this agent records will beat this baseline.`,
      },
    ],
    ceiling: { blocked: false, max, reason: `Under ceiling (${max}).` },
  };
}

function fromRelationship(amount: number, _asset: string, rel: UserRelationship): RateQuote {
  const max = maxBorrowAmount();
  const standing = standingFromHistory(rel);
  const apr = clampApr(KNOWN_BASE_APR + (0.55 - standing) * 0.48);
  const ratio = applyCollateralFloor(1.5 + (0.7 - standing) * 1.2);
  const limit = round2(max * (0.25 + standing * 0.75));
  const factors = [
    {
      id: "relationship_history",
      detail: `${rel.total_loans} loan${rel.total_loans === 1 ? "" : "s"} originated by this agent: ${rel.on_time_count} on_time, ${rel.late_count} late, ${rel.default_count} defaulted. ONCHAIN_SIGNAL not used.`,
    },
  ];

  if (rel.default_count >= 1) {
    factors.push({
      id: "default_asymmetric",
      detail: `${rel.default_count} default${rel.default_count === 1 ? "" : "s"} in this agent's book. Standing capped at ${standing} regardless of volume (${rel.total_borrowed} borrowed).`,
    });
  } else if (rel.late_count >= 1) {
    factors.push({
      id: "late_penalty",
      detail: `${rel.late_count} late repayment${rel.late_count === 1 ? "" : "s"} on loans this agent originated. Rate is worse than a clean book.`,
    });
  } else {
    factors.push({
      id: "clean_repeat",
      detail: `Clean repeat borrower with this agent. Standing ${standing}.`,
    });
  }

  if (standing < DECLINE_STANDING) {
    return {
      decision: "Decline",
      apr,
      collateral_ratio: ratio,
      required_collateral: round2(amount * ratio),
      max_borrow_for_user: 0,
      reduced_limit: null,
      standing_score: standing,
      primary_signal: "USER_RELATIONSHIP",
      used_onchain: false,
      relationship_empty: false,
      skipped_scoring: false,
      factors,
      ceiling: { blocked: false, max, reason: `Under ceiling (${max}).` },
    };
  }

  const over = amount > limit;
  return {
    decision: over ? "Approve with reduced limit" : "Approve",
    apr,
    collateral_ratio: ratio,
    required_collateral: round2(amount * ratio),
    max_borrow_for_user: limit,
    reduced_limit: over ? limit : null,
    standing_score: standing,
    primary_signal: "USER_RELATIONSHIP",
    used_onchain: false,
    relationship_empty: false,
    skipped_scoring: false,
    factors,
    ceiling: { blocked: false, max, reason: `Under ceiling (${max}).` },
  };
}

export function computeRateQuote(input: {
  amount: number;
  asset?: string;
  relationship: UserRelationship;
  onchain: OnchainSignal;
}): RateQuote {
  const asset = input.asset || "USDC";
  const ceil = borrowCeilingCheck(input.amount);
  if (ceil.blocked) {
    return {
      decision: "Ceiling blocked",
      apr: MAX_APR,
      collateral_ratio: applyCollateralFloor(2.5),
      required_collateral: 0,
      max_borrow_for_user: 0,
      reduced_limit: null,
      standing_score: 0,
      primary_signal: input.relationship.total_loans === 0 ? "ONCHAIN_SIGNAL" : "USER_RELATIONSHIP",
      used_onchain: false,
      relationship_empty: input.relationship.total_loans === 0,
      skipped_scoring: true,
      factors: [
        {
          id: "ceiling_blocked",
          detail: ceil.reason,
        },
        {
          id: "scoring_skipped",
          detail: "This refusal is a hard execution ceiling. Standing, on-chain history, and the LLM were not used.",
        },
      ],
      ceiling: { blocked: true, max: ceil.max, reason: ceil.reason },
    };
  }

  const selected = selectRateInputs(input.relationship, input.onchain);
  if (selected.used_onchain) {
    if (!selected.onchain) {
      throw new Error("ONCHAIN_SIGNAL required when USER_RELATIONSHIP.total_loans == 0");
    }
    return fromOnchain(input.amount, asset, selected.onchain);
  }
  return fromRelationship(input.amount, asset, selected.relationship);
}
