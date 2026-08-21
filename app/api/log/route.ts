import { memorySnapshot } from "@/lib/desk/run";
import { NextResponse } from "next/server";

export async function GET() {
  const snap = await memorySnapshot();
  return NextResponse.json({
    total: snap.actions.length,
    pending: snap.actions.filter((a) => a.outcome === "pending").length,
    items: snap.actions,
  });
}
