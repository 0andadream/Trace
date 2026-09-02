/**
 * Admin-only. Sends Base Sepolia ETH from the agent wallet to the demo buyer.
 *
 *   pnpm demo:fund
 *   pnpm demo:fund 0.15
 */
import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import { getDemoWalletAddress } from "@/lib/bnpl/demoWallet";
import { getAgentAccount } from "@/lib/wallet";
import { loadEnvLocal } from "./env";

async function main() {
  loadEnvLocal();
  const amount = process.argv[2] || "0.15";
  const wei = parseEther(amount);
  if (wei <= 0n) throw new Error("Amount must be greater than 0.");

  const account = getAgentAccount();
  const demo = getDemoWalletAddress();
  if (account.address.toLowerCase() === demo.toLowerCase()) {
    throw new Error("Demo wallet and agent wallet are the same address.");
  }

  const rpc = process.env.BASE_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
  const fromBal = await publicClient.getBalance({ address: account.address });
  if (fromBal <= wei) {
    throw new Error(`Agent has ${formatEther(fromBal)} ETH; need more than ${amount} ETH to fund.`);
  }

  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpc, { timeout: 30_000 }),
  });
  const hash = await wallet.sendTransaction({
    account,
    chain: baseSepolia,
    to: demo,
    value: wei,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`Funding tx failed: ${hash}`);
  const demoBal = await publicClient.getBalance({ address: demo, blockNumber: receipt.blockNumber });
  console.log("Funded demo buyer wallet on Base Sepolia.");
  console.log(`From (agent): ${account.address}`);
  console.log(`To (demo):    ${demo}`);
  console.log(`Amount:       ${amount} ETH`);
  console.log(`Tx:           https://sepolia.basescan.org/tx/${hash}`);
  console.log(`Demo balance: ${formatEther(demoBal)} ETH`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
