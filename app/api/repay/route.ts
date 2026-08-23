import { runRepayInstallment } from "@/lib/bnpl/run";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await runRepayInstallment({
      wallet: body.wallet,
      purchase_id: body.purchase_id,
      installment_index: body.installment_index,
      repaid_at: body.repaid_at,
      mark_default: Boolean(body.mark_default),
      tx_hash: body.tx_hash,
      pay_remaining: Boolean(body.pay_remaining),
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
