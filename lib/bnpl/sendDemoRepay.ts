import { createPublicClient, createWalletClient, formatEther, http, parseEther, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_EXPLORER_TX } from "@/lib/base/usdc";
import { getDemoWalletAccount } from "@/lib/bnpl/demoWallet";
import { usdToEthFixed } from "@/lib/bnpl/solvency";
import { getAgentAddress } from "@/lib/wallet";

export async function sendDemoWalletRepay(opts: {
  amountUsd: number;
  ethUsd: number;
}): Promise<{ hash: Hex; explorerUrl: string; from: string; to: string; eth: string }> {
  if (!(opts.amountUsd > 0)) throw new Error("Installment amount must be greater than 0.");
  if (!(opts.ethUsd > 0)) throw new Error("ETH price is missing.");
  const account = getDemoWalletAccount();
  const agent = getAgentAddress();
  const ethStr = usdToEthFixed(opts.amountUsd, opts.ethUsd);
  const wei = parseEther(ethStr);
  const rpc = process.env.BASE_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpc, { timeout: 30_000 }),
  });
  const bal = await publicClient.getBalance({ address: account.address });
  if (bal < wei) {
    throw new Error(
      `Demo wallet needs ${ethStr} ETH (≈ $${opts.amountUsd.toFixed(2)}) on Base Sepolia to repay. It has ${formatEther(bal)} ETH.`,
    );
  }
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpc, { timeout: 30_000 }),
  });
  const hash = await wallet.sendTransaction({
    account,
    chain: baseSepolia,
    to: agent,
    value: wei,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("Demo repayment failed on-chain.");
  return {
    hash,
    explorerUrl: `${BASE_SEPOLIA_EXPLORER_TX}${hash}`,
    from: account.address,
    to: agent,
    eth: ethStr,
  };
}
