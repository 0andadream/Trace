# Demo script (4 minutes)

Live: https://tracecredits.xyz/demo  
Default SKU: Notebook Set $12. Base Sepolia.

The primary path is **Run the demo**. No visitor wallet. The server signs as a dedicated demo buyer (`DEMO_WALLET_PRIVATE_KEY`), then calls the same `POST /api/purchase` / `POST /api/repay` functions as `/buy`. Sibyl reads and writes are real. Payouts and repayments are real Base Sepolia transactions when `BASE_EXECUTE=1`.

## 0:00–0:20 Setup

Open `/demo`. Do **not** connect a wallet. Read the label: this run uses an agent-controlled test wallet — real Sibyl memory, real Base Sepolia transactions. Point at `/buy` for anyone who wants to be the signer themselves.

If the page says the demo is temporarily unavailable (agent reserve low, or demo wallet needs ETH), stop. That message is load-bearing, not a spinner bug.

## 0:20–3:20 Run the demo

Click **Run the demo**. Watch the stream. Every number, hash, and reasoning string is from the live APIs.

1. **Memory.** `USER_RELATIONSHIP` for the demo wallet. This run clears only that wallet’s book first so you see empty-book terms, then a real repay, then improved terms.
2. **First purchase.** Real `runAcceptPurchase` for Notebook $12. Decision / standing / limit / installments come from `computeApproval`.
3. **Payout.** If execute is on, the agent sends ETH to the demo wallet. Open the hash on [Base Sepolia explorer](https://sepolia.basescan.org). Confirmed transfer, not a mock.
4. **Repay.** The demo wallet signs a real ETH transfer back to Alex. Open that hash too. `POST /api/repay` runs only after `verifyUserRepay`.
5. **Second purchase.** New `runPurchaseQuote` as the same address. Inputs should now be `USER_RELATIONSHIP`. Limit and installment count should move (first-clean band after an on-time $12). Reasoning cites the book just written — not a hardcoded before/after.

Rate limit: one public run per IP per few minutes. Do not mash the button.

## 3:20–3:50 Optional: own wallet

Scroll to the five-step walkthrough if a judge wants to connect MetaMask/Rabby/Coinbase and be the buyer. Same APIs. Prefer `/buy` for the full self-serve checkout.

## 3:50–4:00 Close

`/log` shows the run. `/docs` repeats Sibyl remembered → Alex requested → Base settled. Virtuals never set a limit and never moved user funds.

Admin only (not on the page): `pnpm demo:reset` deletes this demo wallet’s Sibyl row. `pnpm memory:reset` wipes the whole store — do not use that in a judging session unless you mean it.

Cut. Do not open GitHub unless a judge asks.
