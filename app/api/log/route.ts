import { memorySnapshot } from "@/lib/desk/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const snap = await memorySnapshot();
    return NextResponse.json({
      total: snap.actions.length,
      pending: snap.actions.filter((a) => a.outcome === "pending").length,
      items: snap.actions,
      sibyl: snap.sibyl,
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "log failed", loadBearing: true },
      { status },
    );
  }
}
