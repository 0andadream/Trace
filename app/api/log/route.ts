import { bnplSnapshot } from "@/lib/bnpl/run";
import { memorySnapshot } from "@/lib/desk/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const bnpl = await bnplSnapshot();
    const purchases = bnpl.relationships.flatMap((rel) =>
      rel.purchases.map((p) => ({ ...p, wallet_address: rel.wallet_address })),
    );
    const quotes = bnpl.relationships.flatMap((rel) =>
      (rel.quotes || []).map((q) => ({ ...q, wallet_address: rel.wallet_address })),
    );
    let actions: Awaited<ReturnType<typeof memorySnapshot>>["actions"] = [];
    try {
      const snap = await memorySnapshot();
      actions = snap.actions;
    } catch {
      actions = [];
    }
    return NextResponse.json({
      total: purchases.length,
      active: purchases.filter((p) => p.outcome === "active").length,
      purchases,
      quotes,
      items: actions,
      pending: actions.filter((a) => a.outcome === "pending").length,
      sibyl: bnpl.sibyl,
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "log failed", loadBearing: true },
      { status },
    );
  }
}
