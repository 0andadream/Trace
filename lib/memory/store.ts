import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEED_ACTIONS } from "@/lib/memory/seed";
import { dataFile } from "@/lib/store/data-dir";
import type { ActionRecord } from "@/types";

const FILE = dataFile("actions.json");

async function readLive(): Promise<ActionRecord[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    return JSON.parse(raw) as ActionRecord[];
  } catch {
    return [];
  }
}

export async function listActions(): Promise<ActionRecord[]> {
  const live = await readLive();
  const byId = new Map<string, ActionRecord>();
  for (const row of SEED_ACTIONS) byId.set(row.id, row);
  for (const row of live) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function appendAction(row: ActionRecord): Promise<ActionRecord> {
  const live = await readLive();
  const next = [row, ...live.filter((r) => r.id !== row.id)].slice(0, 400);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(next, null, 2));
  return row;
}

export async function updateAction(id: string, patch: Partial<ActionRecord>): Promise<ActionRecord | null> {
  const all = await listActions();
  const current = all.find((r) => r.id === id);
  if (!current) return null;
  const updated = { ...current, ...patch, id: current.id };
  const live = await readLive();
  const next = [updated, ...live.filter((r) => r.id !== id)];
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(next, null, 2));
  return updated;
}
