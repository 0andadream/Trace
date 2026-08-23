import { getAgentStatus } from "@/lib/bnpl/status";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getAgentStatus();
    return NextResponse.json(status);
  } catch (err) {
    const code = err instanceof SibylUnavailable ? 503 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "agent status failed", loadBearing: err instanceof SibylUnavailable },
      { status: code },
    );
  }
}
