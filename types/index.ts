/**
 * transfer — fully supported (decide + broadcast).
 * approve / swap / contract — experimental: scored and stored, not broadcast.
 */
export type TxAction = "transfer" | "approve" | "swap" | "contract";
export const BROADCAST_ACTIONS: TxAction[] = ["transfer"];
export const EXPERIMENTAL_ACTIONS: TxAction[] = ["approve", "swap", "contract"];

export type VerificationStatus = "verified" | "unverified" | "rejected";
export type ActionOutcome = "success" | "rejected" | "incident" | "pending" | "ceiling_blocked";
export type Decision = "Proceed" | "Proceed with flag" | "Hold for approval" | "Ceiling blocked";
export type ReasoningSource = "deterministic" | "grok-4.6";

export type TreasuryRequest = {
  action: TxAction;
  token: string;
  amount: number;
  recipient: string;
  note?: string;
};

export type ActionRecord = {
  id: string;
  at: string;
  action: TxAction;
  token: string;
  amount: number;
  recipient: string;
  counterpartyLabel: string;
  /** Optional. Absent = address-only counterparty (no verification nudge). */
  verification?: VerificationStatus;
  outcome: ActionOutcome;
  decision: Decision;
  riskScore: number;
  userOverride: boolean;
  overrideDirection: "approved" | "rejected" | null;
  seed: boolean;
  reasoning: string[];
  reasoningSource?: ReasoningSource;
  txHash?: string;
  explorerUrl?: string;
};

export type ActionTypeStats = {
  count: number;
  successful: number;
  rejected: number;
  incidents: number;
  overrides: number;
  holdDecisions: number;
  avgAmount: number;
};

export type AgentReputation = {
  agent: string;
  totalActions: number;
  successfulActions: number;
  rejectedActions: number;
  incidentActions: number;
  pendingActions: number;
  userOverrides: number;
  holdDecisions: number;
  holdOverrideRate: number;
  incidentRate: number;
  rejectionRate: number;
  thinHistory: boolean;
  rejectedUnverifiedCount: number;
  byActionType: Record<TxAction, ActionTypeStats>;
};

export type CounterpartyProfile = {
  address: string;
  label: string;
  /** Present only when stored on the record. Address-only profiles omit this. */
  verification?: VerificationStatus;
  interactionCount: number;
  successful: number;
  rejected: number;
  incidents: number;
  overrides: number;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  lastAt: string | null;
  actions: TxAction[];
};

export type RiskFactor = {
  id: string;
  delta: number;
  reason: string;
};

export type RiskAssessment = {
  score: number;
  factors: RiskFactor[];
};

export type MemoryBlocks = {
  AGENT_REPUTATION: AgentReputation;
  COUNTERPARTY_PROFILE: CounterpartyProfile | null;
  RISK_SCORE: number;
};

export type AlexVerdict = {
  decision: Decision;
  reasoning: string[];
  risk: number;
  source: ReasoningSource;
  raw: string;
};

export type SibylHealth = {
  engine: string;
  db: string;
  tenant: string;
  tier: string;
  actionCount: number;
  counterpartyCount: number;
  recentEvents: number;
  lastEvent: unknown;
  freeTier: unknown;
  loadBearing: boolean;
};

export type Execution = {
  chainId: number;
  chainLabel: string;
  sent: boolean;
  from?: `0x${string}`;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  reason?: string;
};

export type DecideResult = {
  id: string;
  at: string;
  request: TreasuryRequest;
  counterpartyLabel: string;
  memory: MemoryBlocks;
  assessment: RiskAssessment;
  verdict: AlexVerdict;
  emptyCounterparty: boolean;
  sibyl: SibylHealth;
  tx: Execution;
};

export type PreviewResult = {
  request: TreasuryRequest;
  memory: MemoryBlocks;
  assessment: RiskAssessment;
  emptyCounterparty: boolean;
  sibyl: SibylHealth;
};

export type DecideRequestBody = Partial<TreasuryRequest> & {
  /** Skip persisting (tests / dry run). */
  persist?: boolean;
};

export type ResolveBody = {
  id: string;
  resolution: "approved" | "rejected";
};
