import { createPublicClient, formatEther, formatUnits, http, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const ERC20_BALANCE = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const USDC: Record<number, { address: Address; decimals: number }> = {
  84532: { address: "0x036CbD53889e08Fb86631BAcC1413aE6097C6Cf6", decimals: 6 },
  11155111: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
  8453: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
};

function agentKey(): Hex {
  const raw = (process.env.AGENT_PRIVATE_KEY || process.env.BASE_PRIVATE_KEY || "").trim();
  if (!raw) {
    throw new Error(
      "AGENT_PRIVATE_KEY is missing. Run `pnpm wallet:create` (or npm run wallet:create) to generate one. The key is stored in .env.local and is never committed.",
    );
  }
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
}

export function getAgentAccount(): PrivateKeyAccount {
  return privateKeyToAccount(agentKey());
}

export async function getAgentBalance() {
  const account = getAgentAccount();
  const rpc = process.env.SEPOLIA_RPC_URL || process.env.BASE_RPC_URL || "https://sepolia.base.org";
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
  const chainId = await client.getChainId();
  const ethWei = await client.getBalance({ address: account.address });
  const usdc = USDC[chainId];
  let usdcFormatted = "0";
  if (usdc) {
    const raw = await client.readContract({
      address: usdc.address,
      abi: ERC20_BALANCE,
      functionName: "balanceOf",
      args: [account.address],
    });
    usdcFormatted = formatUnits(raw, usdc.decimals);
  }
  return {
    address: account.address,
    chainId,
    eth: formatEther(ethWei),
    usdc: usdcFormatted,
  };
}
