import { round2 } from "@/lib/format";
import type { LoanOutcome, UserRelationship } from "@/types/lending";

export const EMPTY_RELATIONSHIP_LINE = "USER_RELATIONSHIP is empty.";

/**
 * Standing is always recomputed from loan/override history.
 * It is never trusted as a stored field.
 *
 * Asymmetry: one default caps standing at 0.12 regardless of volume.
 * Trust is hard to earn, easy to lose.
 */
export function standingFromHistory(
  rel: Pick<
    UserRelationship,
    | "total_loans"
    | "on_time_count"
    | "late_count"
    | "default_count"
    | "total_borrowed"
    | "total_repaid"
    | "override_count"
  >,
): number {
  if (rel.total_loans === 0) return 0;

  let s = 0.5;
  s += rel.on_time_count * 0.1;
  s -= rel.late_count * 0.25;
  if (rel.total_borrowed > 0) {
    s += 0.08 * Math.min(1, rel.total_repaid / rel.total_borrowed);
  }
  s -= rel.override_count * 0.03;
  if (rel.default_count >= 1) {
    s = Math.min(s, 0.12) - (rel.default_count - 1) * 0.06;
  }
  return round2(Math.max(0, Math.min(0.95, s)));
}

export function emptyRelationship(wallet: string, at = new Date().toISOString()): UserRelationship {
  const addr = wallet.trim().toLowerCase();
  return {
    wallet_address: addr,
    first_seen: at,
    last_seen: at,
    loans: [],
    quotes: [],
    total_loans: 0,
    on_time_count: 0,
    late_count: 0,
    default_count: 0,
    active_count: 0,
    total_borrowed: 0,
    total_repaid: 0,
    override_count: 0,
    override_outcomes: [],
    collateral: [],
    current_standing_score: 0,
  };
}

export function recomputeRelationship(rel: UserRelationship): UserRelationship {
  const loans = rel.loans || [];
  const on_time_count = loans.filter((l) => l.outcome === "on_time").length;
  const late_count = loans.filter((l) => l.outcome === "late").length;
  const default_count = loans.filter((l) => l.outcome === "defaulted").length;
  const active_count = loans.filter((l) => l.outcome === "active").length;
  const total_borrowed = round2(loans.reduce((s, l) => s + (l.amount || 0), 0));
  const total_repaid = round2(
    loans
      .filter((l) => l.outcome === "on_time" || l.outcome === "late")
      .reduce((s, l) => s + (l.amount || 0), 0),
  );
  const counts = {
    total_loans: loans.length,
    on_time_count,
    late_count,
    default_count,
    total_borrowed,
    total_repaid,
    override_count: rel.override_count || (rel.override_outcomes || []).length,
  };
  return {
    ...rel,
    wallet_address: rel.wallet_address.toLowerCase(),
    loans,
    quotes: rel.quotes || [],
    override_outcomes: rel.override_outcomes || [],
    collateral: rel.collateral || [],
    ...counts,
    active_count,
    current_standing_score: standingFromHistory(counts),
  };
}

export function totalCollateral(rel: UserRelationship, asset?: string) {
  return (rel.collateral || [])
    .filter((c) => !asset || c.asset.toUpperCase() === asset.toUpperCase())
    .reduce((s, c) => s + c.amount, 0);
}

export function outcomeFromDates(dueDate: string, repaidDate: string): Exclude<LoanOutcome, "active"> {
  const due = Date.parse(dueDate);
  const repaid = Date.parse(repaidDate);
  if (!Number.isFinite(due) || !Number.isFinite(repaid)) return "late";
  return repaid <= due ? "on_time" : "late";
}

export function isRelationshipEmpty(rel: UserRelationship | null | undefined) {
  return !rel || rel.total_loans === 0;
}

export function citeSpecificRepayment(rel: UserRelationship): string {
  const closed = [...rel.loans]
    .filter((l) => l.outcome !== "active")
    .sort((a, b) => (b.repaid_date || b.origin_date).localeCompare(a.repaid_date || a.origin_date));
  const last = closed[0];
  if (!last) {
    return `This agent originated ${rel.total_loans} loan${rel.total_loans === 1 ? "" : "s"} with this wallet.`;
  }
  return `Loan ${last.loan_id}: ${last.amount} ${last.asset} originated ${last.origin_date.slice(0, 10)}, outcome ${last.outcome}${last.repaid_date ? ` (repaid ${last.repaid_date.slice(0, 10)})` : ""}.`;
}

export function stripStandingForStorage(rel: UserRelationship): Omit<UserRelationship, "current_standing_score"> & {
  current_standing_score?: never;
} {
  const { current_standing_score: _ignored, ...rest } = rel;
  return rest;
}


