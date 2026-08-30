/**
 * Virtuals Protocol ACP v2 — on-chain job execution for TRACE.
 *
 * Contract addresses and ABI match @virtuals-protocol/acp-node-v2
 * (src/core/constants.ts, src/core/acpAbi.ts). TRACE talks to the
 * AgenticCommerceV3 contract with viem. The LLM and this module do
 * not choose credit amounts.
 *
 * ACP job: "BNPL Settlement". Caller (Alex) is client + provider +
 * evaluator (self-evaluation). Budget is 0 — user funds never move
 * through ACP escrow. Base ETH settlement stays on the existing
 * sendMerchantPayout path after the user confirms.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  toEventHash,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { getAgentAccount, getAgentAddress } from "@/lib/wallet";
import { publicJobMetadata, type PublicJobMetadata } from "@/lib/virtuals/metadata";

export const ACP_CONTRACT: Record<number, Address> = {
  84532: "0x0b93793923CD5De81850aF8604a233f3f24d461e",
  8453: "0x238E541BfefD82238730D00a2208E5497F1832E0",
};

export const ACP_OFFERING = "BNPL Settlement";

/** Official ACP v2 JobStatus (AgenticCommerceV3). */
export const ACP_JOB_STATUS = {
  OPEN: 0,
  BUDGET_SET: 1,
  FUNDED: 2,
  SUBMITTED: 3,
  COMPLETED: 4,
  REJECTED: 5,
  EXPIRED: 6,
} as const;

export const ACP_ABI = [
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setBudget",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "expectedBudget", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "complete",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "client", type: "address" },
          { name: "status", type: "uint8" },
          { name: "provider", type: "address" },
          { name: "expiredAt", type: "uint48" },
          { name: "evaluator", type: "address" },
          { name: "hook", type: "address" },
          { name: "budget", type: "uint256" },
          { name: "description", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "JobCreated",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "evaluator", type: "address", indexed: false },
      { name: "expiredAt", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false },
    ],
  },
] as const;

export type AcpJobStatusName = "created" | "executed" | "skipped" | "failed";

export type AcpJobResult = {
  offering: typeof ACP_OFFERING;
  status: AcpJobStatusName;
  jobId?: string;
  onchainStatus?: number;
  createTxHash?: Hex;
  executeTxHash?: Hex;
  explorerUrl?: string;
  contract: Address;
  chainId: number;
  reason?: string;
  metadata: PublicJobMetadata;
};

export type BnplSettlementInput = {
  wallet: string;
  loanAmount: number;
  creditDecision: number;
  memoryVerified: boolean;
  repaymentStatus: "ON_TIME" | "LATE" | "NONE" | "DEFAULTED";
  decisionReason: string;
  purchaseId?: string;
};

function chainConfig() {
  const id = Number(process.env.BASE_CHAIN_ID || 84532);
  const chain = id === 8453 ? base : baseSepolia;
  const rpc =
    process.env.BASE_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    (id === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org");
  const explorer = id === 8453 ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";
  const contract = ACP_CONTRACT[chain.id];
  return { id: chain.id, chain, rpc, explorer, contract };
}

export function acpExplorerJob(contract: Address, chainId: number) {
  const host = chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
  return `${host}/address/${contract}#readProxyContract`;
}

function executeEnabled() {
  const acp = (process.env.VIRTUALS_ACP || "").toLowerCase();
  if (acp === "0" || acp === "false" || acp === "off") return false;
  const v = (process.env.BASE_EXECUTE || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function skippedResult(reason: string, metadata: PublicJobMetadata): AcpJobResult {
  const cfg = chainConfig();
  return {
    offering: ACP_OFFERING,
    status: "skipped",
    contract: cfg.contract,
    chainId: cfg.id,
    reason,
    metadata,
  };
}

function jobDescription(meta: PublicJobMetadata) {
  return JSON.stringify({
    product: meta.product,
    agent: meta.agent,
    purpose: meta.purpose,
    user: meta.user,
    amount: meta.amount,
    memoryVerified: meta.memoryVerified,
    memoryProvider: meta.memoryProvider,
    creditLimit: meta.creditLimit,
    decisionReason: meta.decisionReason,
  });
}

export async function readAcpJobCounter(): Promise<{
  reachable: boolean;
  jobCounter?: string;
  contract: Address;
  chainId: number;
  reason?: string;
}> {
  const cfg = chainConfig();
  if (!cfg.contract) {
    return { reachable: false, contract: zeroAddress, chainId: cfg.id, reason: "No ACP contract for this chain." };
  }
  try {
    const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc, { timeout: 8_000 }) });
    const n = await client.readContract({
      address: cfg.contract,
      abi: ACP_ABI,
      functionName: "jobCounter",
    });
    return { reachable: true, jobCounter: n.toString(), contract: cfg.contract, chainId: cfg.id };
  } catch (err) {
    return {
      reachable: false,
      contract: cfg.contract,
      chainId: cfg.id,
      reason: err instanceof Error ? err.message : "ACP contract unreachable",
    };
  }
}

