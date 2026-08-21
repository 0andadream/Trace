import { keccak256, stringToHex } from "viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { ActionRecord, Decision } from "@/types";

export type BaseAttestation = {
  chainId: number;
  chainLabel: string;
  memoryHash: `0x${string}`;
  written: boolean;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  reason?: string;
};

export function memoryHash(input: {
  id: string;
  decision: Decision;
  riskScore: number;
  recipient: string;
}): `0x${string}` {
  return keccak256(stringToHex(`${input.id}:${input.decision}:${input.riskScore}:${input.recipient.toLowerCase()}`));
}

export async function attestOnBase(row: Pick<ActionRecord, "id" | "decision" | "riskScore" | "recipient">): Promise<BaseAttestation> {
  const hash = memoryHash(row);
  const base: BaseAttestation = {
    chainId: baseSepolia.id,
    chainLabel: "Base Sepolia",
    memoryHash: hash,
    written: false,
  };

  const raw = process.env.BASE_PRIVATE_KEY;
  if (!raw) {
    return { ...base, reason: "No BASE_PRIVATE_KEY. Hash is committed in Sibyl; onchain write skipped." };
  }

  try {
    const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
    const account = privateKeyToAccount(key);
    const rpc = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpc, { timeout: 20_000 }),
    });
    const txHash = await client.sendTransaction({
      account,
      chain: baseSepolia,
      to: account.address,
      value: 0n,
      data: hash,
    });
    return {
      ...base,
      written: true,
      txHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    };
  } catch (err) {
    return {
      ...base,
      reason: err instanceof Error ? err.message : "Base attestation failed",
    };
  }
}
