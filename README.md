# TRACE

[![Live](https://img.shields.io/badge/live-tracecredits.xyz-7828E8)](https://tracecredits.xyz/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Network](https://img.shields.io/badge/network-Base%20Sepolia-0052FF)](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e)
[![Sibyl](https://img.shields.io/badge/memory-Sibyl-6B21A8)](https://github.com/Sibyl-Labs/Sibyl-Memory)
[![Virtuals](https://img.shields.io/badge/identity-Alex%20on%20Virtuals-111111)](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp)

<p align="center">
  <img src="public/wordmark.jpg" alt="TRACE" width="280" />
</p>

**Live product: [tracecredits.xyz](https://tracecredits.xyz/)** — reputation-weighted BNPL. You connect a wallet, Alex quotes a purchase on `/buy`, TypeScript policy approves or declines, ETH settles on Base Sepolia (or is simulated when `BASE_EXECUTE` is off), you repay in installments, and Sibyl’s `USER_RELATIONSHIP` for **that wallet with this agent** is what changes the next offer.

This is **not** the old treasury-agent product. TRACE does not ask the LLM whether you are eligible. `lib/bnpl/policy.ts` `computeApproval` sets Approve / Approve with reduced limit / Decline / Ceiling blocked. The model, if `XAI_API_KEY` is set, only writes reasoning copy.

```
connect wallet → quote → Alex pays/simulates ETH → you repay → Sibyl remembers → next quote uses that book
```

---

## What it actually does

1. **Connect a wallet** in the header (`ConnectWallet`, injected `window.ethereum`). The product keys everything to that address.
2. **Request a BNPL purchase on [`/buy`](https://tracecredits.xyz/buy).** The live checkout is `components/Desk.tsx` (the filename is leftover; the page is BNPL, not the old desk). Default SKU is **Notebook Set $12**.
3. **Alex quotes.** `POST /api/purchase` (quote) then `POST /api/purchase` with `accept: true`. Decision engine: `lib/bnpl/policy.ts`.
4. **Payout.** If `BASE_EXECUTE=1` (or `true`/`yes`), the agent sends **ETH** on Base Sepolia to the user wallet (`lib/base/send.ts`). Display amounts are USD; conversion uses `ETH_USD` (default **2000**). If execute is off, the plan is still stored and the UI labels the payout **Simulated on this testnet**.
5. **Repay in installments** from `/buy`. The user sends ETH back to the agent. `lib/bnpl/verifyUserRepay.ts` must verify that transfer **before** Sibyl writes a repayment. No verified hash, no book update.
6. **Memory drives the next terms.** After at least one purchase exists on `USER_RELATIONSHIP`, `selectPolicyInputs` **drops `ONCHAIN_SIGNAL`** (`onchain: null`). A whale wallet does not override a book this agent already has.

---

## Current routes

Verified against `app/` and the live shell (`components/AppShell.tsx`). Product nav: **Buy, Demo, Docs, Agent Log, My History** (history only when a wallet is connected).

| URL | Code | Purpose |
|---|---|---|
| [`/`](https://tracecredits.xyz/) | `app/page.tsx` | Landing. Wallet connect, Launch App → `/buy`, How it Works, live agent capacity. |
| [`/buy`](https://tracecredits.xyz/buy) | `app/buy/page.tsx` → `Desk` | Product checkout: quote, confirm, repay. This is the app. |
| [`/history`](https://tracecredits.xyz/history) | `app/history/page.tsx` → `HistoryView` | This connected wallet’s Sibyl book. |
| [`/log`](https://tracecredits.xyz/log) | `app/log/page.tsx` → `AgentLog` | Public agent log (MEMORY_READ → ACP_REQUEST → CREDIT_DECISION → SETTLEMENT). |
| [`/demo`](https://tracecredits.xyz/demo) | `app/demo/page.tsx` → `DemoRun` | One-click real BNPL run (agent-controlled demo wallet, no visitor connect). |
| [`/docs`](https://tracecredits.xyz/docs) | `app/docs/page.tsx` → `DocsView` | In-app documentation. |
| [`/terms`](https://tracecredits.xyz/terms) | `app/terms/page.tsx` | Testnet terms stub. |
| [`/privacy`](https://tracecredits.xyz/privacy) | `app/privacy/page.tsx` | Privacy stub (wallet-keyed book, no name/email). |

### Legacy / leftover (not the current product)

These still exist in the repo. Do not treat them as TRACE BNPL.

| URL | What it is |
|---|---|
| `/alex` | **Legacy treasury agent UI** (`components/Alex.tsx`). Transfer-style decisions: Proceed / Proceed with flag / Hold for approval / Ceiling blocked (`lib/policy/decide.ts`, `MAX_TX_AMOUNT_USDC`). Header on this page still has a “Treasury” link. |
| `/desk` | Redirects to `/alex`. |
| `/lend` | Redirects to `/buy`. |
| `/memory` | Redirects to `/history`. |
| `/developers` | Redirects to `/`. |
| `/agent-log` | Redirects to `/log`. |

Leftover libraries that are **not** the live checkout: `lib/policy/` (treasury ceilings), `lib/lending/` (including `MAX_BORROW_AMOUNT` / `MIN_COLLATERAL_RATIO`), `app/api/decide`, `app/api/quote`, `app/api/borrow`, `app/api/supply`, `app/api/preview`, and unused `components/Buy.tsx` (not mounted; `/buy` renders `Desk`).

---

## Decision policy (current BNPL)

Source of truth: [`lib/bnpl/policy.ts`](./lib/bnpl/policy.ts), [`lib/bnpl/relationship.ts`](./lib/bnpl/relationship.ts), [`lib/bnpl/ceiling.ts`](./lib/bnpl/ceiling.ts), [`lib/bnpl/solvency.ts`](./lib/bnpl/solvency.ts).

Hard ceilings, checked **before** terms. Standing, on-chain history, and the LLM cannot override them:

| Variable | Default | File |
|---|---|---|
| `MAX_PURCHASE_AMOUNT` | **10000** | `lib/bnpl/ceiling.ts` (`DEFAULT_MAX_PURCHASE_AMOUNT`) |
| `MAX_ACTIVE_PLANS` | **2** | `lib/bnpl/ceiling.ts` |
| `MIN_AGENT_RESERVE` | **5** (USD-equivalent) | `lib/bnpl/solvency.ts` |

Other live BNPL constants (not env):

| Constant | Value | Meaning |
|---|---|---|
| `DECLINE_STANDING` | 0.18 | Below this, Decline |
| `STARTER_STANDING` | 0.38 | Open-plan cap / first-time established standing |
| `FIRST_CLEAN_LIMIT_MIN` / `MAX` | **40 / 80** | Band after **one** completed on-time plan |
| `LIMIT_AT_MID_STANDING` | **3000** | Gross limit at standing 0.50 (score 50) |
| `DEFAULT_LIMIT_CAP` | **8** | After any default |
| `OPEN_PLAN_LIMIT_CAP` | **24** | Open plan, no completed on-time |
| `INSTALLMENT_SPACING_DAYS` | 14 | Multi-payment spacing |
| `SHORT_PLAN_DAYS` | 7 | Single-payment due |

`selectPolicyInputs`:

- `total_purchases == 0` → primary `ONCHAIN_SIGNAL`. First-time limits from `onchainBaseline`:
  - **thin** (age &lt; 7d **or** &lt; 3 txs): limit **$12**, **1** installment, standing 0.22
  - **moderate** (age &lt; 90d **or** &lt; 30 txs): limit **$20**, **2** installments, standing 0.32
  - **established**: limit **$24**, **2** installments, standing 0.38
- `total_purchases > 0` → primary `USER_RELATIONSHIP`, `onchain: null`. On-chain is never used again for that wallet with this agent.

Trace interest is code: `interestRateFromStanding` (floor 2%, ceiling 26%). You receive principal; you repay principal + interest.

**Legacy treasury-only (not BNPL):** `MAX_TX_AMOUNT_USDC` default **25** in `lib/policy/ceiling.ts`, used by `/alex`. `MAX_BORROW_AMOUNT` / `MIN_COLLATERAL_RATIO` in `.env.example` are labeled lending ceilings (legacy desk).

---

## Load-bearing memory test

This is the current BNPL loop, not the old treasury transfer demo. Numbers below are produced by `liveWalkthrough()` in [`lib/bnpl/walkthrough.ts`](./lib/bnpl/walkthrough.ts) against the same `computeApproval` as `/buy`. SKU: **Notebook Set $12**.

1. **Run the real loop without connecting.** [`/demo`](https://tracecredits.xyz/demo) **Run the demo** uses `POST /api/demo/run` and `DEMO_WALLET_PRIVATE_KEY` (server-side only) as the buyer. Same `runAcceptPurchase` / `runRepayInstallment` as `/buy`. The run originates **two** purchases: empty-book, repay, then a second accept on the remembered book. To be the signer yourself, use [`/buy`](https://tracecredits.xyz/buy).
2. **First purchase $12** with an empty book.
   - Inputs: `ONCHAIN_SIGNAL`.
   - Thin wallet: Approve, limit **$12**, **1 payment of $14.52** (21% interest).
   - Moderate: Approve, limit **$20**, **2 payments of $7.08**.
   - Established: Approve, limit **$24**, **2 payments of $7.02**.
   - Confirm. If `BASE_EXECUTE=1`, ETH is sent to your wallet; otherwise the UI says simulated. The plan is stored either way.
   - While the plan is open: standing **0.38**, limit capped at **$24**.
3. **Repay** from `/buy` (or demo step 3). Confirm the ETH transfer to the agent. Sibyl writes `on_time` / `late` only after verification.
4. **Second purchase, same wallet, new request.** Re-quote $12. On `/demo` this is a second `runAcceptPurchase` (ETH payout included), not a quote-only step.
   - Inputs: `USER_RELATIONSHIP`. Factor text includes **`ONCHAIN_SIGNAL not used`**.
   - After one completed **on-time** $12: Approve, limit **$43.33** (inside the $40–$80 first-clean band), **4 payments of $3.51**, standing **0.39**.
5. **Reset memory** (`pnpm memory:reset` locally, or delete in History). Chain is unchanged.
6. **Same wallet, quote $12 again.** Empty book. First-time `ONCHAIN_SIGNAL` terms return ($12 / $20 / $24).

A **late** completion of that $12 (no default) currently quotes limit **$16**, **2** installments — worse than the clean $43.33 / 4-pay plan. Any **default** caps standing at **0.12** and **Declines**, limit **$8**.

Locked in `lib/bnpl/policy.test.ts`. Judge script: [`docs/DEMO.md`](./docs/DEMO.md).

```bash
pnpm memory:reset
pnpm dev                 # http://localhost:3002
```

Then `/demo` → **Run the demo** (no visitor wallet). Or `/buy` → connect → buy $12 → repay → re-quote.

---

## Setup (verified against `package.json` and `.env.example`)

**Prerequisites:** Node 20, pnpm (`packageManager`: `pnpm@10.34.5`), Python 3.10+ only if you want the local Python Sibyl bridge.

```bash
git clone https://github.com/0andadream/Trace.git && cd Trace
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt   # sibyl-memory-client>=0.6.1
pnpm install
cp .env.example .env.local
pnpm test
pnpm wallet:create          # writes AGENT_PRIVATE_KEY to .env.local; never committed
pnpm dev                    # next dev --port 3002 → http://localhost:3002
```

Other scripts: `pnpm build` / `pnpm start` (port 3002), `pnpm memory:reset`, `pnpm memory:export`, `pnpm memory:seed` (**do not run seed against production Redis**), `pnpm demo:wallet`, `pnpm demo:fund`, `pnpm demo:reset` (demo wallet Sibyl book only; not a public HTTP route), `pnpm sibyl:health`, `pnpm acp:job`, `pnpm acp:request`, `pnpm mcp`.

### Environment variables (from `.env.example`)

| Variable | Role |
|---|---|
| `XAI_API_KEY` | Optional. Alex still decides without it; the model only writes copy. |
| `SIBYL_PYTHON` | Local Python binary (default `.venv/bin/python`). |
| `SIBYL_MEMORY_DB` | Local SQLite path (default `.data/sibyl-memory.db`). |
| `SIBYL_TENANT` | Default `trace-alex`. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel Redis. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Same Redis, Upstash names. |
| `AGENT_PRIVATE_KEY` | Treasury/BNPL signer. From `pnpm wallet:create`. |
| `AGENT_ADDRESS` | Published signer if the key is absent. Repo default `0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e`. |
| `DEMO_WALLET_PRIVATE_KEY` | Buyer signer for `/demo` **Run the demo**. From `pnpm demo:wallet`. Server-side only; never sent to the client. Must not be `AGENT_PRIVATE_KEY`. |
| `DEMO_WALLET_ADDRESS` | Public demo buyer if the key is absent. Also published in `config/demo-wallet.json`. |
| `DEMO_RATE_WINDOW_SEC` | Optional. Per-IP cooldown for `POST /api/demo/run`. Default 180. |
| `BASE_PRIVATE_KEY` | Alias written by `wallet:create`; `lib/wallet.ts` accepts it if `AGENT_PRIVATE_KEY` is empty. |
| `SEPOLIA_RPC_URL` / `BASE_RPC_URL` | Default `https://sepolia.base.org`. |
| `BASE_CHAIN_ID` | **84532** Base Sepolia (8453 would be Base mainnet). |
| `BASE_EXECUTE` | Must be `1` / `true` / `yes` to broadcast. Otherwise payouts are simulated. |
| `VIRTUALS_ACP` | Optional. Default: ACP outbound runs when `BASE_EXECUTE=1`. Set `0` to skip without faking a job. |
| `MAX_PURCHASE_AMOUNT` | BNPL hard cap. Default 10000. |
| `MAX_ACTIVE_PLANS` | BNPL hard cap. Default 2. |
| `MIN_AGENT_RESERVE` | Agent cannot approve a payout that would leave cash below this. Default 5. |
| `MOCK_MERCHANT` | Optional merchant address for execute-on payouts. |
| `ETH_USD` | USD→ETH rate for settlement. Default 2000. |
| `AGENT_SIMULATED_USDC` | Fallback spendable USD if the chain balance cannot be read. Default 100. |
| `MAX_TX_AMOUNT_USDC` | **Legacy treasury only** (`/alex`, default 25). Not the BNPL purchase cap. |
| `MAX_BORROW_AMOUNT` / `MIN_COLLATERAL_RATIO` | **Legacy lending/desk.** |

---

## Wallet and funding (Base Sepolia)

1. `pnpm wallet:create` generates a key into `.env.local` and will refuse if `.gitignore` does not list `.env.local`.
2. Stats can read the published address in [`config/agent-wallet.json`](./config/agent-wallet.json): `0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e` on `sepolia`.
3. Fund **that agent** with Base Sepolia ETH. User repayments also go to this address.
4. `pnpm demo:wallet` then `pnpm demo:fund` for the `/demo` buyer (separate key, Base Sepolia ETH for gas + the interest gap above the $12 payout).
5. In the browser, connect **your** injected wallet on Base Sepolia (chain id 84532) for `/buy`. **Run the demo** does not need a visitor wallet.
6. Set `BASE_EXECUTE=1` on Vercel for live payouts at tracecredits.xyz. If execute is off, quotes and books still work; ETH is not broadcast.

Explorer: [agent on Base Sepolia](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e).

---

## Sibyl Memory

Sibyl **stores and recalls**. It does not compute standing, limits, interest, or lateness. Those stay in TypeScript (`relationship.ts`, `policy.ts`, `ceiling.ts`) so laptop and Vercel use the same numbers. Detail: [`docs/sibyl-parity.md`](./docs/sibyl-parity.md).

**What is stored now** for the product: `USER_RELATIONSHIP` per wallet — purchases, installment schedules, outcomes (`on_time` / `late` / `defaulted` / `active`), quotes, overrides, and a compact `snapshot` (`last_outcome`, `open_plans`, `standing`, `trust_note`). Standing and limit are **recomputed on read**, not trusted as stored fields. `ONCHAIN_SIGNAL` is fetched fresh and never written as history.

| Path | When | Storage |
|---|---|---|
| Python `sibyl/bridge.py` | Laptop, if `.venv/bin/python` exists | SQLite (`SIBYL_MEMORY_DB`) |
| Node `lib/memory/engine.ts` + `persist.ts` | Always available; **required on Vercel** | Redis keys, no TTL on history. File fallback `.data/sibyl-memory.json` **off** Vercel |

On Vercel (`VERCEL=1`), Redis must ping. If it does not, APIs return **503** (`Sibyl unavailable`) instead of an empty book. Redis keys look like `sibyl:{tenant}:rel:{wallet}`. Locks use `SET NX EX 8` only.

---

## Virtuals ACP (honest state)

Alex is registered:

- Agent id: `01a05400-aea9-7f70-a67e-f558448e86e3`
- Profile: [app.virtuals.io/acp/agents/…](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp)
- Portal/Privy wallet on the registry (not the TRACE Base signer): `0xf3df4e32fb19dc0456a3e59eddfa0d821e65a2c5`

From `lib/virtuals/status.ts` as shipped:

- **`marketplaceListener` is hardcoded `false`.** There is no Virtuals SSE/SDK seller listener in this repo.
- **`jobEndpoint` is `true`.** `POST /api/acp/jobs` maps a job into `computeApproval` (`lib/virtuals/incoming.ts`). Incoming jobs that hit this HTTP adapter use the same BNPL engine. That is not the same as a live marketplace listener.
- Status string when the profile GET succeeds: *“Agent registered on Virtuals ACP. Marketplace listener is not connected. TRACE ACP job endpoint uses the existing decision engine.”*

Virtuals does **not** set the limit and does **not** move user funds. ACP identity is attached to quotes (`ACP_REQUEST` in the log). `VIRTUALS_ACP=0` skips outbound ACP without inventing a job.

---

## Architecture

```
User wallet (injected) on /buy
  or demo buyer (DEMO_WALLET_PRIVATE_KEY, server-side) on /demo Run the demo
  → POST /api/purchase  →  lib/bnpl/policy.ts computeApproval
  → Sibyl USER_RELATIONSHIP (Redis on Vercel / SQLite or JSON locally)
  → ETH payout on Base Sepolia if BASE_EXECUTE=1
  → POST /api/repay after verified buyer ETH
  → next quote reads the same book
```

| Object | Role |
|---|---|
| `lib/bnpl/policy.ts` | `selectPolicyInputs` / `computeApproval` |
| `lib/bnpl/relationship.ts` | Standing, limit curve, snapshot |
| `lib/bnpl/ceiling.ts` | `MAX_PURCHASE_AMOUNT`, `MAX_ACTIVE_PLANS` |
| `lib/bnpl/solvency.ts` | `MIN_AGENT_RESERVE` |
| `lib/memory/engine.ts` | Sibyl write path |
| `lib/bnpl/store.ts` | Read path (`getRelationship`) |
| `lib/base/send.ts` | Agent ETH payout |
| `lib/bnpl/verifyUserRepay.ts` | No verified ETH, no Sibyl repay write |
| `lib/virtuals/identity.ts` | Alex ACP id and profile URL |

---

## Tests

```bash
pnpm test                 # policy, memory primacy, repay-after-verify, ACP mapping
npx tsc --noEmit
```

Load-bearing sequence in `lib/bnpl/policy.test.ts`: empty book uses on-chain; one on-time $12 improves limit and installment count with `ONCHAIN_SIGNAL not used`; empty again is first-time.

---

## Honesty

- **Testnet only.** No real goods, no mainnet credit.
- Live payouts need `BASE_EXECUTE=1` and a funded agent wallet.
- Virtuals identity is live; marketplace listening is not.
- First-time users with a fat on-chain wallet still get $12 / $20 / $24 until Sibyl has a purchase.
- Production Sibyl is Redis. Local can be Python+SQLite.
- Do not `pnpm memory:seed` against production Redis.

---

## Attribution

**Memory** — [Sibyl](https://github.com/Sibyl-Labs/Sibyl-Memory). Persistent `USER_RELATIONSHIP`.

**Identity** — [Virtuals ACP](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp). Alex is a registered agent. Virtuals does not underwrite and does not settle.

**Settlement** — [Base](https://www.base.org/) Sepolia. ETH payout and repay.

**App** — [Next.js](https://nextjs.org), [React](https://react.dev), [viem](https://viem.sh).

TRACE, Alex, the credit policy, and the deletion test in this repository are original work.

---

## License

MIT. See [LICENSE](./LICENSE).
