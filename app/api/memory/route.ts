import { memorySnapshot } from "@/lib/desk/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const snap = await memorySnapshot();
    return NextResponse.json({
      AGENT_REPUTATION: snap.reputation,
      counterparties: snap.counterparties,
      sibyl: snap.sibyl,
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "memory failed", loadBearing: true },
      { status },
    );
  }
}
