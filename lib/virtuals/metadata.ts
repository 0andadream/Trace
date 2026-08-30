/**
 * Public ACP job metadata. Never attach secrets, keys, or personal data
 * beyond the user's public wallet address.
 */

const SECRET_KEY =
  /private|secret|password|mnemonic|credential|api[_-]?key|authorization|cookie|session/i;

export type PublicJobMetadata = {
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

export type SettlementFields = {
  wallet: string;
  loanAmount: number;
  creditDecision: number;
  memoryVerified: boolean;
  repaymentStatus: "ON_TIME" | "LATE" | "NONE" | "DEFAULTED";
  decisionReason: string;
};

function publicWallet(wallet: string) {
  const w = (wallet || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(w)) return "0x";
  return w;
}

export function publicJobMetadata(input: SettlementFields): PublicJobMetadata {
  return {
    product: "TRACE",
    agent: "Alex",
    purpose: "BNPL settlement",
    user: publicWallet(input.wallet),
    amount: Number(input.loanAmount) || 0,
    memoryVerified: Boolean(input.memoryVerified),
    memoryProvider: "Sibyl",
    creditLimit: Number(input.creditDecision) || 0,
    decisionReason: String(input.decisionReason || "UNSET").slice(0, 64),
  };
}

export function assertPublicMetadata(value: Record<string, unknown>) {
  for (const key of Object.keys(value)) {
    if (SECRET_KEY.test(key)) {
      throw new Error(`Refusing to attach secret field "${key}" to public ACP metadata.`);
    }
  }
  const blob = JSON.stringify(value).toLowerCase();
  if (blob.includes("private_key") || blob.includes("begin private")) {
    throw new Error("Refusing to attach a private key to public ACP metadata.");
  }
  return value;
}

export function repaymentStatusFromRel(rel: {
  on_time_count?: number;
  late_count?: number;
  default_count?: number;
}): SettlementFields["repaymentStatus"] {
  if ((rel.default_count || 0) >= 1) return "DEFAULTED";
  if ((rel.on_time_count || 0) >= 1) return "ON_TIME";
  if ((rel.late_count || 0) >= 1) return "LATE";
  return "NONE";
}

export function decisionReasonFromBook(rel: {
  total_purchases?: number;
  on_time_count?: number;
  default_count?: number;
}): string {
  if ((rel.default_count || 0) >= 1) return "DEFAULT_IN_BOOK";
  if ((rel.on_time_count || 0) >= 1) return "ON_TIME_REPAYMENT";
  if ((rel.total_purchases || 0) > 0) return "RELATIONSHIP_HISTORY";
  return "NO_REPAYMENT_HISTORY";
}
