import { sendMerchantPayout, skipped, type Execution } from "@/lib/base/send";
import { askBnplReasoning } from "@/lib/bnpl/ask";
import { fetchOnchainSignal } from "@/lib/bnpl/onchain";
import { computeApproval, splitInstallments } from "@/lib/bnpl/policy";
import { formatBnplVerdict } from "@/lib/bnpl/reason";
import {
  installmentStatusFromDates,
  nextPendingIndex,
  purchaseOutcomeFromSchedule,
  recomputeRelationship,
} from "@/lib/bnpl/relationship";
import {
  agentOutstandingExposure,
  bookFromSnapshot,
  usdToEthFixed,
  loadSolvencySnapshot,
} from "@/lib/bnpl/solvency";
import { bnplHealth, getRelationship, listRelationships, saveRelationship } from "@/lib/bnpl/store";
import { executeBnplSettlementJob, type AcpJobResult } from "@/lib/virtuals/acp";
import { decisionReasonFromBook, repaymentStatusFromRel } from "@/lib/virtuals/metadata";
import type {
  AcpJobRecord,
  Installment,
  OnchainSignal,
  OverrideOutcome,
  PurchaseChannel,
  PurchaseRecord,
  PurchaseResult,
  QuoteRecord,
  UserRelationship,
} from "@/types/bnpl";

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

export async function runPurchaseQuote(input: {
  wallet: string;
  amount: number;
  merchant?: string;
  persist?: boolean;
  onchainOverride?: OnchainSignal;
  pay_in_full?: boolean;
  installments?: number;
  channel?: PurchaseChannel;
  acp_job_ref?: string | null;
}): Promise<PurchaseResult> {
  const wallet = requireWallet(input.wallet);
  const merchant = (input.merchant || "Test Shop").trim() || "Test Shop";
  const amount = Number(input.amount);
  const relationship = await getRelationship(wallet);
  const onchain = input.onchainOverride ?? (await fetchOnchainSignal(wallet));
  const all = await listRelationships();
  const exposure = agentOutstandingExposure(all);
  const solvency = await loadSolvencySnapshot(exposure);
  const activePlans = all.reduce((n, r) => n + (r.active_count || 0), 0);
  const terms = computeApproval({
    amount,
    relationship,
    onchain,
    solvency,
    pay_in_full: input.pay_in_full,
    installments: input.installments,
  });
  const book = bookFromSnapshot(solvency, activePlans);
  const verdict = await askBnplReasoning({
    terms,
    relationship,
    onchain: terms.used_onchain ? onchain : null,
    amount,
    merchant,
  });
  verdict.raw = formatBnplVerdict(verdict);

  if (input.persist !== false) {
    const at = new Date().toISOString();
    const record: QuoteRecord = {
      quote_id: newId("quote"),
      at,
      amount,
      merchant,
      limit: terms.available,
      installments: terms.installments,
      due_dates: terms.due_dates,
      decision: terms.decision,
      standing_score: terms.standing_score,
      primary_signal: terms.primary_signal,
      reasoning: verdict.reasoning,
      channel: input.channel || "buy",
      acp_job_ref: input.acp_job_ref || null,
    };
    const base =
      relationship.total_purchases === 0 && relationship.quotes.length === 0
        ? { ...relationship, first_seen: at }
        : relationship;
    await saveRelationship({
      ...base,
      last_seen: at,
      quotes: [...(base.quotes || []), record],
    });
  }

  const sibyl = await bnplHealth();
  return {
    request: { wallet, amount, merchant },
    relationship: await getRelationship(wallet),
    onchain: terms.used_onchain ? onchain : null,
    terms,
    verdict,
    agent_book: book,
    sibyl: {
      engine: String(sibyl.engine),
      db: String(sibyl.db),
      tenant: String(sibyl.tenant),
      relationshipCount: Number((sibyl as { relationshipCount?: number }).relationshipCount || 0),
      loadBearing: Boolean(sibyl.loadBearing),
    },
  };
}

