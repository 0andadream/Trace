import { callSibyl } from "@/lib/memory/sibyl";
import {
  emptyRelationship,
  recomputeRelationship,
  stripStandingForStorage,
} from "@/lib/lending/relationship";
import type { UserRelationship } from "@/types/lending";

export async function listRelationships(): Promise<UserRelationship[]> {
  const result = await callSibyl<{ relationships: UserRelationship[] }>("list_relationships");
  return (result.relationships || []).map((row) => recomputeRelationship(row));
}

export async function getRelationship(wallet: string): Promise<UserRelationship> {
  const addr = wallet.trim().toLowerCase();
  const result = await callSibyl<{ relationship: UserRelationship | null }>("get_relationship", {
    wallet: addr,
  });
  if (!result.relationship) return emptyRelationship(addr);
  return recomputeRelationship(result.relationship);
}

export async function saveRelationship(rel: UserRelationship): Promise<UserRelationship> {
  const computed = recomputeRelationship(rel);
  const stored = stripStandingForStorage(computed);
  const result = await callSibyl<{ relationship: UserRelationship }>("upsert_relationship", {
    relationship: stored,
  });
  return recomputeRelationship(result.relationship || computed);
}

export async function replaceRelationships(relationships: UserRelationship[]): Promise<UserRelationship[]> {
  const rows = relationships.map((rel) => stripStandingForStorage(recomputeRelationship(rel)));
  const result = await callSibyl<{ relationships: UserRelationship[] }>("replace_relationships", {
    relationships: rows,
  });
  return (result.relationships || []).map((row) => recomputeRelationship(row));
}

export async function lendingHealth() {
  const result = await callSibyl("health");
  if (!result.health) throw new Error("Sibyl Memory returned no health block.");
  return result.health;
}
