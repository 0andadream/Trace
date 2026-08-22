import { memorySnapshot } from "@/lib/desk/run";
import { lendingSnapshot } from "@/lib/lending/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const lending = await lendingSnapshot();
    let treasury: Awaited<ReturnType<typeof memorySnapshot>> | null = null;
    try {
      treasury = await memorySnapshot();
    } catch {
      treasury = null;
    }
    return NextResponse.json({
      relationships: lending.relationships,
      AGENT_REPUTATION: treasury?.reputation ?? null,
      counterparties: treasury?.counterparties ?? [],
      sibyl: lending.sibyl,
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "memory failed", loadBearing: true },
      { status },
    );
  }
}
