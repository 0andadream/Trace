import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import agentWallet from "@/config/agent-wallet.json";

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
  84532: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
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

/** Public address for reads. Does not need the private key. */
export function getAgentAddress(): Address {
  try {
    return getAgentAccount().address;
  } catch {
    const envAddr = process.env.AGENT_ADDRESS?.trim();
    const published = typeof agentWallet.address === "string" ? agentWallet.address.trim() : "";
    const raw = envAddr || published;
    if (raw && isAddress(raw, { strict: false })) return raw as Address;
    throw new Error(
      "Agent address is missing. Set AGENT_PRIVATE_KEY, AGENT_ADDRESS, or config/agent-wallet.json.",
    );
  }
}

export async function getAgentBalance() {
  const address = getAgentAddress();
  const rpc = process.env.SEPOLIA_RPC_URL || process.env.BASE_RPC_URL || "https://sepolia.base.org";
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
  const chainId = await client.getChainId();
  const ethWei = await client.getBalance({ address });
  const usdc = USDC[chainId] || USDC[84532];
  let usdcFormatted = "0";
  if (usdc) {
    const raw = await client.readContract({
      address: usdc.address,
      abi: ERC20_BALANCE,
      functionName: "balanceOf",
      args: [address],
    });
    usdcFormatted = formatUnits(raw, usdc.decimals);
  }
  return {
    address,
    chainId,
    eth: formatEther(ethWei),
    usdc: usdcFormatted,
  };
}
