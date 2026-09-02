import { getDemoStatus } from "@/lib/bnpl/demoRun";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getDemoStatus();
    return NextResponse.json(status);
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 500;
    return NextResponse.json(
      {
        available: false,
        reason: err instanceof Error ? err.message : "Demo status failed.",
        loadBearing: err instanceof SibylUnavailable,
      },
      { status },
    );
  }
}
