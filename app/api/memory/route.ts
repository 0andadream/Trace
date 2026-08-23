import { bnplSnapshot } from "@/lib/bnpl/run";
import { memorySnapshot } from "@/lib/desk/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const bnpl = await bnplSnapshot();
    let treasury: Awaited<ReturnType<typeof memorySnapshot>> | null = null;
    try {
      treasury = await memorySnapshot();
    } catch {
      treasury = null;
    }
    return NextResponse.json({
      relationships: bnpl.relationships,
      AGENT_REPUTATION: treasury?.reputation ?? null,
      counterparties: treasury?.counterparties ?? [],
      sibyl: bnpl.sibyl,
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "memory failed", loadBearing: true },
      { status },
    );
  }
}
