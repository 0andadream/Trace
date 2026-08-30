/**
 * BNPL types.
 *
 * USER_RELATIONSHIP is this agent's memory of purchases it approved
 * for this wallet. It cannot be reconstructed from the chain.
 * ONCHAIN_SIGNAL is fetched fresh and is never stored as memory.
 */

export type InstallmentStatus = "pending" | "on_time" | "late";

export type PurchaseOutcome = "completed_on_time" | "completed_late" | "defaulted" | "active";

export type BnplDecision = "Approve" | "Approve with reduced limit" | "Decline" | "Ceiling blocked";

export type PolicyPrimary = "USER_RELATIONSHIP" | "ONCHAIN_SIGNAL";

export type Installment = {
  due_date: string;
  paid_date: string | null;
  status: InstallmentStatus;
  amount: number;
  repayment_kind?: "attested" | "on_chain";
  repay_tx_hash?: string | null;
  repay_explorer?: string | null;
};

export type PayoutMode = "on_chain" | "simulated";

/** How the quote/purchase entered TRACE. Standing ignores this. */
export type PurchaseChannel = "buy" | "acp";

export type AcpJobRecord = {
  offering: "BNPL Settlement";
  status: "created" | "executed" | "skipped" | "failed";
  jobId?: string;
  onchainStatus?: number;
  createTxHash?: string;
  executeTxHash?: string;
  explorerUrl?: string;
  contract?: string;
  chainId?: number;
  reason?: string;
  metadata?: {
    product: "TRACE";
    agent: "Alex";
    purpose: "BNPL settlement";
    user: string;
    amount: number;
    memoryVerified: boolean;
    memoryProvider: "Sibyl";
    creditLimit: number;
    decisionReason: string;
  };
};

export type PurchaseRecord = {
  purchase_id: string;
  amount: number;
  merchant: string;
  installments: number;
  approved_date: string;
  schedule: Installment[];
  outcome: PurchaseOutcome;
  payout_tx_hash?: string | null;
  payout_amount?: number;
  payout_date?: string;
  payout_mode?: PayoutMode;
  payout_to?: string;
  payout_explorer?: string;
  acp?: AcpJobRecord;
  score_before?: number;
  score_after?: number;
  limit_before?: number;
  limit_after?: number;
  principal?: number;
  interest_rate?: number;
  interest_amount?: number;
  total_due?: number;
  pay_in_full?: boolean;
  channel?: PurchaseChannel;
  acp_job_ref?: string | null;
};

export type QuoteRecord = {
  quote_id: string;
  at: string;
  amount: number;
  merchant: string;
  limit: number;
  installments: number;
  due_dates: string[];
  decision: BnplDecision;
  standing_score: number;
  primary_signal: PolicyPrimary;
  reasoning: string[];
  channel?: PurchaseChannel;
  acp_job_ref?: string | null;
};

export type OverrideOutcome = {
  at: string;
  kind: "approve_declined" | "raise_limit" | "other";
  note: string;
  purchase_id?: string;
};

export type UserRelationship = {
  wallet_address: string;
  first_seen: string;
  last_seen: string;
  purchases: PurchaseRecord[];
  quotes: QuoteRecord[];
  total_purchases: number;
  on_time_count: number;
  late_count: number;
  default_count: number;
  active_count: number;
  total_purchased: number;
  total_repaid: number;
  override_count: number;
  override_outcomes: OverrideOutcome[];
  /** Computed from history on every read. Never treated as a stored primitive. */
  current_limit: number;
  current_standing_score: number;
};

export type OnchainSignal = {
  wallet_address: string;
  wallet_age_days: number;
  tx_count: number;
  fetched_at: string;
  cached: false;
  used_only_when: "USER_RELATIONSHIP.total_purchases == 0";
  fetch_error?: boolean;
};

export type BnplFactor = {
  id: string;
  detail: string;
};

export type ApprovalOutcome = "insolvent_declined" | null;

export type ApprovalTerms = {
  decision: BnplDecision;
  outcome: ApprovalOutcome;
  limit: number;
  available: number;
  installments: number;
  installment_amount: number;
  due_dates: string[];
  reduced_limit: number | null;
  standing_score: number;
  outstanding: number;
  active_plans: number;
  payout_amount: number;
  principal: number;
  interest_rate: number;
  interest_amount: number;
  total_due: number;
  max_installments: number;
  pay_in_full: boolean;
  agent_exposure: number;
  primary_signal: PolicyPrimary;
  used_onchain: boolean;
  relationship_empty: boolean;
  skipped_scoring: boolean;
  factors: BnplFactor[];
  ceiling: {
    blocked: boolean;
    max: number;
    max_active: number;
    reason: string;
  };
};

export type BnplVerdict = {
  decision: BnplDecision;
  reasoning: string[];
  /** One-line template summary. Not an LLM. */
  why: string;
  terms: string;
  score: number;
  source: "deterministic" | "grok-4.6";
  raw: string;
};

export type PurchaseRequest = {
  wallet: string;
  amount: number;
  merchant: string;
};

export type PurchaseResult = {
  request: PurchaseRequest;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  terms: ApprovalTerms;
  verdict: BnplVerdict;
  agent_book?: {
    outstanding_exposure: number;
    active_plans: number;
    reserve: number;
    spendable_usd: number;
    wallet_usdc: number;
    deployable: number;
    execute: boolean;
    simulated_balance: boolean;
    address?: string;
  };
  sibyl: {
    engine: string;
    db: string;
    tenant: string;
    relationshipCount?: number;
    loadBearing: boolean;
  };
};
