import { demoBooks } from "@/lib/bnpl/demo-wallets";
import { listRelationships } from "@/lib/bnpl/store";
import { collectAgentEvents } from "@/lib/trace/agentEvents";
import type { PurchaseRecord, QuoteRecord, UserRelationship } from "@/types/bnpl";

export type LogPayload = {
  total: number;
  active: number;
  purchases: Array<PurchaseRecord & { wallet_address: string }>;
  quotes: Array<QuoteRecord & { wallet_address: string }>;
  events: ReturnType<typeof collectAgentEvents>;
  sibyl: { loadBearing?: boolean; engine?: string } | null;
};

function flatten(relationships: UserRelationship[]) {
  const purchases = relationships.flatMap((rel) =>
    rel.purchases.map((p) => ({ ...p, wallet_address: rel.wallet_address })),
  );
  const quotes = relationships.flatMap((rel) =>
    (rel.quotes || []).map((q) => ({ ...q, wallet_address: rel.wallet_address })),
  );
  return { purchases, quotes, events: collectAgentEvents({ quotes, purchases }) };
}

function pack(relationships: UserRelationship[], sibyl: LogPayload["sibyl"]): LogPayload {
  const { purchases, quotes, events } = flatten(relationships);
  return {
    total: purchases.length,
    active: purchases.filter((p) => p.outcome === "active").length,
    purchases,
    quotes,
    events,
    sibyl,
  };
}

/** Always includes the two seeded judge books. Does not wait on chain RPC. */
export async function getLogPayload(): Promise<LogPayload> {
  try {
    const relationships = await listRelationships();
    return pack(relationships, { loadBearing: true });
  } catch {
    return pack(demoBooks(), { loadBearing: false, engine: "seeded-fallback" });
  }
}
