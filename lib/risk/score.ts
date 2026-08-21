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
    factors.push({
      id: "unknown_counterparty",
      delta: 0.45,
      reason: "No prior interactions with this counterparty.",
    });
    if (reputation.rejectedUnverifiedCount > 0) {
      const extra = Math.min(0.2, reputation.rejectedUnverifiedCount * 0.08);
      factors.push({
        id: "similar_unverified_rejected",
        delta: extra,
        reason: `Similar unverified recipients were rejected in ${reputation.rejectedUnverifiedCount} previous case${reputation.rejectedUnverifiedCount === 1 ? "" : "s"}.`,
      });
    }
  } else {
    if (profile.interactionCount === 1) {
      factors.push({
        id: "sparse_counterparty",
        delta: 0.1,
        reason: `This counterparty has 1 prior interaction.`,
      });
    }
    if (profile.rejected > 0) {
      factors.push({
        id: "cp_rejections",
        delta: round2(0.22 * (profile.rejected / profile.interactionCount)),
        reason: `This counterparty has ${profile.rejected} rejection${profile.rejected === 1 ? "" : "s"} across ${profile.interactionCount} interaction${profile.interactionCount === 1 ? "" : "s"}.`,
      });
    }
    if (profile.incidents > 0) {
      factors.push({
        id: "cp_incidents",
        delta: 0.2,
        reason: `This counterparty has ${profile.incidents} recorded incident${profile.incidents === 1 ? "" : "s"}.`,
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
    factors.push({
      id: "unseen_action",
      delta: 0.18,
      reason: `No prior ${request.action} actions in agent history.`,
    });
  } else if (typeStats.count > 0 && typeStats.rejected / typeStats.count >= 0.3) {
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
    factors.push({
      id: "high_override_rate",
      delta: 0.12,
      reason: `User override rate on Hold decisions is ${(reputation.holdOverrideRate * 100).toFixed(0)}% (${Math.round(reputation.holdOverrideRate * reputation.holdDecisions)} of ${reputation.holdDecisions}). Defer to explicit approval.`,
    });
  }

  let score = clamp01(factors.reduce((s, f) => s + f.delta, 0));

  if (reputation.totalActions < 3 && score < 0.61) {
    factors.push({
      id: "prefer_hold_thin",
      delta: round2(0.61 - score),
      reason: "Insufficient evidence — Hold for approval.",
    });
    score = 0.61;
  }

  if (
    reputation.holdOverrideRate >= HIGH_OVERRIDE_THRESHOLD &&
    reputation.holdDecisions >= MIN_HOLDS_FOR_OVERRIDE_SIGNAL &&
    score >= 0.3 &&
    score <= 0.6
  ) {
    factors.push({
      id: "override_upgrade_hold",
      delta: round2(0.61 - score),
      reason: "High user-override rate on similar decisions — Hold for approval.",
    });
    score = 0.61;
  }

  return { score: round2(score), factors };
}
