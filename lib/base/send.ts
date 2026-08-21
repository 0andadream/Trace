import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
} from "viem";

import { base, baseSepolia } from "viem/chains";
import { ceilingCheck } from "@/lib/policy/ceiling";
import { getAgentAccount } from "@/lib/wallet";
import type { TreasuryRequest } from "@/types";

const ERC20_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const KNOWN: Record<number, Record<string, { address: Address; decimals: number } | "native">> = {
  8453: {
    ETH: "native",
    WETH: "native",
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  },
  84532: {
    ETH: "native",
    WETH: "native",
    USDC: { address: "0x036CbD53889e08Fb86631BAcC1413aE6097C6Cf6", decimals: 6 },
  },
};

export type Execution = {
  chainId: number;
  chainLabel: string;
  sent: boolean;
  from?: Address;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  reason?: string;
};

function chainConfig() {
  const id = Number(process.env.BASE_CHAIN_ID || 84532);
  const chain = id === 8453 ? base : baseSepolia;
  const rpc =
    process.env.BASE_RPC_URL ||
    (id === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org");
  const explorer =
    id === 8453 ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";
  return { id: chain.id, chain, rpc, explorer, label: chain.name };
}

function privateKeyPresent() {
  return Boolean(process.env.AGENT_PRIVATE_KEY?.trim() || process.env.BASE_PRIVATE_KEY?.trim());
}

function executeEnabled() {
  const v = (process.env.BASE_EXECUTE || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function resolveToken(
  client: ReturnType<typeof createPublicClient>,
  chainId: number,
  token: string,
): Promise<{ kind: "native" } | { kind: "erc20"; address: Address; decimals: number }> {
  const symbol = token.trim().toUpperCase();
  if (!symbol || symbol === "ETH" || symbol === "NATIVE") return { kind: "native" };
  const known = KNOWN[chainId]?.[symbol];
  if (known === "native") return { kind: "native" };
  if (known) return { kind: "erc20", address: known.address, decimals: known.decimals };
  if (isAddress(token, { strict: false })) {
    const address = token as Address;
    const decimals = Number(await client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }));
    return { kind: "erc20", address, decimals };
  }
  throw new Error(`Unknown token "${token}". Use ETH, USDC, or an ERC-20 address.`);
}

export function skipped(reason: string): Execution {
  const { id, label } = chainConfig();
  return { chainId: id, chainLabel: label, sent: false, reason };
}

export async function sendTransfer(request: TreasuryRequest): Promise<Execution> {
  const cfg = chainConfig();
  if (request.action !== "transfer") {
    return skipped(`Only transfer is broadcast. Got ${request.action}.`);
  }
  if (!executeEnabled()) {
    return skipped("BASE_EXECUTE is not set. Decision is in Sibyl only. Set BASE_EXECUTE=1 to broadcast.");
  }
  const ceil = ceilingCheck(request);
  if (ceil.blocked) {
    return skipped(ceil.reason);
  }
  if (!privateKeyPresent()) {
    return skipped("AGENT_PRIVATE_KEY is missing. Run pnpm wallet:create. The agent signs with an env key — there is no wallet connect.");
  }
  if (!isAddress(request.recipient, { strict: false })) {
    return skipped("Recipient is not a valid address.");
  }
  if (!(request.amount > 0)) {
    return skipped("Amount must be greater than 0.");
  }

  try {
    const account = getAgentAccount();
    const publicClient = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });
    const wallet = createWalletClient({
      account,
      chain: cfg.chain,
      transport: http(cfg.rpc, { timeout: 30_000 }),
    });
    const token = await resolveToken(publicClient, cfg.id, request.token);
    const to = request.recipient as Address;

    const hash =
      token.kind === "native"
        ? await wallet.sendTransaction({
            account,
            chain: cfg.chain,
            to,
            value: parseEther(String(request.amount)),
          })
        : await wallet.writeContract({
            account,
            chain: cfg.chain,
            address: token.address,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [to, parseUnits(String(request.amount), token.decimals)],
          });

    return {
      chainId: cfg.id,
      chainLabel: cfg.label,
      sent: true,
      from: account.address,
      txHash: hash,
      explorerUrl: `${cfg.explorer}${hash}`,
    };
  } catch (err) {
    return skipped(err instanceof Error ? err.message : "broadcast failed");
  }
}
