/**
 * Reputation-weighted lending types.
 *
 * USER_RELATIONSHIP is the agent's own memory of loans it originated with
 * this wallet. It cannot be reconstructed by reading the chain.
 * ONCHAIN_SIGNAL is fetched fresh and is never stored as memory.
 */

export type LoanOutcome = "on_time" | "late" | "defaulted" | "active";

export type LendingDecision =
  | "Approve"
  | "Approve with reduced limit"
  | "Decline"
  | "Ceiling blocked";

export type RatePrimary = "USER_RELATIONSHIP" | "ONCHAIN_SIGNAL";

export type LoanRecord = {
  loan_id: string;
  amount: number;
  asset: string;
  rate_quoted: number;
  collateral_ratio: number;
  origin_date: string;
  due_date: string;
  repaid_date: string | null;
  outcome: LoanOutcome;
};

export type QuoteRecord = {
  quote_id: string;
  at: string;
  amount: number;
  asset: string;
  apr: number;
  collateral_ratio: number;
  decision: LendingDecision;
  standing_score: number;
  primary_signal: RatePrimary;
  reasoning: string[];
};

export type OverrideOutcome = {
  at: string;
  kind: "approve_declined" | "raise_limit" | "cut_rate" | "other";
  note: string;
  loan_id?: string;
};

export type CollateralPosition = {
  asset: string;
  amount: number;
  at: string;
};

export type UserRelationship = {
  wallet_address: string;
  first_seen: string;
  last_seen: string;
  loans: LoanRecord[];
  quotes: QuoteRecord[];
  total_loans: number;
  on_time_count: number;
  late_count: number;
  default_count: number;
  active_count: number;
  total_borrowed: number;
  total_repaid: number;
  override_count: number;
  override_outcomes: OverrideOutcome[];
  collateral: CollateralPosition[];
  /** Computed from history on every read. Never treated as a stored primitive. */
  current_standing_score: number;
};

export type OnchainSignal = {
  wallet_address: string;
  wallet_age_days: number;
  tx_count: number;
  known_protocol_interactions: string[];
  fetched_at: string;
  /** Always false, this object is never written to Sibyl. */
  cached: false;
  used_only_when: "USER_RELATIONSHIP.total_loans == 0";
  fetch_error?: boolean;
};

export type LendingFactor = {
  id: string;
  detail: string;
};

export type RateQuote = {
  decision: LendingDecision;
  apr: number;
  collateral_ratio: number;
  required_collateral: number;
  max_borrow_for_user: number;
  reduced_limit: number | null;
  standing_score: number;
  primary_signal: RatePrimary;
  used_onchain: boolean;
  relationship_empty: boolean;
  skipped_scoring: boolean;
  factors: LendingFactor[];
  ceiling: {
    blocked: boolean;
    max: number;
    reason: string;
  };
};

export type LendingVerdict = {
  decision: LendingDecision;
  reasoning: string[];
  score: number;
  source: "deterministic" | "grok-4.6";
  raw: string;
};

export type QuoteRequest = {
  wallet: string;
  amount: number;
  asset: string;
};

export type QuoteResult = {
  request: QuoteRequest;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  quote: RateQuote;
  verdict: LendingVerdict;
  sibyl: {
    engine: string;
    db: string;
    tenant: string;
    relationshipCount?: number;
    loadBearing: boolean;
  };
};

export type SupplyRequest = {
  wallet: string;
  amount: number;
  asset: string;
};

export type RepayRequest = {
  wallet: string;
  loan_id: string;
  repaid_at?: string;
  /** Explicit default. Otherwise outcome is on_time/late from due vs repaid. */
  mark_default?: boolean;
};
