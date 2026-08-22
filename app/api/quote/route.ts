import { runQuote } from "@/lib/lending/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await runQuote({
      wallet: body.wallet,
      amount: Number(body.amount),
      asset: body.asset,
      persist: body.persist !== false,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "quote failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
