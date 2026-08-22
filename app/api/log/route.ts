import { memorySnapshot } from "@/lib/desk/run";
import { lendingSnapshot } from "@/lib/lending/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const lending = await lendingSnapshot();
    const loans = lending.relationships.flatMap((rel) =>
      rel.loans.map((loan) => ({ ...loan, wallet_address: rel.wallet_address })),
    );
    let actions: Awaited<ReturnType<typeof memorySnapshot>>["actions"] = [];
    try {
      const snap = await memorySnapshot();
      actions = snap.actions;
    } catch {
      actions = [];
    }
    return NextResponse.json({
      total: loans.length,
      active: loans.filter((l) => l.outcome === "active").length,
      loans,
      items: actions,
      pending: actions.filter((a) => a.outcome === "pending").length,
      sibyl: lending.sibyl,
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "log failed", loadBearing: true },
      { status },
    );
  }
}
