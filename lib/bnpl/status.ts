import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { readAgentWalletFile } from "@/lib/agent-wallet-file";
import { agentOutstandingExposure, bookFromSnapshot, ethUsd, loadSolvencySnapshot } from "@/lib/bnpl/solvency";
import { listRelationships } from "@/lib/bnpl/store";
import { sibylHealth } from "@/lib/memory/store";

export type AgentStatus = {
  network: string;
  chainId: number;
  address: string | null;
  spendable_usd: number;
  wallet_usdc: number;
  outstanding_exposure: number;
  deployable: number;
  reserve: number;
  execute: boolean;
  simulated_balance: boolean;
  total_purchases: number;
  wallets_with_history: number;
  sibyl_load_bearing: boolean;
  eth_usd: number;
  as_of: string;
  block?: string;
};

export function payoutIsLive() {
  const v = (process.env.BASE_EXECUTE || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function grokConfigured() {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export async function getAgentStatus(): Promise<AgentStatus> {
  const file = readAgentWalletFile();
  const relationships = await listRelationships();
  const exposure = agentOutstandingExposure(relationships);
  const snap = await loadSolvencySnapshot(exposure);
  const activePlans = relationships.reduce((n, r) => n + (r.active_count || 0), 0);
  const book = bookFromSnapshot(snap, activePlans);
  const health = await sibylHealth();
  const sibyl_load_bearing = Boolean(health.loadBearing);
  let block: string | undefined;
  try {
    const rpc = process.env.BASE_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
    block = (await client.getBlockNumber()).toString();
  } catch {
    block = undefined;
  }
  return {
    network: "Base Sepolia",
    chainId: Number(process.env.BASE_CHAIN_ID || 84532),
    address: book.address || file?.address || null,
    spendable_usd: book.spendable_usd,
    wallet_usdc: book.wallet_usdc,
    outstanding_exposure: book.outstanding_exposure,
    deployable: book.deployable,
    reserve: book.reserve,
    execute: book.execute,
    simulated_balance: book.simulated_balance,
    total_purchases: relationships.reduce((n, r) => n + (r.total_purchases || 0), 0),
    wallets_with_history: relationships.filter((r) => r.total_purchases > 0).length,
    sibyl_load_bearing,
    eth_usd: ethUsd(),
    as_of: new Date().toISOString(),
    block,
  };
}
