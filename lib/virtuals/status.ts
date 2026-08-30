import { getAgentAddress } from "@/lib/wallet";
import { payoutIsLive, settlementPayoutLabel } from "@/lib/bnpl/execute";
import { bnplHealth, listRelationships } from "@/lib/bnpl/store";
import { ACP_CONTRACT, acpExplorerJob, readAcpJobCounter } from "@/lib/virtuals/acp";
import { fetchAlexRegistry } from "@/lib/virtuals/registry";
import { ALEX_ACP_PROFILE_URL } from "@/lib/virtuals/identity";
import type { AcpJobRecord } from "@/types/bnpl";

export type AgentInfrastructure = {
  sibyl: { connected: boolean; loadBearing: boolean; engine?: string; db?: string };
  virtuals: {
    /** Live GET of the Virtuals registry row. */
    profileRegistered: boolean;
    profileName?: string;
    profileWallet?: string | null;
    profileRole?: string | null;
    offerings: number;
    lastActiveAt: string | null;
    profileUrl: string;
    /** TRACE HTTP adapter POST /api/acp/jobs → computeApproval. */
    jobEndpoint: boolean;
    inboundHandled: number;
    /** Virtuals SSE/SDK seller listener. Requires Privy signer of the portal wallet. */
    marketplaceListener: boolean;
    /** Base Sepolia AgenticCommerce contract, not Alex's job count. */
    sepoliaContractReachable: boolean;
    sepoliaJobCounter?: string;
    contract: string;
    chainId: number;
    settlementAgent?: string;
    lastJob?: AcpJobRecord | null;
    reason?: string;
    verifyUrl: string;
    statusLabel: string;
  };
  base: {
    connected: boolean;
    execute: boolean;
    payoutLabel: string;
    network: string;
    chainId: number;
  };
};

function statusLabel(input: {
  profileRegistered: boolean;
  offerings: number;
  marketplaceListener: boolean;
  jobEndpoint: boolean;
}): string {
  if (input.profileRegistered && input.marketplaceListener) {
    return "Agent registered. Marketplace listener connected.";
  }
  if (input.profileRegistered && input.jobEndpoint) {
    return "Agent registered on Virtuals ACP. Marketplace listener is not connected. TRACE ACP job endpoint uses the existing decision engine.";
  }
  if (input.profileRegistered) {
    return "Agent registered on Virtuals ACP. ACP job handling is not connected.";
  }
  return "Virtuals registry not confirmed.";
}

export async function getAgentInfrastructure(): Promise<AgentInfrastructure> {
  const chainId = Number(process.env.BASE_CHAIN_ID || 84532);
  const contract = ACP_CONTRACT[chainId] || ACP_CONTRACT[84532];
  let settlementAgent: string | undefined;
  try {
    settlementAgent = getAgentAddress();
  } catch {
    settlementAgent = undefined;
  }

  let sibyl = { connected: false, loadBearing: false, engine: undefined as string | undefined, db: undefined as string | undefined };
  let lastJob: AcpJobRecord | null = null;
  let inboundHandled = 0;
  try {
    const health = await bnplHealth();
    sibyl = {
      connected: true,
      loadBearing: Boolean(health.loadBearing),
      engine: String(health.engine || ""),
      db: String(health.db || ""),
    };
    const rels = await listRelationships();
    const purchases = rels.flatMap((r) => r.purchases || []);
    inboundHandled = purchases.filter((p) => p.channel === "acp").length;
    const withJob = purchases
      .filter((p) => p.acp?.jobId)
      .sort((a, b) => String(b.approved_date).localeCompare(String(a.approved_date)));
    lastJob = withJob[0]?.acp || null;
  } catch {
    sibyl = { connected: false, loadBearing: false, engine: undefined, db: undefined };
  }

  const [acp, profile] = await Promise.all([readAcpJobCounter(), fetchAlexRegistry()]);
  const execute = payoutIsLive();
  const marketplaceListener = false;
  const jobEndpoint = true;
  const virtuals = {
    profileRegistered: profile.ok,
    profileName: profile.name,
    profileWallet: profile.walletAddress,
    profileRole: profile.role,
    offerings: profile.offerings,
    lastActiveAt: profile.lastActiveAt,
    profileUrl: profile.profileUrl || ALEX_ACP_PROFILE_URL,
    jobEndpoint,
    inboundHandled,
    marketplaceListener,
    sepoliaContractReachable: acp.reachable,
    sepoliaJobCounter: acp.jobCounter,
    contract,
    chainId: acp.chainId,
    settlementAgent,
    lastJob,
    reason: profile.ok ? acp.reason : profile.reason,
    verifyUrl: acpExplorerJob(contract, chainId),
    statusLabel: statusLabel({
      profileRegistered: profile.ok,
      offerings: profile.offerings,
      marketplaceListener,
      jobEndpoint,
    }),
  };

  return {
    sibyl,
    virtuals,
    base: {
      connected: true,
      execute,
      payoutLabel: settlementPayoutLabel(execute),
      network: chainId === 8453 ? "Base" : "Base Sepolia",
      chainId,
    },
  };
}
