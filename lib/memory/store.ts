import { SEED_ACTIONS } from "@/lib/memory/seed";
import { callSibyl } from "@/lib/memory/sibyl";
import type { ActionRecord } from "@/types";

export async function listActions(): Promise<ActionRecord[]> {
  const result = await callSibyl<{ actions: ActionRecord[] }>("list", { seed: SEED_ACTIONS });
  return result.actions || [];
}

export async function appendAction(row: ActionRecord): Promise<ActionRecord> {
  const result = await callSibyl<{ row: ActionRecord }>("append", { row });
  return result.row;
}

export async function updateAction(id: string, patch: Partial<ActionRecord>): Promise<ActionRecord | null> {
  const result = await callSibyl<{ row: ActionRecord }>("update", { id, patch });
  return result.row ?? null;
}

export async function sibylHealth() {
  const result = await callSibyl("health");
  if (!result.health) throw new Error("Sibyl Memory returned no health block.");
  return result.health;
}
