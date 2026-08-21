import { runDecide } from "@/lib/desk/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { withRequestTenant } from "@/lib/user/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await withRequestTenant(() => runDecide(body));
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "decide failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
