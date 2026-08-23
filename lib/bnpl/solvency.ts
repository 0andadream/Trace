/**
 * Agent solvency — hard ceiling, independent of user reputation.
 *
 * The agent fronts merchant payouts from its own wallet. It cannot approve
 * a purchase that would leave cash below MIN_AGENT_RESERVE, or that would
 * push book exposure (unpaid plans across ALL users) past deployable capital.
 *
 * When BASE_EXECUTE is off, the on-chain balance does not fall, so exposure
 * is subtracted from the wallet figure. That is what makes simulated mode
 * still load-bearing.
 */
import { round2 } from "@/lib/format";

export function minAgentReserve() {
  const n = Number(process.env.MIN_AGENT_RESERVE ?? 5);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export function ethUsd() {
  const n = Number(process.env.ETH_USD ?? 2000);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

/** Display amounts are USDC. Settlement is native ETH at this rate. */
export function usdToEth(usd: number, rate = ethUsd()) {
  if (!(rate > 0)) return 0;
  return usd / rate;
}

export function usdToEthFixed(usd: number, rate = ethUsd(), digits = 8) {
  return usdToEth(usd, rate).toFixed(digits);
}

export type SolvencySnapshot = {
  wallet_usdc: number;
  wallet_eth: number;
  spendable_usd: number;
  exposure: number;
  reserve: number;
  execute: boolean;
  simulated_balance: boolean;
  address?: string;
};

export type SolvencyCheck = {
  blocked: boolean;
  outcome: "insolvent_declined" | "solvent";
  reason: string;
  cash_after: number;
  exposure_after: number;
  deployable: number;
};

/**
 * Effective cash the agent can still deploy.
 * Execute on: wallet already net of past on-chain payouts.
 * Simulated: wallet is stale, so subtract outstanding exposure.
 */
export function effectiveCash(snap: SolvencySnapshot) {
  if (snap.execute && !snap.simulated_balance) {
    return snap.spendable_usd;
  }
  return snap.spendable_usd - snap.exposure;
}

export function solvencyCheck(payout: number, snap: SolvencySnapshot): SolvencyCheck {
  const reserve = snap.reserve;
  const cash = effectiveCash(snap);
  const cashAfter = round2(cash - payout);
  const exposureAfter = round2(snap.exposure + payout);
  const deployable = round2(Math.max(0, cash - reserve));
  const blocked = payout > 0 && cashAfter + 1e-9 < reserve;
  return {
    blocked,
    outcome: blocked ? "insolvent_declined" : "solvent",
    reason: blocked
      ? `Agent solvency: fronting ${payout} would leave effective cash ${cashAfter} below MIN_AGENT_RESERVE (${reserve}). Wallet ~${round2(snap.spendable_usd)} USD, outstanding exposure ${snap.exposure} across all users. User reputation was not used.`
      : `Solvent: effective cash after payout ${cashAfter} >= reserve ${reserve}. Exposure would be ${exposureAfter}.`,
    cash_after: cashAfter,
    exposure_after: exposureAfter,
    deployable,
  };
}

export function agentOutstandingExposure(
  relationships: { purchases?: { outcome: string; amount: number; schedule?: { status: string; amount: number }[] }[] }[],
) {
  let sum = 0;
  for (const rel of relationships) {
    for (const p of rel.purchases || []) {
      if (p.outcome !== "active") continue;
      const pending = (p.schedule || []).filter((i) => i.status === "pending");
      if (pending.length) sum += pending.reduce((s, i) => s + (i.amount || 0), 0);
      else sum += p.amount || 0;
    }
  }
  return round2(sum);
}

export type AgentBook = {
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

export async function loadSolvencySnapshot(exposure: number): Promise<SolvencySnapshot> {
  const { getAgentBalance } = await import("@/lib/wallet");
  const reserve = minAgentReserve();
  const execute = ["1", "true", "yes"].includes((process.env.BASE_EXECUTE || "").toLowerCase());
  const simulatedFallback = Number(process.env.AGENT_SIMULATED_USDC ?? 100);
  const fallbackUsd = Number.isFinite(simulatedFallback) && simulatedFallback >= 0 ? simulatedFallback : 100;
  try {
    const bal = await getAgentBalance();
    const usdc = Number(bal.usdc) || 0;
    const eth = Number(bal.eth) || 0;
    const spendable_usd = usdc + eth * ethUsd();
    return {
      wallet_usdc: usdc,
      wallet_eth: eth,
      spendable_usd,
      exposure,
      reserve,
      execute,
      simulated_balance: false,
      address: bal.address,
    };
  } catch {
    let address: string | undefined;
    try {
      const { getAgentAddress } = await import("@/lib/wallet");
      address = getAgentAddress();
    } catch {
      address = undefined;
    }
    return {
      wallet_usdc: fallbackUsd,
      wallet_eth: 0,
      spendable_usd: fallbackUsd,
      exposure,
      reserve,
      execute: false,
      simulated_balance: true,
      address,
    };
  }
}

export function bookFromSnapshot(snap: SolvencySnapshot, activePlans: number): AgentBook {
  const cash = effectiveCash(snap);
  return {
    outstanding_exposure: snap.exposure,
    active_plans: activePlans,
    reserve: snap.reserve,
    spendable_usd: snap.spendable_usd,
    wallet_usdc: snap.wallet_usdc,
    deployable: Math.max(0, cash - snap.reserve),
    execute: snap.execute,
    simulated_balance: snap.simulated_balance,
    address: snap.address,
  };
}
