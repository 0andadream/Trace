import { loadEnvLocal } from "./env";
loadEnvLocal();

import { handleAcpCreditJob } from "@/lib/virtuals/incoming";

async function main() {
  const wallet = (process.env.ACP_TEST_WALLET || process.argv[2] || "").trim();
  const amount = Number(process.env.ACP_TEST_AMOUNT || process.argv[3] || 12);
  const accept = process.argv.includes("--accept") || process.env.ACP_TEST_ACCEPT === "1";
  if (!wallet) {
    console.error("usage: npx tsx scripts/acp-request-credit.ts <wallet> [amount] [--accept]");
    process.exit(1);
  }
  const result = await handleAcpCreditJob({
    requirement: {
      wallet,
      loanAmount: amount,
      jobId: `local-${Date.now().toString(36)}`,
    },
    accept,
  });
  console.log(
    JSON.stringify(
      {
        channel: result.channel,
        wallet: result.requirement.wallet,
        amount: result.requirement.amount,
        decision: result.quote.terms.decision,
        limit: result.quote.terms.limit,
        available: result.quote.terms.available,
        primary: result.quote.terms.primary_signal,
        accepted: result.accepted,
        purchase_id: result.purchase?.purchase.purchase_id || null,
        payout_mode: result.purchase?.payout_mode || null,
        payout_tx: result.purchase?.tx.txHash || null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
