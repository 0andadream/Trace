import { previewRequest } from "@/lib/desk/preview";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { withRequestTenant } from "@/lib/user/session";
import { NextResponse } from "next/server";
import type { TxAction } from "@/types";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const preview = await withRequestTenant(() => previewRequest({
      action: (url.searchParams.get("action") as TxAction) || "transfer",
      token: url.searchParams.get("token") || "",
      amount: Number(url.searchParams.get("amount") || 0),
      recipient: url.searchParams.get("recipient") || "",
    }));
    return NextResponse.json(preview);
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "preview failed" },
      { status },
    );
  }
}
