import { fetchOnchainSignal } from "@/lib/bnpl/onchain";
import { isRelationshipEmpty } from "@/lib/bnpl/relationship";
import { bnplHealth, deleteRelationship, getRelationship } from "@/lib/bnpl/store";
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

export async function DELETE(req: Request, ctx: { params: Promise<{ wallet: string }> }) {
  try {
    const { wallet } = await ctx.params;
    const addr = decodeURIComponent(wallet || "").trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(addr)) {
      return NextResponse.json({ error: "wallet must be a 0x address." }, { status: 400 });
    }
    let confirm = false;
    try {
      const body = await req.json();
      confirm = Boolean(body?.confirm);
    } catch {
      confirm = false;
    }
    if (!confirm) {
      return NextResponse.json({ error: "Pass { confirm: true } to delete this wallet's Sibyl relationship." }, { status: 400 });
    }
    const before = await getRelationship(addr);
    const result = await deleteRelationship(addr);
    const after = await getRelationship(addr);
    return NextResponse.json({
      ...result,
      had_purchases: before.total_purchases,
      after_purchases: after.total_purchases,
      sibyl: await bnplHealth(),
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
