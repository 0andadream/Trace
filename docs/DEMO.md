# Demo script (4 minutes)

Live: https://tracecredits.xyz/demo  
Same wallet the whole way. Default SKU: Notebook Set $12. Base Sepolia.

## 0:00–0:20 Setup

Open `/demo`. Connect the wallet in the header. Say: TRACE is BNPL that remembers this wallet. Sibyl is memory. Alex is the agent, registered on Virtuals ACP. Base Sepolia settles ETH. Code sets the numbers.

## 0:20–0:50 Step 1, empty book

Show the source-of-truth line:

- `inputs: ONCHAIN_SIGNAL`
- keys read: empty `USER_RELATIONSHIP`, on-chain age and tx count
- standing, limit, installments from live policy ($12 / $20 / $24)

If this wallet already has a book, delete in step 5 first, then come back. Point at the three columns: Sibyl remembered nothing → Alex requested the $12 quote → Base has not settled yet.

## 0:50–1:40 Step 2, buy $12

Confirm Notebook $12. Watch the Agent Log later for `MEMORY_READ` → `ACP_REQUEST` (Alex’s Virtuals identity) → `CREDIT_DECISION` → `SETTLEMENT`.

If `BASE_EXECUTE=1`, read the payout tx hash from the truth line. If execute is off, say so: simulated payout, plan still stored.

Open plan: standing is capped at 0.38 until repay.

## 1:40–2:30 Step 3, repay

Repay remaining on-chain. Confirm in the wallet. Sibyl writes `repaymentStatus` only after ETH to the agent is verified. The truth line shows the repay hash next to the Virtuals identity request. No hash, no write.

## 2:30–3:20 Step 4, fresh session

Click “Re-quote $12 as a new request.” This is a new HTTP request, same wallet, same as a new tab.

Unmistakable recall:

- `inputs: USER_RELATIONSHIP`
- `ONCHAIN_SIGNAL not used`
- limit in the $40–$80 band, 4 installments (was $12–$24, 1–2 payments)

Say: the chain did not change. Sibyl is why the offer moved.

## 3:20–3:50 Step 5, delete

Delete Sibyl memory for this wallet. Re-quote $12. First-time terms return. Same address, same on-chain history. `inputs: ONCHAIN_SIGNAL` again.

That is the load-bearing gate.

## 3:50–4:00 Close

`/log` shows a clean on-time book next to a late/defaulted book. `/docs` repeats Sibyl remembered → Alex requested → Base settled. Virtuals never set a limit and never moved funds.

Cut. Do not open GitHub unless a judge asks.
