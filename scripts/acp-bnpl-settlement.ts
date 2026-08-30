import { loadEnvLocal } from "./env";
loadEnvLocal();

import { getAgentAddress } from "@/lib/wallet";
import { executeBnplSettlementJob, readAcpJob, readAcpJobCounter } from "@/lib/virtuals/acp";

async function main() {
  const agent = getAgentAddress();
  const before = await readAcpJobCounter();
  console.log(
    JSON.stringify(
      {
        agent,
        contract: before.contract,
        chainId: before.chainId,
        reachable: before.reachable,
        jobCounterBefore: before.jobCounter,
        execute: process.env.BASE_EXECUTE,
        virtualsAcp: process.env.VIRTUALS_ACP || "(default)",
      },
      null,
      2,
    ),
  );

  const job = await executeBnplSettlementJob({
    wallet: agent,
    loanAmount: 12,
    creditDecision: 24,
    memoryVerified: false,
    repaymentStatus: "NONE",
    decisionReason: "ACP_EXECUTE_REQUEST",
    purchaseId: `acp-cli-${Date.now().toString(36)}`,
  });

  let onchain = null;
  if (job.jobId) {
    try {
      onchain = await readAcpJob(job.jobId);
    } catch (err) {
      onchain = { error: err instanceof Error ? err.message : "getJob failed" };
    }
  }

  console.log(
    JSON.stringify(
      {
        offering: job.offering,
        status: job.status,
        jobId: job.jobId || null,
        onchainStatus: job.onchainStatus ?? null,
        createTxHash: job.createTxHash || null,
        executeTxHash: job.executeTxHash || null,
        explorerUrl: job.explorerUrl || null,
        contract: job.contract,
        reason: job.reason || null,
        metadata: job.metadata,
        getJob: onchain,
      },
      null,
      2,
    ),
  );

  if (job.status === "skipped" || job.status === "failed") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
