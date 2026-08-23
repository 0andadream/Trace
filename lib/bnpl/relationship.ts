import { round2 } from "@/lib/format";
import type {
  Installment,
  InstallmentStatus,
  PurchaseOutcome,
  PurchaseRecord,
  UserRelationship,
} from "@/types/bnpl";
import { maxPurchaseAmount } from "@/lib/bnpl/ceiling";

export const EMPTY_RELATIONSHIP_LINE = "USER_RELATIONSHIP is empty. No purchase history exists.";
export const STARTER_STANDING = 0.38;
export const MID_STANDING = 0.5;
export const MAX_STANDING = 0.95;
/** Gross limit at displayed score 50. Scores below 50 stay under this. */
export const LIMIT_AT_MID_STANDING = 3_000;
/** After a default, limit is cut to this regardless of prior volume. */
export const DEFAULT_LIMIT_CAP = 8;

/**
 * Standing is always recomputed from purchase/override history.
 * Never trusted as a stored field.
 *
 * Open plans do not mint reputation: until a plan is finished, standing
 * stays at the on-chain cap (0.38). Displayed score is standing × 100.
 * Each completed on-time plan adds 0.005 (~1 point every 1–2 finishes).
 * Limit is gated by score: 0–50 maps up to $3k (50 = $3k, below is lower),
 * then to MAX_PURCHASE_AMOUNT ($10k) at standing 0.95.
 * Asymmetry: one default caps standing at 0.12 regardless of volume.
 */
export function standingFromHistory(
  rel: Pick<
    UserRelationship,
    | "total_purchases"
    | "on_time_count"
    | "late_count"
    | "default_count"
    | "total_purchased"
    | "total_repaid"
    | "override_count"
  >,
): number {
  if (rel.total_purchases === 0) return 0;

  const completed = rel.on_time_count + rel.late_count + rel.default_count;
  if (completed === 0) return STARTER_STANDING;

  let s = STARTER_STANDING;
  s += rel.on_time_count * 0.005;
  s -= rel.late_count * 0.25;
  if (rel.total_purchased > 0) {
    s += 0.008 * Math.min(1, rel.total_repaid / rel.total_purchased);
  }
  s -= rel.override_count * 0.03;
  if (rel.default_count >= 1) {
    s = Math.min(s, 0.12) - (rel.default_count - 1) * 0.06;
  }
  return round2(Math.max(0, Math.min(MAX_STANDING, s)));
}

export function outstandingBalance(rel: UserRelationship): number {
  let sum = 0;
  for (const p of rel.purchases || []) {
    if (p.outcome !== "active") continue;
    for (const inst of p.schedule || []) {
      if (inst.status === "pending") sum += inst.amount || 0;
    }
  }
  return round2(sum);
}

export function limitFromStanding(standing: number, defaultCount = 0, _onTimeCount = 0) {
  if (standing <= 0) return 0;
  const unlocked = maxPurchaseAmount();
  const at50 = Math.min(LIMIT_AT_MID_STANDING, unlocked);
  let n: number;
  if (standing <= MID_STANDING) {
    n = round2(at50 * (standing / MID_STANDING));
  } else {
    const span = MAX_STANDING - MID_STANDING;
    const t = span > 0 ? Math.min(1, (standing - MID_STANDING) / span) : 1;
    n = round2(at50 + (unlocked - at50) * t);
  }
  if (defaultCount >= 1) n = round2(Math.min(n, DEFAULT_LIMIT_CAP));
  return Math.min(n, unlocked);
}

export function emptyRelationship(wallet: string, at = new Date().toISOString()): UserRelationship {
  const addr = wallet.trim().toLowerCase();
  return {
    wallet_address: addr,
    first_seen: at,
    last_seen: at,
    purchases: [],
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
    current_limit: 0,
    current_standing_score: 0,
  };
}

export function recomputeRelationship(rel: UserRelationship): UserRelationship {
  const purchases = rel.purchases || [];
  const on_time_count = purchases.filter((p) => p.outcome === "completed_on_time").length;
  const late_count = purchases.filter((p) => p.outcome === "completed_late").length;
  const default_count = purchases.filter((p) => p.outcome === "defaulted").length;
  const active_count = purchases.filter((p) => p.outcome === "active").length;
  const total_purchased = round2(purchases.reduce((s, p) => s + (p.amount || 0), 0));
  const total_repaid = round2(
    purchases
      .flatMap((p) => p.schedule || [])
      .filter((i) => i.status === "on_time" || i.status === "late")
      .reduce((s, i) => s + (i.amount || 0), 0),
  );
  const counts = {
    total_purchases: purchases.length,
    on_time_count,
    late_count,
    default_count,
    total_purchased,
    total_repaid,
    override_count: rel.override_count || (rel.override_outcomes || []).length,
  };
  const standing = standingFromHistory(counts);
  return {
    ...rel,
    wallet_address: rel.wallet_address.toLowerCase(),
    purchases,
    quotes: rel.quotes || [],
    override_outcomes: rel.override_outcomes || [],
    ...counts,
    active_count,
    current_standing_score: standing,
    current_limit:
      counts.total_purchases === 0
        ? 0
        : limitFromStanding(standing, counts.default_count, counts.on_time_count),
  };
}

export function installmentStatusFromDates(dueDate: string, paidDate: string): Exclude<InstallmentStatus, "pending"> {
  const due = Date.parse(dueDate);
  const paid = Date.parse(paidDate);
  if (!Number.isFinite(due) || !Number.isFinite(paid)) return "late";
  return paid <= due ? "on_time" : "late";
}

export function purchaseOutcomeFromSchedule(schedule: Installment[], markDefault = false): PurchaseOutcome {
  if (markDefault) return "defaulted";
  if (schedule.some((i) => i.status === "pending")) return "active";
  if (schedule.some((i) => i.status === "late")) return "completed_late";
  return "completed_on_time";
}

export function isRelationshipEmpty(rel: UserRelationship | null | undefined) {
  return !rel || rel.total_purchases === 0;
}

export function citeSpecificPurchase(rel: UserRelationship): string {
  const closed = [...rel.purchases]
    .filter((p) => p.outcome !== "active")
    .sort((a, b) => b.approved_date.localeCompare(a.approved_date));
  const last = closed[0];
  if (!last) {
    return `This agent approved ${rel.total_purchases} purchase${rel.total_purchases === 1 ? "" : "s"} for this wallet.`;
  }
  const lastPaid = [...last.schedule].reverse().find((i) => i.paid_date);
  return `Purchase ${last.purchase_id}: ${last.amount} at ${last.merchant} on ${last.approved_date.slice(0, 10)}, outcome ${last.outcome}${lastPaid?.paid_date ? ` (last paid ${lastPaid.paid_date.slice(0, 10)})` : ""}.`;
}

export function stripComputedForStorage(rel: UserRelationship) {
  const { current_standing_score: _s, current_limit: _l, ...rest } = rel;
  return rest;
}

export function nextPendingIndex(purchase: PurchaseRecord) {
  return purchase.schedule.findIndex((i) => i.status === "pending");
}
