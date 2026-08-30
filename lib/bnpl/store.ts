import { callSibyl } from "@/lib/memory/sibyl";
import { CLEAN_BUYER, PENALIZED_BUYER, demoBooks } from "@/lib/bnpl/demo-wallets";
import {
  emptyRelationship,
  recomputeRelationship,
  stripComputedForStorage,
} from "@/lib/bnpl/relationship";
import type { UserRelationship } from "@/types/bnpl";

function withDemoBooks(rows: UserRelationship[]): UserRelationship[] {
  const have = new Set(rows.map((r) => r.wallet_address.toLowerCase()));
  const extra = demoBooks().filter((r) => !have.has(r.wallet_address.toLowerCase()));
  return extra.length ? [...rows, ...extra] : rows;
}

export async function listRelationships(): Promise<UserRelationship[]> {
  const result = await callSibyl<{ relationships: UserRelationship[] }>("list_relationships");
  const live = (result.relationships || []).map((row) => recomputeRelationship(normalize(row)));
  return withDemoBooks(live);
}

export async function getRelationship(wallet: string): Promise<UserRelationship> {
  const addr = wallet.trim().toLowerCase();
  const result = await callSibyl<{ relationship: UserRelationship | null }>("get_relationship", {
    wallet: addr,
  });
  if (!result.relationship) {
    if (addr === CLEAN_BUYER || addr === PENALIZED_BUYER) {
      return demoBooks().find((r) => r.wallet_address === addr) || emptyRelationship(addr);
    }
    return emptyRelationship(addr);
  }
  return recomputeRelationship(normalize(result.relationship));
}

export async function saveRelationship(rel: UserRelationship): Promise<UserRelationship> {
  const computed = recomputeRelationship(rel);
  const stored = stripComputedForStorage(computed);
  const result = await callSibyl<{ relationship: UserRelationship }>("upsert_relationship", {
    relationship: stored,
  });
  return recomputeRelationship(normalize(result.relationship || computed));
}

export async function deleteRelationship(wallet: string): Promise<{ deleted: boolean; wallet: string }> {
  const addr = wallet.trim().toLowerCase();
  const result = await callSibyl<{ deleted?: boolean; wallet?: string }>("delete_relationship", {
    wallet: addr,
  });
  return { deleted: Boolean(result.deleted), wallet: addr };
}

export async function replaceRelationships(relationships: UserRelationship[]): Promise<UserRelationship[]> {
  const rows = relationships.map((rel) => stripComputedForStorage(recomputeRelationship(rel)));
  const result = await callSibyl<{ relationships: UserRelationship[] }>("replace_relationships", {
    relationships: rows,
  });
  return (result.relationships || []).map((row) => recomputeRelationship(normalize(row)));
}

export async function bnplHealth() {
  const result = await callSibyl("health");
  if (!result.health) throw new Error("Sibyl Memory returned no health block.");
  return result.health;
}

function normalize(row: UserRelationship): UserRelationship {
  const base = emptyRelationship(row.wallet_address || "");
  return {
    ...base,
    ...row,
    purchases: row.purchases || [],
    quotes: row.quotes || [],
    override_outcomes: row.override_outcomes || [],
    snapshot: row.snapshot || base.snapshot,
  };
}