export async function readAcpJob(jobId: string) {
  const cfg = chainConfig();
  const id = BigInt(jobId);
  const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc, { timeout: 8_000 }) });
  const job = await client.readContract({
    address: cfg.contract,
    abi: ACP_ABI,
    functionName: "getJob",
    args: [id],
  });
  return {
    jobId,
    client: job.client,
    status: Number(job.status),
    provider: job.provider,
    evaluator: job.evaluator,
    expiredAt: Number(job.expiredAt),
    hook: job.hook,
    budget: job.budget.toString(),
    description: job.description,
    contract: cfg.contract,
    chainId: cfg.id,
  };
}

const JOB_CREATED_TOPIC = toEventHash(
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 expiredAt, address hook)",
);

async function waitReceipt(client: { waitForTransactionReceipt: (args: { hash: Hex; timeout: number }) => Promise<{ status: string; logs: readonly { topics: readonly Hex[] }[] }> }, hash: Hex) {
  return client.waitForTransactionReceipt({ hash, timeout: 45_000 });
}

function parseCreatedJobId(logs: readonly { topics: readonly Hex[] }[]): bigint | null {
  for (const log of logs) {
    if (log.topics[0] === JOB_CREATED_TOPIC && log.topics[1]) return BigInt(log.topics[1]);
  }
  return null;
}

/**
 * Create (and, if the protocol allows a 0-budget self-eval, execute)
 * an ACP job for a TRACE BNPL settlement. Never invents a job id.
 */
