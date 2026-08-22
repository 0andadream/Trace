import { runRepay } from "@/lib/lending/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await runRepay({
      wallet: body.wallet,
      loan_id: body.loan_id,
      repaid_at: body.repaid_at,
      mark_default: Boolean(body.mark_default),
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "repay failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