export async function runAcceptPurchase(input: {
  wallet: string;
  amount: number;
  merchant?: string;
  override?: boolean;
  pay_in_full?: boolean;
  installments?: number;
  channel?: PurchaseChannel;
  acp_job_ref?: string | null;
}): Promise<{
  relationship: UserRelationship;
  purchase: PurchaseRecord;
  quote: PurchaseResult;
  tx: Execution;
  payout_mode: "on_chain" | "simulated";
  acp: AcpJobRecord;
}> {
  const wallet = requireWallet(input.wallet);
  const merchant = (input.merchant || "Test Shop").trim() || "Test Shop";
  const amount = Number(input.amount);
  const quoted = await runPurchaseQuote({
    wallet,
    amount,
    merchant,
    persist: true,
    pay_in_full: input.pay_in_full,
    installments: input.installments,
    channel: input.channel,
    acp_job_ref: input.acp_job_ref,
  });
  const { terms } = quoted;

  if (terms.skipped_scoring || terms.decision === "Ceiling blocked") {
    throw new Error(terms.ceiling.reason);
  }

  let acceptedAmount = amount;
  let override: OverrideOutcome | null = null;

  if (terms.decision === "Decline") {
    if (!input.override) {
      throw new Error("Quote was Decline. Pass override: true to approve anyway (recorded as a human override).");
    }
    override = {
      at: new Date().toISOString(),
      kind: "approve_declined",
      note: "Human overrode a Decline and originated the purchase plan.",
    };
  } else if (terms.decision === "Approve with reduced limit") {
    acceptedAmount = terms.reduced_limit ?? 0;
    if (!(acceptedAmount > 0)) throw new Error("Reduced limit is 0.");
  }

  const n = Math.max(1, terms.installments || 1);
  const totalDue = terms.total_due || acceptedAmount;
  const split = splitInstallments(totalDue, n);
  const dues = terms.due_dates.length === n ? terms.due_dates : quoted.terms.due_dates;
  const schedule: Installment[] = split.amounts.map((amt, i) => ({
    amount: amt,
    due_date: dues[i] || new Date(Date.now() + (i + 1) * 14 * 86400000).toISOString(),
    paid_date: null,
    status: "pending",
  }));

  const origin = new Date().toISOString();
  const payoutTo = wallet as `0x${string}`;

  const acpLive = await executeBnplSettlementJob({
    wallet,
    loanAmount: acceptedAmount,
    creditDecision: terms.limit || terms.available || acceptedAmount,
    memoryVerified: quoted.relationship.total_purchases > 0,
    repaymentStatus: repaymentStatusFromRel(quoted.relationship),
    decisionReason: decisionReasonFromBook(quoted.relationship),
  });
  const acp: AcpJobRecord = toAcpRecord(acpLive);

  let tx: Execution = skipped("simulated");
  let payoutMode: "on_chain" | "simulated" = "simulated";
  try {
    if (process.env.BASE_EXECUTE === "1") {
      const sendAmount = Number(usdToEthFixed(acceptedAmount));
      tx = await sendMerchantPayout({ token: "ETH", amount: sendAmount, merchant: payoutTo });
      if (tx.sent && tx.txHash) payoutMode = "on_chain";
      else tx = skipped(tx.reason || "Broadcast skipped; recording simulated payout.");
    } else {
      tx = skipped("BASE_EXECUTE is off. Merchant payout is simulated in Sibyl, not broadcast.");
    }
  } catch (err) {
    tx = skipped(err instanceof Error ? err.message : "broadcast failed");
  }

  const purchase: PurchaseRecord = {
    purchase_id: newId("buy"),
    amount: acceptedAmount,
    merchant,
    installments: n,
    approved_date: origin,
    schedule,
    outcome: "active",
    payout_tx_hash: tx.txHash ?? null,
    payout_amount: acceptedAmount,
    payout_date: origin,
    payout_mode: payoutMode,
    payout_to: payoutTo,
    payout_explorer: tx.explorerUrl,
    acp,
    principal: terms.principal || acceptedAmount,
    interest_rate: terms.interest_rate || 0,
    interest_amount: terms.interest_amount || 0,
    total_due: terms.total_due || acceptedAmount,
    pay_in_full: terms.pay_in_full,
    channel: input.channel || "buy",
    acp_job_ref: input.acp_job_ref || acp.jobId || null,
  };

  const rel = quoted.relationship;
  purchase.score_before = rel.current_standing_score;
  purchase.limit_before = rel.current_limit;
  const drafted = recomputeRelationship({
    ...rel,
    last_seen: origin,
    purchases: [...rel.purchases, purchase],
    override_count: rel.override_count + (override ? 1 : 0),
    override_outcomes: override
      ? [...rel.override_outcomes, { ...override, purchase_id: purchase.purchase_id }]
      : rel.override_outcomes,
  });
  const last = drafted.purchases[drafted.purchases.length - 1];
  if (last) {
    last.score_after = drafted.current_standing_score;
    last.limit_after = drafted.current_limit;
  }
  purchase.score_after = drafted.current_standing_score;
  purchase.limit_after = drafted.current_limit;

  const saved = await saveRelationship(drafted);
  const stored = saved.purchases.find((p) => p.purchase_id === purchase.purchase_id) || purchase;
  return { relationship: saved, purchase: stored, quote: quoted, tx, payout_mode: payoutMode, acp };
}

