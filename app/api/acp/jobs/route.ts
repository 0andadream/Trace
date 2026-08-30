import { handleAcpCreditJob } from "@/lib/virtuals/incoming";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await handleAcpCreditJob({
      requirement: body,
      accept: Boolean(body.accept),
      persist: body.persist !== false,
    });
    return NextResponse.json({
      ok: true,
      channel: result.channel,
      engine: "lib/bnpl/policy.ts computeApproval",
      requirement: result.requirement,
      decision: result.quote.terms.decision,
      accepted: result.accepted,
      quote: result.quote,
      purchase: result.purchase?.purchase || null,
      tx: result.purchase?.tx || null,
      payout_mode: result.purchase?.payout_mode || null,
    });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ACP job failed", loadBearing: err instanceof SibylUnavailable },
      { status },
    );
  }
}
