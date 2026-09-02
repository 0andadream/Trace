import { createPublicClient, formatEther, http, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { DEMO_SKU } from "@/lib/bnpl/walkthrough";
import { getDemoWalletAccount, getDemoWalletAddress } from "@/lib/bnpl/demoWallet";
import { sendDemoWalletRepay } from "@/lib/bnpl/sendDemoRepay";
import { runAcceptPurchase, runPurchaseQuote, runRepayInstallment } from "@/lib/bnpl/run";
import { deleteRelationship, getRelationship } from "@/lib/bnpl/store";
import {
  agentOutstandingExposure,
  effectiveCash,
  ethUsd,
  loadSolvencySnapshot,
  minAgentReserve,
  usdToEthFixed,
} from "@/lib/bnpl/solvency";
import { listRelationships } from "@/lib/bnpl/store";
import { payoutIsLive } from "@/lib/bnpl/execute";
import { getAgentAddress, getAgentBalance } from "@/lib/wallet";
import type { PurchaseResult, UserRelationship } from "@/types/bnpl";
import type { DemoEvent, DemoStatus } from "@/lib/bnpl/demoTypes";

export type { DemoEvent, DemoStatus };

type Emit = (event: DemoEvent) => void;

const MIN_DEMO_ETH = 0.02;

export async function getDemoStatus(): Promise<DemoStatus> {
  const reserve = minAgentReserve();
  const sku = DEMO_SKU;
  let demoWallet: string | null = null;
  let agent: string | null = null;
  try {
    demoWallet = getDemoWalletAddress();
  } catch {
    return {
      available: false,
      reason: "Demo temporarily unavailable — demo wallet is not configured.",
      demoWallet: null,
      agent: null,
      execute: payoutIsLive(),
      demoEth: null,
      agentEth: null,
      spendableUsd: null,
      reserve,
      sku,
    };
  }
  try {
    agent = getAgentAddress();
  } catch {
    return {
      available: false,
      reason: "Demo temporarily unavailable — agent wallet is not configured.",
      demoWallet,
      agent: null,
      execute: payoutIsLive(),
      demoEth: null,
      agentEth: null,
      spendableUsd: null,
      reserve,
      sku,
    };
  }

  const rpc = process.env.BASE_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
  let demoEth: string | null = null;
  let agentEth: string | null = null;
  let spendableUsd: number | null = null;
  try {
    demoEth = formatEther(await publicClient.getBalance({ address: getDemoWalletAddress() }));
  } catch {
    demoEth = null;
  }
  try {
    const bal = await getAgentBalance();
    agentEth = bal.eth;
  } catch {
    agentEth = null;
  }
  try {
    const all = await listRelationships();
    const snap = await loadSolvencySnapshot(agentOutstandingExposure(all));
    spendableUsd = snap.spendable_usd;
    if (effectiveCash(snap) < snap.reserve + sku.price) {
      return {
        available: false,
        reason: "Demo temporarily unavailable — agent reserve low.",
        demoWallet,
        agent,
        execute: payoutIsLive(),
        demoEth,
        agentEth,
        spendableUsd,
        reserve,
        sku,
      };
    }
  } catch {
    // solvency read failed; still allow if wallets have ETH
  }

  if (demoEth == null) {
    return {
      available: false,
      reason: "Demo temporarily unavailable — could not read the demo wallet balance.",
      demoWallet,
      agent,
      execute: payoutIsLive(),
      demoEth,
      agentEth,
      spendableUsd,
      reserve,
      sku,
    };
  }

  if (Number(demoEth) < MIN_DEMO_ETH) {
    return {
      available: false,
      reason: "Demo temporarily unavailable — demo wallet needs Base Sepolia ETH.",
      demoWallet,
      agent,
      execute: payoutIsLive(),
      demoEth,
      agentEth,
      spendableUsd,
      reserve,
      sku,
    };
  }

  return {
    available: true,
    reason: null,
    demoWallet,
    agent,
    execute: payoutIsLive(),
    demoEth,
    agentEth,
    spendableUsd,
    reserve,
    sku,
  };
}

export async function resetDemoWalletBook() {
  const wallet = getDemoWalletAddress();
  return deleteRelationship(wallet);
}

function packTerms(quote: PurchaseResult) {
  const t = quote.terms;
  return {
    terms: t,
    factors: t.factors,
    primary: t.primary_signal,
    used_onchain: t.used_onchain,
    limit: t.limit,
    installments: t.installments,
    standing: t.standing_score,
  };
}

function bookLine(rel: UserRelationship) {
  if (rel.total_purchases === 0) {
    return "USER_RELATIONSHIP is empty. No purchase history exists for this demo wallet.";
  }
  return `purchases=${rel.total_purchases} on_time=${rel.on_time_count} late=${rel.late_count} default=${rel.default_count} standing=${rel.current_standing_score} limit=${rel.current_limit}. ${rel.snapshot?.trust_note || ""}`;
}

export async function runAgentDemo(emit: Emit) {
  const pre = await getDemoStatus();
  if (!pre.available) {
    emit({ step: "unavailable", status: "error", title: "Demo unavailable", message: pre.reason || "Unavailable." });
    throw new Error(pre.reason || "Demo unavailable.");
  }

  const wallet = getDemoWalletAddress();
  getDemoWalletAccount();
  const merchant = "Test Shop";
  const amount = DEMO_SKU.price;

  emit({
    step: "reset",
    status: "start",
    title: "Preparing a first-time book",
    message: `Clearing Sibyl USER_RELATIONSHIP for the demo wallet ${wallet} so this run shows empty-book terms, then a real repay, then improved terms. The chain is not reset.`,
  });
  await resetDemoWalletBook();
  emit({
    step: "reset",
    status: "ok",
    title: "Demo wallet book cleared",
    message: "Only this demo wallet's Sibyl relationship was deleted. Other wallets are untouched.",
  });

  emit({
    step: "memory",
    status: "start",
    title: "Checking memory for this wallet…",
    message: `Sibyl get_relationship ${wallet}`,
  });
  const emptyRel = await getRelationship(wallet);
  emit({
    step: "memory",
    status: "ok",
    title: "Memory read",
    message: bookLine(emptyRel),
    purchases: emptyRel.total_purchases,
    on_time: emptyRel.on_time_count,
    standing: emptyRel.current_standing_score,
    limit: emptyRel.current_limit,
  });

  emit({
    step: "purchase1",
    status: "start",
    title: "Requesting purchase…",
    message: `POST /api/purchase accept ${DEMO_SKU.name} $${amount} as ${wallet}`,
  });
  const accepted = await runAcceptPurchase({
    wallet,
    amount,
    merchant,
    channel: "buy",
  });
  const firstQuote = accepted.quote;
  emit({
    step: "purchase1",
    status: "ok",
    title: firstQuote.terms.decision,
    message: (firstQuote.verdict.reasoning || []).join(" ") || firstQuote.terms.factors.map((f) => f.detail).join(" "),
    ...packTerms(firstQuote),
    txHash: accepted.tx.txHash || accepted.purchase.payout_tx_hash || null,
    explorerUrl: accepted.tx.explorerUrl || accepted.purchase.payout_explorer || null,
    purchases: accepted.relationship.total_purchases,
  });

  if (accepted.tx.sent && accepted.tx.txHash) {
    emit({
      step: "payout",
      status: "start",
      title: "Sending payout…",
      message: "Waiting for the agent payout on Base Sepolia.",
      txHash: accepted.tx.txHash,
      explorerUrl: accepted.tx.explorerUrl,
    });
    const rpc = process.env.BASE_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: accepted.tx.txHash as Hex,
      timeout: 120_000,
    });
    if (receipt.status !== "success") throw new Error("Agent payout did not confirm.");
    emit({
      step: "payout",
      status: "ok",
      title: "Payout confirmed",
      message: `Live on Base Sepolia. ${usdToEthFixed(accepted.purchase.amount)} ETH ≈ $${accepted.purchase.amount}.`,
      txHash: accepted.tx.txHash,
      explorerUrl: accepted.tx.explorerUrl,
    });
  } else {
    emit({
      step: "payout",
      status: "ok",
      title: "Payout simulated",
      message: accepted.tx.reason || "BASE_EXECUTE is off. The plan is stored; ETH was not broadcast.",
      txHash: null,
      explorerUrl: null,
    });
  }

  const plan = accepted.relationship.purchases.find((p) => p.purchase_id === accepted.purchase.purchase_id);
  const pending = (plan?.schedule || []).filter((i) => i.status === "pending");
  const repayUsd = pending.reduce((s, i) => s + (i.amount || 0), 0);
  if (!plan || !(repayUsd > 0)) {
    throw new Error("No pending installment to repay after the first purchase.");
  }

  emit({
    step: "repay",
    status: "start",
    title: "Signing repayment…",
    message: `Demo wallet signs a real ETH transfer of ≈ $${repayUsd.toFixed(2)} to Alex.`,
  });
  const repaid = await sendDemoWalletRepay({ amountUsd: repayUsd, ethUsd: ethUsd() });
  emit({
    step: "repay",
    status: "ok",
    title: "Repayment broadcast",
    message: `From ${repaid.from} to ${repaid.to}: ${repaid.eth} ETH.`,
    txHash: repaid.hash,
    explorerUrl: repaid.explorerUrl,
  });

  emit({
    step: "repay_record",
    status: "start",
    title: "Verifying repayment…",
    message: "POST /api/repay after on-chain verification.",
  });
  const recorded = await runRepayInstallment({
    wallet,
    purchase_id: plan.purchase_id,
    tx_hash: repaid.hash,
    pay_remaining: true,
  });
  emit({
    step: "repay_record",
    status: "ok",
    title: "Sibyl wrote the repayment",
    message: bookLine(recorded.relationship),
    txHash: repaid.hash,
    explorerUrl: repaid.explorerUrl,
    purchases: recorded.relationship.total_purchases,
    on_time: recorded.relationship.on_time_count,
    standing: recorded.standing,
    limit: recorded.limit,
  });

  emit({
    step: "purchase2",
    status: "start",
    title: "Requesting second purchase…",
    message: `POST /api/purchase quote $${amount} as the same demo wallet.`,
  });
  const second = await runPurchaseQuote({
    wallet,
    amount,
    merchant,
    persist: true,
  });
  const improved = second.terms.limit > firstQuote.terms.limit || second.terms.installments > firstQuote.terms.installments;
  emit({
    step: "purchase2",
    status: "ok",
    title: second.terms.decision,
    message: (second.verdict.reasoning || []).join(" ") || second.terms.factors.map((f) => f.detail).join(" "),
    ...packTerms(second),
    purchases: second.relationship.total_purchases,
    on_time: second.relationship.on_time_count,
    standing: second.terms.standing_score,
    limit: second.terms.limit,
  });

  emit({
    step: "done",
    status: "ok",
    title: improved ? "Terms improved from real memory" : "Second quote recorded",
    message: improved
      ? `First limit ${firstQuote.terms.limit} / ${firstQuote.terms.installments} installment(s). Second limit ${second.terms.limit} / ${second.terms.installments} installment(s). Primary ${second.terms.primary_signal}. used_onchain=${second.terms.used_onchain}.`
      : `Second quote primary ${second.terms.primary_signal}. used_onchain=${second.terms.used_onchain}.`,
    ...packTerms(second),
    limit: second.terms.limit,
    installments: second.terms.installments,
    standing: second.terms.standing_score,
    used_onchain: second.terms.used_onchain,
    primary: second.terms.primary_signal,
  });
}
