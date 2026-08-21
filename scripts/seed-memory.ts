import { readFileSync } from "node:fs";
import path from "node:path";
import { buildCounterpartyProfile, buildReputation, listCounterparties } from "@/lib/memory/derive";
import type { ActionRecord } from "@/types";
import { loadEnvLocal } from "./env";
import { callSibylCli } from "./sibyl-cli";

async function main() {
  loadEnvLocal();

  const file = path.resolve(process.argv[2] || "seeds/demo-seed.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as { actions?: ActionRecord[] };
  const actions = raw.actions || [];

  const result = await callSibylCli<{ actions: ActionRecord[] }>("replace", { actions });
  const stored = result.actions || [];
  const reputation = buildReputation(stored);
  const counterparties = listCounterparties(stored);

  console.log(`Seeded from ${file}`);
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

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
