import { readFileSync } from "node:fs";
import path from "node:path";
import { CLEAN_BUYER, PENALIZED_BUYER } from "@/lib/bnpl/demo-wallets";
import { emptyOnchainSignal } from "@/lib/bnpl/onchain";
import { computeApproval } from "@/lib/bnpl/policy";
import { recomputeRelationship, standingFromHistory } from "@/lib/bnpl/relationship";
import { buildCounterpartyProfile, buildReputation, listCounterparties } from "@/lib/memory/derive";
import type { ActionRecord } from "@/types";
import type { UserRelationship } from "@/types/bnpl";
import { loadEnvLocal } from "./env";
import { callSibylCli } from "./sibyl-cli";

async function seedBnpl(file: string, relationships: UserRelationship[]) {
  const result = await callSibylCli<{ relationships: UserRelationship[] }>("replace_relationships", {
    relationships,
  });
  const stored = (result.relationships || []).map((row) => recomputeRelationship(row));
  console.log(`Seeded BNPL from ${file}`);
  console.log(`Sibyl tenant:        ${result.health?.tenant}`);
  console.log(`Sibyl db:            ${result.health?.db}`);
  console.log(`Relationships:       ${stored.length}`);
  for (const rel of stored) {
    const standing = standingFromHistory(rel);
    const quote = computeApproval({
      amount: 12,
      relationship: rel,
      onchain: emptyOnchainSignal(rel.wallet_address, { wallet_age_days: 2000, tx_count: 50_000 }),
    });
    const tag =
      rel.wallet_address === CLEAN_BUYER
        ? "clean repeat"
        : rel.wallet_address === PENALIZED_BUYER
          ? "default in book"
          : "seeded";
    console.log(
      `  ${tag} ${rel.wallet_address.slice(0, 10)}…  purchases=${rel.total_purchases} on_time=${rel.on_time_count} late=${rel.late_count} default=${rel.default_count} standing=${standing.toFixed(2)} quote=${quote.decision} limit=${quote.available} n=${quote.installments} used_onchain=${quote.used_onchain}`,
    );
  }
  console.log("Brand-new wallet:    any address not listed above → ONCHAIN_SIGNAL only, short plan");
}

async function seedTreasury(file: string, actions: ActionRecord[]) {
  const result = await callSibylCli<{ actions: ActionRecord[] }>("replace", { actions });
  const stored = result.actions || [];
  const reputation = buildReputation(stored);
  const counterparties = listCounterparties(stored);

  console.log(`Seeded treasury from ${file}`);
  console.log(`Sibyl tenant:     ${result.health?.tenant}`);
  console.log(`Sibyl db:         ${result.health?.db}`);
  console.log(`Actions written:  ${stored.length}`);
  console.log(`Counterparties:   ${counterparties.length}`);
  console.log(`Successful:       ${reputation.successfulActions}`);
  console.log(`Rejected:         ${reputation.rejectedActions}`);
  console.log(
    `Overrides:        ${reputation.userOverrides} (${((reputation.userOverrides / Math.max(reputation.totalActions, 1)) * 100).toFixed(1)}% of actions)`,
  );
  for (const cp of counterparties) {
    const sample = buildCounterpartyProfile(stored, cp.address);
    console.log(
      `  ${cp.label} ${cp.address.slice(0, 10)}…  n=${cp.interactionCount} ok=${sample?.successful} rej=${sample?.rejected}`,
    );
  }
}

async function main() {
  loadEnvLocal();

  const file = path.resolve(process.argv[2] || "seeds/bnpl-demo-seed.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    kind?: string;
    relationships?: UserRelationship[];
    actions?: ActionRecord[];
  };

  if (raw.relationships) {
    await seedBnpl(file, raw.relationships);
    return;
  }
  await seedTreasury(file, raw.actions || []);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
