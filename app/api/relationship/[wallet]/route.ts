import { fetchOnchainSignal } from "@/lib/lending/onchain";
import { isRelationshipEmpty } from "@/lib/lending/relationship";
import { getRelationship, lendingHealth } from "@/lib/lending/store";
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
      onchain,
      onchain_note: empty
        ? "ONCHAIN_SIGNAL fetched fresh. Not stored in Sibyl. Used only because total_loans == 0."
        : "ONCHAIN_SIGNAL omitted. USER_RELATIONSHIP.total_loans > 0, so on-chain is not a rate input.",
      sibyl: await lendingHealth(),
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "relationship failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
