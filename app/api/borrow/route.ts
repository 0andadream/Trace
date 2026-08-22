import { runBorrow } from "@/lib/lending/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await runBorrow({
      wallet: body.wallet,
      amount: Number(body.amount),
      asset: body.asset,
      override: Boolean(body.override),
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "borrow failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
