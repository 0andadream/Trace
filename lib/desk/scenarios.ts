import type { TreasuryRequest } from "@/types";

export function requestFromBody(body: Partial<TreasuryRequest>): TreasuryRequest {
  return {
    action: body.action || "transfer",
    token: (body.token || "").trim().toUpperCase(),
    amount: Number(body.amount ?? 0),
    recipient: (body.recipient || "").trim(),
    note: body.note,
  };
}
