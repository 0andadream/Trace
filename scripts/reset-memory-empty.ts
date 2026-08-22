import { buildReputation, listCounterparties } from "@/lib/memory/derive";
import type { ActionRecord } from "@/types";
import { loadEnvLocal } from "./env";
import { callSibylCli } from "./sibyl-cli";

async function main() {
  loadEnvLocal();

  const result = await callSibylCli<{ actions: ActionRecord[]; relationships: unknown[] }>("wipe");
  const stored = result.actions || [];
  const reputation = buildReputation(stored);
  const counterparties = listCounterparties(stored);
  const relationships = result.relationships || [];

  console.log("Memory wiped to empty.");
  console.log(`Sibyl tenant:     ${result.health?.tenant}`);
  console.log(`Sibyl db:         ${result.health?.db}`);
  console.log(`Actions:          ${stored.length} (want 0)`);
  console.log(`Counterparties:   ${counterparties.length} (want 0)`);
  console.log(`Relationships:    ${relationships.length} (want 0)`);
  console.log(`Reputation n:     ${reputation.totalActions}`);
  if (stored.length !== 0 || counterparties.length !== 0 || relationships.length !== 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
