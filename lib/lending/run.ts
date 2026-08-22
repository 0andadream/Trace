import { sendTransfer, skipped, type Execution } from "@/lib/base/send";
import { askLendingReasoning } from "@/lib/lending/ask";
import { applyCollateralFloor } from "@/lib/lending/ceiling";
import { fetchOnchainSignal } from "@/lib/lending/onchain";
import { computeRateQuote } from "@/lib/lending/rate";
import { formatLendingVerdict } from "@/lib/lending/reason";
import { outcomeFromDates, totalCollateral } from "@/lib/lending/relationship";
import { getRelationship, lendingHealth, listRelationships, saveRelationship } from "@/lib/lending/store";
import type {
  LoanRecord,
  OnchainSignal,
  OverrideOutcome,
  QuoteRecord,
  QuoteResult,
  UserRelationship,
} from "@/types/lending";

const DEFAULT_TERM_DAYS = 14;

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function requireWallet(wallet: string) {
  const addr = (wallet || "").trim();
  if (!isAddress(addr)) throw new Error("wallet must be a 0x address.");
  return addr.toLowerCase();
}

export async function runQuote(input: {
  wallet: string;
  amount: number;
  asset?: string;
  persist?: boolean;
  onchainOverride?: OnchainSignal;
}): Promise<QuoteResult> {
  const wallet = requireWallet(input.wallet);
  const asset = (input.asset || "USDC").toUpperCase();
  const amount = Number(input.amount);
  const relationship = await getRelationship(wallet);
  const onchain = input.onchainOverride ?? (await fetchOnchainSignal(wallet));
  const quote = computeRateQuote({ amount, asset, relationship, onchain });
  const verdict = await askLendingReasoning({
    quote,
    relationship,
    onchain: quote.used_onchain ? onchain : null,
    amount,
    asset,
  });
  verdict.raw = formatLendingVerdict(verdict);

  if (input.persist !== false && !quote.skipped_scoring) {
    const at = new Date().toISOString();
    const record: QuoteRecord = {
      quote_id: newId("quote"),
      at,
      amount,
      asset,
      apr: quote.apr,
      collateral_ratio: quote.collateral_ratio,
      decision: quote.decision,
      standing_score: quote.standing_score,
      primary_signal: quote.primary_signal,
      reasoning: verdict.reasoning,
    };
    const base = relationship.total_loans === 0 && relationship.quotes.length === 0
      ? { ...relationship, first_seen: at }
      : relationship;
    await saveRelationship({
      ...base,
      last_seen: at,
      quotes: [...(base.quotes || []), record],
    });
  }

  const sibyl = await lendingHealth();
  return {
    request: { wallet, amount, asset },
    relationship: await getRelationship(wallet),
    onchain: quote.used_onchain ? onchain : null,
    quote,
    verdict,
    sibyl: {
      engine: String(sibyl.engine),
      db: String(sibyl.db),
      tenant: String(sibyl.tenant),
      relationshipCount: Number((sibyl as { relationshipCount?: number }).relationshipCount || 0),
      loadBearing: Boolean(sibyl.loadBearing),
    },
  };
}

export async function runSupply(input: { wallet: string; amount: number; asset?: string }) {
  const wallet = requireWallet(input.wallet);
  const asset = (input.asset || "USDC").toUpperCase();
  const amount = Number(input.amount);
  if (!(amount > 0)) throw new Error("supply amount must be greater than 0.");
  const rel = await getRelationship(wallet);
  const at = new Date().toISOString();
  const updated = await saveRelationship({
    ...rel,
    first_seen: rel.quotes.length || rel.loans.length || rel.collateral.length ? rel.first_seen : at,
    last_seen: at,
    collateral: [...rel.collateral, { asset, amount, at }],
  });
  return { relationship: updated, supplied: { asset, amount, at } };
}

