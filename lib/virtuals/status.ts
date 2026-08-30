import { getAgentAddress } from "@/lib/wallet";
import { payoutIsLive } from "@/lib/bnpl/status";
import { bnplHealth, listRelationships } from "@/lib/bnpl/store";
import { ACP_CONTRACT, acpExplorerJob, readAcpJobCounter } from "@/lib/virtuals/acp";
import type { AcpJobRecord } from "@/types/bnpl";

export type AgentInfrastructure = {
  sibyl: { connected: boolean; loadBearing: boolean; engine?: string; db?: string };
  virtuals: {
    agentRegistered: boolean;
    acpEnabled: boolean;
    reachable: boolean;
    contract: string;
    chainId: number;
    jobCounter?: string;
    agent?: string;
    lastJob?: AcpJobRecord | null;
    reason?: string;
    verifyUrl: string;
  };
  base: {
    connected: boolean;
    execute: boolean;
    network: string;
    chainId: number;
  };
};

export async function getAgentInfrastructure(): Promise<AgentInfrastructure> {
  const chainId = Number(process.env.BASE_CHAIN_ID || 84532);
  const contract = ACP_CONTRACT[chainId] || ACP_CONTRACT[84532];
  let agent: string | undefined;
  try {
    agent = getAgentAddress();
  } catch {
    agent = undefined;
  }

  let sibyl = { connected: false, loadBearing: false, engine: undefined as string | undefined, db: undefined as string | undefined };
  let lastJob: AcpJobRecord | null = null;
  try {
    const health = await bnplHealth();
    sibyl = {
      connected: true,
      loadBearing: Boolean(health.loadBearing),
      engine: String(health.engine || ""),
      db: String(health.db || ""),
    };
    const rels = await listRelationships();
    const withJob = rels
      .flatMap((r) => r.purchases || [])
      .filter((p) => p.acp?.jobId)
      .sort((a, b) => String(b.approved_date).localeCompare(String(a.approved_date)));
    lastJob = withJob[0]?.acp || null;
  } catch {
    sibyl = { connected: false, loadBearing: false, engine: undefined, db: undefined };
  }

  const acp = await readAcpJobCounter();
  const execute = payoutIsLive();

  return {
    sibyl,
    virtuals: {
      agentRegistered: Boolean(agent),
      acpEnabled: acp.reachable,
      reachable: acp.reachable,
      contract,
      chainId: acp.chainId,
      jobCounter: acp.jobCounter,
      agent,
      lastJob,
      reason: acp.reason,
      verifyUrl: acpExplorerJob(contract, chainId),
    },
    base: {
      connected: true,
      execute,
      network: chainId === 8453 ? "Base" : "Base Sepolia",
      chainId,
    },
  };
}
