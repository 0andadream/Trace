import { createPublicClient, getAddress, http, parseEther, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { getAgentAccount } from "@/lib/wallet";
import { readAgentWalletFile } from "@/lib/agent-wallet-file";
import { BASE_SEPOLIA_EXPLORER_TX } from "@/lib/base/usdc";
import { ethUsd, usdToEthFixed } from "@/lib/bnpl/solvency";

function agentAddress(): string {
  try {
    return getAgentAccount().address;
  } catch {
    const file = readAgentWalletFile();
    if (file?.address) return file.address;
    throw new Error("Alex’s account is not configured.");
  }
}

export async function verifyUserRepay(input: {
  txHash: string;
  from: string;
  amount: number;
}): Promise<{ explorerUrl: string }> {
  if (!input.txHash?.startsWith("0x") || input.txHash.length < 66) {
    throw new Error("A Base Sepolia ETH transfer hash is required to repay.");
  }
  const rpc = process.env.BASE_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
  const receipt = await client.waitForTransactionReceipt({
    hash: input.txHash as Hex,
    timeout: 90_000,
  });
  if (receipt.status !== "success") throw new Error("Repay transaction did not succeed.");

  const tx = await client.getTransaction({ hash: input.txHash as Hex });
  const expectedTo = getAddress(agentAddress());
  const expectedFrom = getAddress(input.from);
  if (getAddress(tx.from) !== expectedFrom) {
    throw new Error("Repay transaction was not sent from your wallet.");
  }
  if (!tx.to || getAddress(tx.to) !== expectedTo) {
    throw new Error("Repay transaction was not sent to Alex.");
  }
  const expected = parseEther(usdToEthFixed(input.amount, ethUsd()));
  const delta = tx.value > expected ? tx.value - expected : expected - tx.value;
  const tol = expected / 1000n + 1_000_000_000_000n;
  if (delta > tol) {
    throw new Error(
      `Transaction is not a $${input.amount.toFixed(2)} USDC-equivalent ETH transfer to Alex.`,
    );
  }
  return { explorerUrl: `${BASE_SEPOLIA_EXPLORER_TX}${input.txHash}` };
}

/** @deprecated use verifyUserRepay */
export const verifyUsdcRepay = verifyUserRepay;
