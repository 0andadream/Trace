import { createPublicClient, formatEther, http, parseEther, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_EXPLORER_TX } from "@/lib/base/usdc";
import { usdToEthFixed } from "@/lib/bnpl/solvency";

type RequestFn = (args: { method: string; params?: unknown[] }) => Promise<unknown>;

export async function sendUserRepay(opts: {
  from: string;
  agent: string;
  amountUsd: number;
  ethUsd: number;
  request: RequestFn;
}): Promise<{ hash: Hex; explorerUrl: string }> {
  if (!(opts.amountUsd > 0)) throw new Error("Installment amount must be greater than 0.");
  if (!(opts.ethUsd > 0)) throw new Error("ETH price is missing.");
  const from = opts.from as Address;
  const agent = opts.agent as Address;
  const ethStr = usdToEthFixed(opts.amountUsd, opts.ethUsd);
  const wei = parseEther(ethStr);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const bal = await publicClient.getBalance({ address: from });
  if (bal < wei) {
    throw new Error(
      `Need ${ethStr} ETH (≈ $${opts.amountUsd.toFixed(2)} USDC) on Base Sepolia to repay. This wallet has ${formatEther(bal)} ETH.`,
    );
  }
  const hash = (await opts.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: agent,
        value: `0x${wei.toString(16)}`,
        chainId: "0x14a34",
      },
    ],
  })) as string;
  if (!hash || !hash.startsWith("0x")) throw new Error("Wallet did not return a transaction hash.");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("ETH transfer failed on-chain.");
  return { hash: hash as Hex, explorerUrl: `${BASE_SEPOLIA_EXPLORER_TX}${hash}` };
}

/** @deprecated use sendUserRepay */
export const sendUsdcRepay = sendUserRepay;
