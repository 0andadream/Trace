import { runAcceptPurchase, runPurchaseQuote } from "@/lib/bnpl/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.accept) {
      const result = await runAcceptPurchase({
        wallet: body.wallet,
        amount: Number(body.amount),
        merchant: body.merchant,
        override: Boolean(body.override),
        pay_in_full: Boolean(body.pay_in_full),
        installments: body.installments != null ? Number(body.installments) : undefined,
      });
      return NextResponse.json(result);
    }
    const result = await runPurchaseQuote({
      wallet: body.wallet,
      amount: Number(body.amount),
      merchant: body.merchant,
      persist: body.persist !== false,
      pay_in_full: Boolean(body.pay_in_full),
      installments: body.installments != null ? Number(body.installments) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "purchase failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
