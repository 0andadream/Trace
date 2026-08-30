/**
 * Live policy numbers for the homepage and /demo.
 * Same functions as /buy: selectPolicyInputs / computeApproval.
 */
import { emptyOnchainSignal } from "@/lib/bnpl/onchain";
import { computeApproval } from "@/lib/bnpl/policy";
import { emptyRelationship, recomputeRelationship } from "@/lib/bnpl/relationship";
import { formatAmount } from "@/lib/format";
import type { ApprovalTerms, PurchaseRecord, UserRelationship } from "@/types/bnpl";

export const DEMO_SKU = { id: "notebook", name: "Notebook Set", price: 12 } as const;

const WALK = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa12";

function paid(amount: number, status: "on_time" | "late"): PurchaseRecord["schedule"][number] {
  return {
    amount,
    due_date: "2026-04-15T00:00:00.000Z",
    paid_date: status === "on_time" ? "2026-04-14T00:00:00.000Z" : "2026-04-20T00:00:00.000Z",
    status,
  };
}

function withBook(purchases: PurchaseRecord[]): UserRelationship {
  return recomputeRelationship({
    ...emptyRelationship(WALK, "2026-04-01T00:00:00.000Z"),
    purchases,
  });
}

function purchase(outcome: PurchaseRecord["outcome"], status: "on_time" | "late" | "pending" = "on_time"): PurchaseRecord {
  return {
    purchase_id: `walk-${outcome}`,
    amount: DEMO_SKU.price,
    merchant: "Test Shop",
    installments: 1,
    approved_date: "2026-04-01T00:00:00.000Z",
    schedule: [
      status === "pending"
        ? { amount: DEMO_SKU.price, due_date: "2026-04-15T00:00:00.000Z", paid_date: null, status: "pending" }
        : paid(DEMO_SKU.price, status),
    ],
    outcome,
  };
}

const THIN = emptyOnchainSignal(WALK, { wallet_age_days: 2, tx_count: 1 });
const MODERATE = emptyOnchainSignal(WALK, { wallet_age_days: 40, tx_count: 12 });
const ESTABLISHED = emptyOnchainSignal(WALK, { wallet_age_days: 200, tx_count: 80 });

function pack(terms: ApprovalTerms) {
  return {
    decision: terms.decision,
    primary: terms.primary_signal,
    used_onchain: terms.used_onchain,
    standing: terms.standing_score,
    score: Math.round(terms.standing_score * 100),
    limit: terms.limit,
    available: terms.available,
    installments: terms.installments,
    installment_amount: terms.installment_amount,
    interest_rate: terms.interest_rate,
    interest_amount: terms.interest_amount,
    total_due: terms.total_due,
    limitLabel: formatAmount(terms.limit),
    installmentLabel: terms.installments
      ? `${terms.installments} payment${terms.installments === 1 ? "" : "s"} of ${formatAmount(terms.installment_amount)}`
      : "no plan",
    interestLabel: `${Math.round((terms.interest_rate || 0) * 100)}%`,
  };
}

export function liveWalkthrough() {
  const empty = emptyRelationship(WALK);
  const thin = computeApproval({ amount: DEMO_SKU.price, relationship: empty, onchain: THIN });
  const moderate = computeApproval({ amount: DEMO_SKU.price, relationship: empty, onchain: MODERATE });
  const established = computeApproval({ amount: DEMO_SKU.price, relationship: empty, onchain: ESTABLISHED });
  const afterOnTimeRel = withBook([purchase("completed_on_time", "on_time")]);
  const afterOnTime = computeApproval({ amount: DEMO_SKU.price, relationship: afterOnTimeRel, onchain: MODERATE });
  const afterLateRel = withBook([purchase("completed_late", "late")]);
  const afterLate = computeApproval({ amount: DEMO_SKU.price, relationship: afterLateRel, onchain: MODERATE });
  const openRel = withBook([purchase("active", "pending")]);
  return {
    sku: DEMO_SKU,
    firstTimeBand: [thin.limit, moderate.limit, established.limit] as const,
    firstTimeBandLabel: `${formatAmount(thin.limit)} / ${formatAmount(moderate.limit)} / ${formatAmount(established.limit)}`,
    thin: pack(thin),
    moderate: pack(moderate),
    established: pack(established),
    afterOnTime: pack(afterOnTime),
    afterLate: pack(afterLate),
    openStanding: openRel.current_standing_score,
    openLimit: openRel.current_limit,
  };
}
