/**
 * ONCHAIN_SIGNAL — fetched fresh on every quote. Never written to Sibyl.
 * Only consumed by RATE_POLICY when USER_RELATIONSHIP.total_loans === 0.
 */
import { createPublicClient, http, isAddress, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import type { OnchainSignal } from "@/types/lending";

function rpcUrl() {
  return process.env.BASE_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
}

export function emptyOnchainSignal(wallet: string, extra: Partial<OnchainSignal> = {}): OnchainSignal {
  return {
    wallet_address: wallet.trim().toLowerCase(),
    wallet_age_days: 0,
    tx_count: 0,
    known_protocol_interactions: [],
    fetched_at: new Date().toISOString(),
    cached: false,
    used_only_when: "USER_RELATIONSHIP.total_loans == 0",
    ...extra,
  };
}

async function firstTxAgeDays(address: string): Promise<number | null> {
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=84532&module=account&action=txlist&address=${address}&page=1&offset=1&sort=asc`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { timeStamp?: string }[] };
    const ts = Number(data?.result?.[0]?.timeStamp);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    return Math.max(0, Math.floor((Date.now() / 1000 - ts) / 86400));
  } catch {
    return null;
  }
}

export async function fetchOnchainSignal(wallet: string): Promise<OnchainSignal> {
  const addr = wallet.trim().toLowerCase();
  const base = emptyOnchainSignal(addr);

  if (!isAddress(addr)) {
    return { ...base, fetch_error: true };
  }

  try {
    const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl()) });
    const tx_count = await client.getTransactionCount({ address: addr as Address });
    const age = await firstTxAgeDays(addr);
    return {
      ...base,
      tx_count: Number(tx_count) || 0,
      wallet_age_days: age ?? 0,
      fetched_at: new Date().toISOString(),
      cached: false,
    };
  } catch {
    return { ...base, fetch_error: true };
  }
}
