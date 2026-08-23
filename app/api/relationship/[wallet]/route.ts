import { fetchOnchainSignal } from "@/lib/bnpl/onchain";
import { isRelationshipEmpty } from "@/lib/bnpl/relationship";
import { bnplHealth, getRelationship } from "@/lib/bnpl/store";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ wallet: string }> }) {
  try {
    const { wallet } = await ctx.params;
    const addr = decodeURIComponent(wallet || "").trim();
    const relationship = await getRelationship(addr);
    const empty = isRelationshipEmpty(relationship);
    const onchain = empty ? await fetchOnchainSignal(addr) : null;
    return NextResponse.json({
      relationship,
      relationship_empty: empty,
      standing: relationship.current_standing_score,
      current_limit: relationship.current_limit,
      onchain,
      onchain_note: empty
        ? "ONCHAIN_SIGNAL fetched fresh. Not stored in Sibyl. Used only because total_purchases == 0."
        : "ONCHAIN_SIGNAL omitted. USER_RELATIONSHIP.total_purchases > 0, so on-chain is not a terms input.",
      sibyl: await bnplHealth(),
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "relationship failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
