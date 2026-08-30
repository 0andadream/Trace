import type { AcpJobRecord, PurchaseRecord, QuoteRecord } from "@/types/bnpl";

import { ALEX_ACP_AGENT_ID } from "@/lib/virtuals/identity";

export type AgentEventKind =
  | "MEMORY_READ"
  | "CREDIT_DECISION"
  | "ACP_REQUEST"
  | "ACP_JOB_CREATED"
  | "ACP_JOB_EXECUTED"
  | "SETTLEMENT"
  | "MEMORY_WRITE"
  | "MEMORY_DELETED";

export type AgentEventActor = "SIBYL" | "TRACE" | "VIRTUALS" | "BASE";

export type AgentEvent = {
  id: string;
  at: string;
  wallet: string;
  kind: AgentEventKind;
  actor: AgentEventActor;
  title: string;
  detail: string;
  href?: string;
};

function lastPaid(p: PurchaseRecord) {
  let latest: { at: string; status: string; amount: number } | null = null;
  for (const inst of p.schedule || []) {
    if (!inst.paid_date || inst.status === "pending") continue;
    if (!latest || inst.paid_date > latest.at) {
      latest = { at: inst.paid_date, status: inst.status, amount: inst.amount };
    }
  }
  return latest;
}

function acpHref(acp?: AcpJobRecord) {
  return acp?.explorerUrl || undefined;
}

export function eventsFromQuote(q: QuoteRecord & { wallet_address: string }): AgentEvent[] {
  const wallet = q.wallet_address;
  const empty = q.primary_signal === "ONCHAIN_SIGNAL";
  return [
    {
      id: `${q.quote_id}-memory`,
      at: q.at,
      wallet,
      kind: "MEMORY_READ",
      actor: "SIBYL",
      title: empty ? "No previous repayment history" : "Previous repayment found",
      detail: empty
        ? "USER_RELATIONSHIP empty. On-chain baseline used for this quote."
        : `Primary ${q.primary_signal}. Standing ${(q.standing_score * 100).toFixed(0)}.`,
    },
    {
      id: `${q.quote_id}-acp-request`,
      at: q.at,
      wallet,
      kind: "ACP_REQUEST",
      actor: "VIRTUALS",
      title: "Alex identity request",
      detail: `Alex ${ALEX_ACP_AGENT_ID} requested this quote. TRACE set the numbers. Virtuals did not.`,
    },
    {
      id: `${q.quote_id}-decision`,
      at: q.at,
      wallet,
      kind: "CREDIT_DECISION",
      actor: "TRACE",
      title: q.decision,
      detail: `Limit $${q.limit}. ${q.installments} installment${q.installments === 1 ? "" : "s"}.`,
    },
  ];
}

export function eventsFromPurchase(p: PurchaseRecord & { wallet_address: string }): AgentEvent[] {
  const wallet = p.wallet_address;
  const out: AgentEvent[] = [];
  const acp = p.acp;

  if (acp && acp.status !== "skipped") {
    out.push({
      id: `${p.purchase_id}-acp-created`,
      at: p.approved_date,
      wallet,
      kind: "ACP_JOB_CREATED",
      actor: "VIRTUALS",
      title: acp.offering,
      detail: acp.jobId
        ? `Job ${acp.jobId} · $${acp.metadata?.amount ?? p.amount}`
        : acp.reason || "ACP job create attempted.",
      href: acp.createTxHash ? acp.explorerUrl : acpHref(acp),
    });
    if (acp.status === "executed") {
      out.push({
        id: `${p.purchase_id}-acp-executed`,
        at: p.approved_date,
        wallet,
        kind: "ACP_JOB_EXECUTED",
        actor: "VIRTUALS",
        title: "COMPLETED",
        detail: `Job ${acp.jobId}.`,
        href: acpHref(acp),
      });
    }
  } else if (acp?.status === "skipped") {
    out.push({
      id: `${p.purchase_id}-acp-skipped`,
      at: p.approved_date,
      wallet,
      kind: "ACP_JOB_CREATED",
      actor: "VIRTUALS",
      title: "Not broadcast",
      detail: acp.reason || "ACP job was not sent.",
    });
  }

  if (p.payout_tx_hash) {
    out.push({
      id: `${p.purchase_id}-settle`,
      at: p.payout_date || p.approved_date,
      wallet,
      kind: "SETTLEMENT",
      actor: "BASE",
      title: "Base Sepolia",
      detail: p.payout_tx_hash,
      href: p.payout_explorer,
    });
  } else if (p.payout_mode === "simulated") {
    out.push({
      id: `${p.purchase_id}-settle`,
      at: p.approved_date,
      wallet,
      kind: "SETTLEMENT",
      actor: "BASE",
      title: "Simulated",
      detail: "BASE_EXECUTE is off. Plan stored in Sibyl; ETH was not sent.",
    });
  }

  const paid = lastPaid(p);
  if (paid) {
    out.push({
      id: `${p.purchase_id}-acp-repay`,
      at: paid.at,
      wallet,
      kind: "ACP_REQUEST",
      actor: "VIRTUALS",
      title: "Alex identity request",
      detail: `Alex ${ALEX_ACP_AGENT_ID}${p.acp?.jobId ? ` · job ${p.acp.jobId}` : ""} noted this repayment. TRACE wrote Sibyl after the ETH was verified.`,
    });
    out.push({
      id: `${p.purchase_id}-memory-write`,
      at: paid.at,
      wallet,
      kind: "MEMORY_WRITE",
      actor: "SIBYL",
      title: "repaymentStatus",
      detail: paid.status === "on_time" ? "ON_TIME" : paid.status === "late" ? "LATE" : paid.status,
    });
  }

  return out;
}

export function collectAgentEvents(input: {
  quotes: Array<QuoteRecord & { wallet_address: string }>;
  purchases: Array<PurchaseRecord & { wallet_address: string }>;
}): AgentEvent[] {
  const rows: AgentEvent[] = [];
  for (const q of input.quotes) rows.push(...eventsFromQuote(q));
  for (const p of input.purchases) rows.push(...eventsFromPurchase(p));
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows;
}
