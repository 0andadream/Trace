/**
 * Second entry into TRACE's existing BNPL engine.
 *
 * ACP job payloads are mapped onto runPurchaseQuote / runAcceptPurchase.
 * Numbers still come from computeApproval. USER_RELATIONSHIP is still
 * keyed by a 0x wallet, if ACP only sends an agent UUID, TRACE cannot
 * score it.
 */
import { runAcceptPurchase, runPurchaseQuote } from "@/lib/bnpl/run";
import type { PurchaseChannel, PurchaseResult } from "@/types/bnpl";

export type AcpCreditRequirement = {
  wallet: string;
  amount: number;
  merchant: string;
  jobId: string | null;
  pay_in_full: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return NaN;
}

export function parseAcpRequirement(raw: unknown): AcpCreditRequirement {
  const row = asRecord(raw);
  const nested = asRecord(row.requirement || row.payload || row.input);
  const src = { ...nested, ...row };
  const wallet = pickString(src, ["wallet", "user", "requester", "client", "principal"]);
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error(
      "ACP job must include a 0x wallet. TRACE USER_RELATIONSHIP is keyed by wallet, not by a Virtuals agent UUID.",
    );
  }
  const amount = pickNumber(src, ["loanAmount", "amount", "purchaseAmount", "principal"]);
  if (!(amount > 0)) throw new Error("ACP job must include a positive loanAmount/amount.");
  const merchant = pickString(src, ["merchant"]) || "ACP";
  const jobId = pickString(src, ["jobId", "job_id"]) || null;
  const pay_in_full = src.pay_in_full === true || src.payInFull === true;
  return { wallet: wallet.toLowerCase(), amount, merchant, jobId, pay_in_full };
}

export async function handleAcpCreditJob(input: {
  requirement: unknown;
  accept?: boolean;
  persist?: boolean;
}): Promise<{
  channel: PurchaseChannel;
  requirement: AcpCreditRequirement;
  quote: PurchaseResult;
  accepted: boolean;
  purchase?: Awaited<ReturnType<typeof runAcceptPurchase>>;
}> {
  const requirement = parseAcpRequirement(input.requirement);
  const quote = await runPurchaseQuote({
    wallet: requirement.wallet,
    amount: requirement.amount,
    merchant: requirement.merchant,
    persist: input.persist !== false,
    pay_in_full: requirement.pay_in_full,
    channel: "acp",
    acp_job_ref: requirement.jobId,
  });
  const approved =
    quote.terms.decision === "Approve" || quote.terms.decision === "Approve with reduced limit";
  if (!input.accept) {
    return { channel: "acp", requirement, quote, accepted: false };
  }
  if (!approved) {
    return { channel: "acp", requirement, quote, accepted: false };
  }
  const purchase = await runAcceptPurchase({
    wallet: requirement.wallet,
    amount: requirement.amount,
    merchant: requirement.merchant,
    pay_in_full: requirement.pay_in_full,
    channel: "acp",
    acp_job_ref: requirement.jobId,
  });
  return { channel: "acp", requirement, quote: purchase.quote, accepted: true, purchase };
}