export async function runBorrow(input: {
  wallet: string;
  amount: number;
  asset?: string;
  override?: boolean;
}): Promise<{ relationship: UserRelationship; loan: LoanRecord; quote: QuoteResult; tx: Execution }> {
  const wallet = requireWallet(input.wallet);
  const asset = (input.asset || "USDC").toUpperCase();
  const amount = Number(input.amount);
  const quoted = await runQuote({ wallet, amount, asset, persist: true });
  const { quote } = quoted;

  if (quote.skipped_scoring || quote.decision === "Ceiling blocked") {
    throw new Error(quote.ceiling.reason);
  }

  let acceptedAmount = amount;
  let decision = quote.decision;
  let override: OverrideOutcome | null = null;

  if (quote.decision === "Decline") {
    if (!input.override) {
      throw new Error("Quote was Decline. Pass override: true to originate anyway (recorded as a human override).");
    }
    override = {
      at: new Date().toISOString(),
      kind: "approve_declined",
      note: "Human overrode a Decline and originated the loan.",
    };
    decision = "Approve";
  } else if (quote.decision === "Approve with reduced limit") {
    acceptedAmount = quote.reduced_limit ?? 0;
    if (!(acceptedAmount > 0)) throw new Error("Reduced limit is 0. Supply more collateral or request less.");
  }

  const rel = quoted.relationship;
  const ratio = applyCollateralFloor(quote.collateral_ratio);
  const required = acceptedAmount * ratio;
  const posted = totalCollateral(rel, asset) + totalCollateral(rel, "ETH");
  if (posted + 1e-9 < required) {
    throw new Error(
      `Posted collateral ${posted} is below required ${required.toFixed(2)} (${ratio.toFixed(2)}x on ${acceptedAmount} ${asset}). Supply first.`,
    );
  }

  const origin = new Date();
  const due = new Date(origin.getTime() + DEFAULT_TERM_DAYS * 86400000);
  const loan: LoanRecord = {
    loan_id: newId("loan"),
    amount: acceptedAmount,
    asset,
    rate_quoted: quote.apr,
    collateral_ratio: ratio,
    origin_date: origin.toISOString(),
    due_date: due.toISOString(),
    repaid_date: null,
    outcome: "active",
  };

  const next: UserRelationship = {
    ...rel,
    last_seen: origin.toISOString(),
    loans: [...rel.loans, loan],
    override_count: rel.override_count + (override ? 1 : 0),
    override_outcomes: override ? [...rel.override_outcomes, { ...override, loan_id: loan.loan_id }] : rel.override_outcomes,
  };

  let tx: Execution = skipped("Loan recorded in Sibyl. Broadcast off or skipped.");
  try {
    if (process.env.BASE_EXECUTE === "1") {
      tx = await sendTransfer({
        action: "transfer",
        token: asset,
        amount: acceptedAmount,
        recipient: wallet,
      });
    }
  } catch (err) {
    tx = skipped(err instanceof Error ? err.message : "broadcast failed");
  }

  const saved = await saveRelationship(next);
  return { relationship: saved, loan, quote: { ...quoted, quote: { ...quote, decision } }, tx };
}

export async function runRepay(input: {
  wallet: string;
  loan_id: string;
  repaid_at?: string;
  mark_default?: boolean;
}) {
  const wallet = requireWallet(input.wallet);
  const rel = await getRelationship(wallet);
  const idx = rel.loans.findIndex((l) => l.loan_id === input.loan_id);
  if (idx < 0) throw new Error(`loan ${input.loan_id} not found for ${wallet}`);
  const current = rel.loans[idx];
  if (current.outcome !== "active") {
    throw new Error(`loan ${input.loan_id} is already ${current.outcome}`);
  }
  const repaidAt = input.repaid_at || new Date().toISOString();
  const outcome = input.mark_default ? "defaulted" : outcomeFromDates(current.due_date, repaidAt);
  const loans = rel.loans.slice();
  loans[idx] = {
    ...current,
    repaid_date: input.mark_default ? current.repaid_date : repaidAt,
    outcome,
  };
  const saved = await saveRelationship({
    ...rel,
    last_seen: repaidAt,
    loans,
  });
  return {
    relationship: saved,
    loan: loans[idx],
    outcome,
    standing: saved.current_standing_score,
  };
}

export async function lendingSnapshot() {
  const relationships = await listRelationships();
  return {
    relationships,
    sibyl: await lendingHealth(),
  };
}


