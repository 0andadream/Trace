/**
 * RISK_PHILOSOPHY (Trace scoring)
 *
 * Trace scores how far a request sits from recorded history. It does not
 * guess trust. Judges: the number is a sum of named factors, then clamped
 * to 0–1. Alex maps it with fixed cutoffs (<0.30 Proceed, 0.30–0.60 Flag,
 * >0.60 Hold). Those cutoffs live in lib/policy/decide.ts and must not move.
 *
 * Prefer Hold when evidence is thin. Unknown counterparties are high risk.
 * Size vs historical average matters. Verification is a modest nudge only
 * when an explicit status exists, address-only counterparties are unchanged.
 * High user-override rates on Holds defer to a person, not to the model.
 */
import { clamp01, formatAmount, round2 } from "@/lib/format";
import type { AgentReputation, CounterpartyProfile, RiskAssessment, RiskFactor, TreasuryRequest } from "@/types";

const HIGH_OVERRIDE_THRESHOLD = 0.4;
const MIN_HOLDS_FOR_OVERRIDE_SIGNAL = 3;

export function computeRiskScore(
  request: TreasuryRequest,
  reputation: AgentReputation,
  profile: CounterpartyProfile | null,
): RiskAssessment {
  const factors: RiskFactor[] = [];

  // 0.28 / 0.20 / 0.12, empty books cannot support Proceed. <3 actions
  // forces Hold via prefer_hold_thin below; <8 still adds caution.
  if (reputation.totalActions < 3) {
    factors.push({
      id: "thin_history",
      delta: 0.28,
      reason: `Thin operating history: ${reputation.totalActions} recorded action${reputation.totalActions === 1 ? "" : "s"}.`,
    });
    factors.push({
      id: "insufficient_evidence",
      delta: 0.2,
      reason: "Sample size is insufficient for a confident pattern. Prefer Hold for approval.",
    });
  } else if (reputation.totalActions < 8) {
    factors.push({
      id: "thin_history",
      delta: 0.12,
      reason: `Limited operating history: ${reputation.totalActions} recorded actions.`,
    });
  }

  if (!profile || profile.interactionCount === 0) {
    // 0.45, a new address is the largest single risk. Alone this is Flag;
    // plus similar rejections it crosses Hold (>0.60).
    factors.push({
      id: "unknown_counterparty",
      delta: 0.45,
      reason: "No prior interactions with this counterparty.",
    });
    if (reputation.rejectedUnverifiedCount > 0) {
      // 0.08 each, cap 0.20, prior failed unknowns are evidence, not vibes.
      const extra = Math.min(0.2, reputation.rejectedUnverifiedCount * 0.08);
      factors.push({
        id: "similar_unverified_rejected",
        delta: extra,
        reason: `Similar unverified recipients were rejected in ${reputation.rejectedUnverifiedCount} previous case${reputation.rejectedUnverifiedCount === 1 ? "" : "s"}.`,
      });
    }
  } else {
    if (profile.interactionCount === 1) {
      // 0.10, one datapoint is not a pattern.
      factors.push({
        id: "sparse_counterparty",
        delta: 0.1,
        reason: `This counterparty has 1 prior interaction.`,
      });
    }
    if (profile.rejected > 0) {
      // up to 0.22, scale by how often this address itself failed.
      factors.push({
        id: "cp_rejections",
        delta: round2(0.22 * (profile.rejected / profile.interactionCount)),
        reason: `This counterparty has ${profile.rejected} rejection${profile.rejected === 1 ? "" : "s"} across ${profile.interactionCount} interaction${profile.interactionCount === 1 ? "" : "s"}.`,
      });
    }
    if (profile.incidents > 0) {
      // 0.20, an incident is rarer and more serious than a clean reject.
      factors.push({
        id: "cp_incidents",
        delta: 0.2,
        reason: `This counterparty has ${profile.incidents} recorded incident${profile.incidents === 1 ? "" : "s"}.`,
      });
    }

    // Modest only, and only when a status was stored. Address-only profiles skip this.
    if (profile.verification === "verified") {
      // −0.05, explicit verification is a small credit, not a trust slogan.
      factors.push({
        id: "verification_verified",
        delta: -0.05,
        reason: `Counterparty ${profile.label} is verified.`,
      });
    } else if (profile.verification === "unverified") {
      // +0.06, labeled but not cleared.
      factors.push({
        id: "verification_unverified",
        delta: 0.06,
        reason: `Counterparty ${profile.label} is unverified.`,
      });
    } else if (profile.verification === "rejected") {
      // +0.14, a recorded failed verification; still not enough alone to Hold.
      factors.push({
        id: "verification_rejected",
        delta: 0.14,
        reason: `Counterparty ${profile.label} has verification status rejected.`,
      });
    }
  }

  const typeStats = reputation.byActionType?.[request.action];
  const avg =
    profile && profile.interactionCount > 0
      ? profile.avgAmount
      : typeStats && typeStats.count > 0
        ? typeStats.avgAmount
        : 0;

  if (avg > 0 && request.amount > 0) {
    const ratio = request.amount / avg;
    if (ratio >= 4) {
      // 0.38, ~5× typical vault size lands in Flag (0.30–0.60), not Hold.
      factors.push({
        id: "amount_deviation",
        delta: 0.38,
        reason: `Requested ${formatAmount(request.amount, request.token)} is ${ratio.toFixed(1)}× the historical average of ${formatAmount(avg, request.token)}.`,
      });
    } else if (ratio >= 2.5) {
      factors.push({
        id: "amount_deviation",
        delta: 0.22,
        reason: `Requested ${formatAmount(request.amount, request.token)} is ${ratio.toFixed(1)}× the historical average of ${formatAmount(avg, request.token)}.`,
      });
    } else if (ratio >= 1.6) {
      factors.push({
        id: "amount_deviation",
        delta: 0.1,
        reason: `Requested ${formatAmount(request.amount, request.token)} is ${ratio.toFixed(1)}× the historical average of ${formatAmount(avg, request.token)}.`,
      });
    }
  }

  if (!typeStats || typeStats.count === 0) {
    // 0.18, a new action type has no envelope. Broadcast still only supports transfer.
    factors.push({
      id: "unseen_action",
      delta: 0.18,
      reason: `No prior ${request.action} actions in agent history.`,
    });
  } else if (typeStats.count < 3) {
    // 0.06, some history, not enough to treat the type as routine.
    factors.push({
      id: "sparse_action",
      delta: 0.06,
      reason: `Only ${typeStats.count} prior ${request.action} action${typeStats.count === 1 ? "" : "s"} in agent history, too few to treat as a reliable pattern.`,
    });
  } else if (typeStats.rejected / typeStats.count >= 0.3) {
    // 0.12, this action type fails often enough to mention.
    factors.push({
      id: "action_failure_rate",
      delta: 0.12,
      reason: `${request.action} actions have ${typeStats.rejected} rejection${typeStats.rejected === 1 ? "" : "s"} out of ${typeStats.count}.`,
    });
  }

  if (
    reputation.holdOverrideRate >= HIGH_OVERRIDE_THRESHOLD &&
    reputation.holdDecisions >= MIN_HOLDS_FOR_OVERRIDE_SIGNAL
  ) {
    // 0.12, operators who often override Holds: defer, don't get bolder.
    factors.push({
      id: "high_override_rate",
      delta: 0.12,
      reason: `User override rate on Hold decisions is ${(reputation.holdOverrideRate * 100).toFixed(0)}% (${Math.round(reputation.holdOverrideRate * reputation.holdDecisions)} of ${reputation.holdDecisions}). Defer to explicit approval.`,
    });
  }

  let score = clamp01(factors.reduce((s, f) => s + f.delta, 0));

  if (reputation.totalActions < 3 && score < 0.61) {
    // Floor at 0.61 so policy Hold (>0.60) when n is too small to trust.
    factors.push({
      id: "prefer_hold_thin",
      delta: round2(0.61 - score),
      reason: "Insufficient evidence, Hold for approval.",
    });
    score = 0.61;
  }

  if (
    reputation.holdOverrideRate >= HIGH_OVERRIDE_THRESHOLD &&
    reputation.holdDecisions >= MIN_HOLDS_FOR_OVERRIDE_SIGNAL &&
    score >= 0.3 &&
    score <= 0.6
  ) {
    // Flag + chronic overrides → Hold. Proceed (<0.30) is left alone.
    factors.push({
      id: "override_upgrade_hold",
      delta: round2(0.61 - score),
      reason: "High user-override rate on similar decisions, Hold for approval.",
    });
    score = 0.61;
  }

  return { score: round2(score), factors };
}