export async function executeBnplSettlementJob(input: BnplSettlementInput): Promise<AcpJobResult> {
  const metadata = publicJobMetadata(input);
  const cfg = chainConfig();

  if (!executeEnabled()) {
    return skippedResult(
      "ACP broadcast is off. Set BASE_EXECUTE=1 (and do not set VIRTUALS_ACP=0) to create a real ACP job.",
      metadata,
    );
  }
  if (!process.env.AGENT_PRIVATE_KEY?.trim() && !process.env.BASE_PRIVATE_KEY?.trim()) {
    return skippedResult("AGENT_PRIVATE_KEY is missing. Alex cannot sign an ACP job without the agent key.", metadata);
  }
  if (!cfg.contract) {
    return skippedResult(`No Virtuals ACP contract on chain ${cfg.id}.`, metadata);
  }

  try {
    const account = getAgentAccount();
    const publicClient = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc, { timeout: 30_000 }) });
    const wallet = createWalletClient({
      account,
      chain: cfg.chain,
      transport: http(cfg.rpc, { timeout: 30_000 }),
    });
    const agent = account.address;
    const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
    const description = jobDescription(metadata);

    let predictedId: bigint | null = null;
    try {
      const sim = await publicClient.simulateContract({
        account,
        address: cfg.contract,
        abi: ACP_ABI,
        functionName: "createJob",
        args: [agent, agent, expiredAt, description, zeroAddress],
      });
      predictedId = sim.result;
    } catch {
      predictedId = null;
    }

    const createHash = await wallet.writeContract({
      account,
      chain: cfg.chain,
      address: cfg.contract,
      abi: ACP_ABI,
      functionName: "createJob",
      args: [agent, agent, expiredAt, description, zeroAddress],
    });
    const createdReceipt = await waitReceipt(publicClient, createHash);
    if (createdReceipt.status !== "success") {
      return {
        offering: ACP_OFFERING,
        status: "failed",
        createTxHash: createHash,
        explorerUrl: `${cfg.explorer}${createHash}`,
        contract: cfg.contract,
        chainId: cfg.id,
        reason: "createJob transaction reverted.",
        metadata,
      };
    }

    let jobId = parseCreatedJobId(createdReceipt.logs);
    if (jobId == null) jobId = predictedId;
    if (jobId == null) {
      return {
        offering: ACP_OFFERING,
        status: "created",
        createTxHash: createHash,
        explorerUrl: `${cfg.explorer}${createHash}`,
        contract: cfg.contract,
        chainId: cfg.id,
        reason: "createJob succeeded but the JobCreated job id could not be decoded.",
        metadata,
      };
    }

    const created: AcpJobResult = {
      offering: ACP_OFFERING,
      status: "created",
      jobId: jobId.toString(),
      createTxHash: createHash,
      explorerUrl: `${cfg.explorer}${createHash}`,
      contract: cfg.contract,
      chainId: cfg.id,
      metadata,
    };

    const deliverable = keccak256(stringToHex(JSON.stringify(metadata)));
    const done = keccak256(stringToHex("BNPL_SETTLEMENT_OK"));
    let executeTx: Hex | undefined;
    const steps: Array<{ name: "setBudget" | "fund" | "submit" | "complete"; args: readonly unknown[] }> = [
      { name: "setBudget", args: [jobId, 0n, "0x"] },
      { name: "fund", args: [jobId, 0n, "0x"] },
      { name: "submit", args: [jobId, deliverable, "0x"] },
      { name: "complete", args: [jobId, done, "0x"] },
    ];

    for (const step of steps) {
      try {
        const hash = await wallet.writeContract({
          account,
          chain: cfg.chain,
          address: cfg.contract,
          abi: ACP_ABI,
          functionName: step.name,
          args: step.args as never,
        });
        const receipt = await waitReceipt(publicClient, hash);
        if (receipt.status !== "success") {
          created.reason = `${step.name} reverted. Job ${jobId} exists on-chain.`;
          return created;
        }
        executeTx = hash;
      } catch (err) {
        created.reason = `${step.name} failed: ${err instanceof Error ? err.message : "error"}. Job ${jobId} exists on-chain.`;
        return created;
      }
    }

    let onchainStatus: number | undefined;
    try {
      const job = await publicClient.readContract({
        address: cfg.contract,
        abi: ACP_ABI,
        functionName: "getJob",
        args: [jobId],
      });
      onchainStatus = Number(job.status);
    } catch {
      onchainStatus = undefined;
    }

    const executed = onchainStatus === ACP_JOB_STATUS.COMPLETED;
    return {
      ...created,
      status: executed ? "executed" : "created",
      onchainStatus,
      executeTxHash: executeTx,
      explorerUrl: executeTx ? `${cfg.explorer}${executeTx}` : created.explorerUrl,
      reason: executed ? undefined : created.reason || "Job created; on-chain status is not COMPLETED.",
    };
  } catch (err) {
    return {
      offering: ACP_OFFERING,
      status: "failed",
      contract: cfg.contract,
      chainId: cfg.id,
      reason: err instanceof Error ? err.message : "ACP createJob failed",
      metadata,
    };
  }
}

export function agentIsAlex(): Address {
  try {
    return getAgentAddress();
  } catch {
    return zeroAddress;
  }
}