function toAcpRecord(job: AcpJobResult): AcpJobRecord {
  return {
    offering: "BNPL Settlement",
    status: job.status,
    jobId: job.jobId,
    onchainStatus: job.onchainStatus,
    createTxHash: job.createTxHash,
    executeTxHash: job.executeTxHash,
    explorerUrl: job.explorerUrl,
    contract: job.contract,
    chainId: job.chainId,
    reason: job.reason,
    metadata: job.metadata,
  };
}

export async function runRepayInstallment(input: {
  wallet: string;
  purchase_id: string;
  installment_index?: number;
  repaid_at?: string;
  mark_default?: boolean;
  tx_hash?: string;
  pay_remaining?: boolean;
}) {
  const wallet = requireWallet(input.wallet);
  const rel = await getRelationship(wallet);
  const idx = rel.purchases.findIndex((p) => p.purchase_id === input.purchase_id);
  if (idx < 0) throw new Error(`purchase ${input.purchase_id} not found for ${wallet}`);
  const current = rel.purchases[idx];
  if (current.outcome !== "active") {
    throw new Error(`purchase ${input.purchase_id} is already ${current.outcome}`);
  }

  const repaidAt = input.repaid_at || new Date().toISOString();
  const schedule = current.schedule.map((i) => ({ ...i }));

  if (input.mark_default) {
    const purchases = rel.purchases.slice();
    purchases[idx] = { ...current, outcome: "defaulted", schedule };
    const saved = await saveRelationship({ ...rel, last_seen: repaidAt, purchases });
    return {
      relationship: saved,
      purchase: purchases[idx],
      installment: null,
      outcome: "defaulted" as const,
      standing: saved.current_standing_score,
      limit: saved.current_limit,
    };
  }

  const pendingIdx = schedule
    .map((row, i) => (row.status === "pending" ? i : -1))
    .filter((i) => i >= 0);
  const slot = input.installment_index ?? nextPendingIndex(current);
  const targets = input.pay_remaining
    ? pendingIdx
    : slot >= 0
      ? [slot]
      : [];
  if (!targets.length) throw new Error("no pending installment to repay");
  for (const i of targets) {
    if (schedule[i].status !== "pending") {
      throw new Error(`installment ${i} is already ${schedule[i].status}`);
    }
  }
  const repayUsd = targets.reduce((s, i) => s + (schedule[i].amount || 0), 0);

  const { verifyUserRepay } = await import("@/lib/bnpl/verifyUserRepay");
  const verified = await verifyUserRepay({
    txHash: input.tx_hash || "",
    from: wallet,
    amount: repayUsd,
  });

  for (const i of targets) {
    const status = installmentStatusFromDates(schedule[i].due_date, repaidAt);
    schedule[i] = {
      ...schedule[i],
      paid_date: repaidAt,
      status,
      repayment_kind: "on_chain",
      repay_tx_hash: input.tx_hash,
      repay_explorer: verified.explorerUrl,
    };
  }
  const outcome = purchaseOutcomeFromSchedule(schedule);
  const purchases = rel.purchases.slice();
  purchases[idx] = { ...current, schedule, outcome };
  const saved = await saveRelationship({ ...rel, last_seen: repaidAt, purchases });
  return {
    relationship: saved,
    purchase: purchases[idx],
    installment: schedule[targets[0]],
    paid_count: targets.length,
    paid_usd: repayUsd,
    outcome,
    standing: saved.current_standing_score,
    limit: saved.current_limit,
    repayment_kind: "on_chain" as const,
    tx_hash: input.tx_hash,
    explorerUrl: verified.explorerUrl,
  };
}

export async function bnplSnapshot() {
  const relationships = await listRelationships();
  const exposure = agentOutstandingExposure(relationships);
  const solvency = await loadSolvencySnapshot(exposure);
  const activePlans = relationships.reduce((n, r) => n + (r.active_count || 0), 0);
  return {
    relationships,
    agent_book: bookFromSnapshot(solvency, activePlans),
    sibyl: await bnplHealth(),
  };
}
