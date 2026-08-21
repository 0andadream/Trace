import { memorySnapshot } from "@/lib/desk/run";
import { NextResponse } from "next/server";

export async function GET() {
  const snap = await memorySnapshot();
  return NextResponse.json({
    AGENT_REPUTATION: snap.reputation,
    counterparties: snap.counterparties,
  });
}
