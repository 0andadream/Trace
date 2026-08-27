# Trace

Trace is a reputation-weighted buy-now-pay-later agent on Base Sepolia. The agent is **Alex**.

You connect a wallet (that address is your login). You ask to buy something. Alex looks up **this agent’s memory of that wallet** — purchases it approved here, and whether those were repaid on time, late, or missed. If the book is empty, it uses a conservative on-chain baseline (wallet age and tx count, fetched fresh, never stored). Then it says yes or no.

On **Approve**, Alex sends **ETH** to **your connected wallet** when `BASE_EXECUTE=1` (this is on at [trace-26xx.vercel.app](https://trace-26xx.vercel.app/)). Amounts on screen are **USDC-equivalent**. You repay by signing an **ETH** transfer back to Alex. The installment is written to memory only after that transfer is verified on-chain.

Pay on time and the next limit and plan can get better. Miss a payment and it gets harder, fast. Delete Sibyl and Alex forgets; the chain still looks the same. That is the [Sibyl Labs Hackathon](https://hack.sibyllabs.org/) load-bearing gate.

```
REQUEST → CEILING → SOLVENCY → USER_RELATIONSHIP? → APPROVAL_POLICY → SEND ETH → RECORD
              │          │              │ no purchases
              │          │              ▼
              │          │        ONCHAIN_SIGNAL (fresh, not stored)
              │          ▼
              │     MIN_AGENT_RESERVE vs agent cash + outstanding exposure
              ▼
        MAX_PURCHASE_AMOUNT / MAX_ACTIVE_PLANS
```

Live: [https://trace-26xx.vercel.app/](https://trace-26xx.vercel.app/) · Base Sepolia (`84532`) · Agent [`0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e`](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e).

Merchant names (`Test Shop`, `Sibyl Labs (test merchant)`, …) are **labels**. ETH is sent to the connected user wallet, not to a merchant contract.

## Core principle (enforced in code)

`lib/bnpl/policy.ts` → `selectPolicyInputs()`:

- `USER_RELATIONSHIP.total_purchases == 0` → terms = f(ONCHAIN_SIGNAL)
- `total_purchases > 0` → on-chain is set to `null` and never enters the terms function

What Sibyl stores **cannot** be reconstructed from the chain:

- Purchases this agent approved for this wallet
- Installment outcomes on **those** plans (`on_time` / `late` / `defaulted`)
- Human overrides of this agent’s approve/decline
- This agent’s prior quotes and reasoning

Standing and limit are computed in TypeScript (`standingFromHistory` / `limitFromStanding` in `lib/bnpl/relationship.ts`), not by Sibyl or Grok. Sibyl stores the book; code turns it into a score. Displayed score is standing × 100.

- An **open** plan does not raise standing above the starter cap (`STARTER_STANDING` = 0.38, score 38).
- Each **completed on-time** plan adds 0.005 standing (~0.5 displayed points), plus a small repaid-share term.
- Limit: scores 0–50 stay under **$3k** (50 = $3k), then climb to **$10k** at standing 0.95 (`MAX_PURCHASE_AMOUNT`).
- One default caps standing at 0.12 and Declines, regardless of volume (`DEFAULT_LIMIT_CAP` = $8).
- Due dates are 7 days out for a 1-payment plan, otherwise 14 days apart, so a repay made now is `on_time`.

The LLM (`XAI_API_KEY`, optional) only writes reasoning. Decision, limit, installment count, interest, and due dates are computed in code and re-applied even if the model lies.

## Routes

What the live header and footer actually open (see `app/` and `components/AppShell.tsx`):

| URL | What |
|---|---|
| `/` | Landing: how it works, live agent cash, ETH payout status |
| `/buy` | Connect wallet, request a purchase, repay open plans. Score breakdown + memory timeline when connected. |
| `/history` | **My History** — private to the connected wallet. Timeline, score breakdown, repay. |
| `/log` | **Agent Log** — public quotes and purchases across wallets, with explorer links on real payouts |
| `/docs` | Product docs |
| `/privacy` · `/terms` | Legal |

Redirects that still exist:

| URL | Goes to |
|---|---|
| `/lend` | `/buy` |
| `/memory` | `/history` |
| `/agent-log` | `/log` |
| `/developers` | `/` |
| `/desk` | `/alex` |

`/alex` is a leftover treasury desk (Proceed / Hold, `MAX_TX_AMOUNT_USDC`). It is **not** in the live nav and is not how you use Trace. Ignore it unless you are digging through leftover code.

## Use Alex

Needs Node 20, pnpm, and (for local Sibyl) Python 3.10+ with the venv below. Dev server is **port 3002**.

```bash
pnpm dev                 # http://localhost:3002
```

On `/buy`:

1. **Connect Wallet** (MetaMask, Rabby, or Coinbase Wallet on Base Sepolia). That address is the relationship key. It is not `AGENT_PRIVATE_KEY`.
2. Amount (shown as USDC) + merchant → **Request Purchase**. Desk quotes, then originates the plan when the decision is Approve / Approve with reduced limit.
3. If `BASE_EXECUTE=1` and the agent key can broadcast: Alex sends ETH to your wallet and the UI shows **Alex → your wallet: $X in ETH sent** plus a [Base Sepolia explorer](https://sepolia.basescan.org) link. Otherwise the approval is still stored, and the payout is labeled simulated.
4. **Pay next** or **Pay remaining** on `/buy` or `/history`. Confirm an ETH transfer **to Alex** in your wallet (value shown as USDC). The API records the installment only after it verifies that transfer.

```
Decision: Approve

Reasoning:
- …

Terms: receive 12 · repay … · Trace interest …% · 2 installments · due …
```

| Decision | What happens |
|---|---|
| **Approve** | Quoted limit + installment count + due dates. Agent sends ETH to your wallet (`on_chain` with a tx hash, or **simulated**). |
| **Approve with reduced limit** | Amount exceeds available limit. Origination uses the reduced size. |
| **Decline** | Default (or standing &lt; `DECLINE_STANDING` 0.18) in this agent’s book, available limit 0, or agent insolvency. |
| **Ceiling blocked** | Amount &gt; `MAX_PURCHASE_AMOUNT`, or `MAX_ACTIVE_PLANS` already open. Scoring skipped. |

The agent signer (`AGENT_PRIVATE_KEY`) pays you. You connect to identify yourself, receive the ETH, and send repay ETH.

## APPROVAL_POLICY

Deterministic, in `lib/bnpl/policy.ts`. Ceilings in `lib/bnpl/ceiling.ts` and `lib/bnpl/solvency.ts` run **before** / around scoring. The LLM cannot undercut them.

| Book | Limit | Installments | Notes |
|---|---|---|---|
| Empty + thin chain (age &lt; 7d **or** &lt; 3 txs) | **$12** | 1 | `onchainBaseline` thin; standing 0.22 |
| Empty + moderate chain | **$20** | 2 | standing 0.32 |
| Empty + established chain | **$24** | 2 | standing **capped at 0.38** |
| Clean repeat (this agent) | **$3k at score 50**, then → **$10k** at 95 | **4** | Scores 0–50 stay under $3k. After one completed on-time $12, gross limit is about **$2,358** (standing 0.393), not the on-chain $12–24 band. |
| Any default in this agent’s book | cut to $8, then Decline | 0 | Standing **capped at 0.12** |
| Late completion, no default | worse than clean | 2 | |
| Active unpaid plan | gross limit − outstanding | unchanged | Cannot overextend an open plan |

Trace interest is higher when standing is lower (floor 2%, ceiling 26%). You can pay the next installment or the remaining balance at repay time.

Hard caps (defaults):

| Variable | Default | Role |
|---|---|---|
| `MAX_PURCHASE_AMOUNT` | `10000` | Hard purchase cap. Unlocked at score 95. |
| `MAX_ACTIVE_PLANS` | `2` | Concurrent open plans per book. |
| `MIN_AGENT_RESERVE` | `5` | Agent cannot approve a payout that would leave spendable cash below this (USDC-equivalent). |

`MAX_TX_AMOUNT_USDC` is still in `.env.example` and `lib/policy/ceiling.ts`. It applies to the leftover `/alex` treasury desk only. BNPL payouts skip it (`sendMerchantPayout` → `skipTreasuryCeiling`).

## Load-bearing test (run this live, under a few minutes)

Needs the app running (`pnpm dev` → http://localhost:3002). Use a wallet that is **not** in the seed file. Same wallet every step. Amount stays at **12**. You need Base Sepolia ETH in that wallet to repay.

### 0. Reset, then run the app

```bash
pnpm memory:reset
pnpm dev                  # http://localhost:3002
```

Confirm reset printed `Relationships:    0 (want 0)`.

### a. New wallet → on-chain baseline

1. Open http://localhost:3002/buy
2. **Connect Wallet**
3. Merchant `Test Shop`, amount `12` → **Request Purchase**

Expect:

- Decision: **Approve** (or **Approve with reduced limit** if the ask is above the on-chain band)
- Why-line about not having a relationship yet
- Reasoning / factors include `USER_RELATIONSHIP is empty. No purchase history exists.`
- Primary **ONCHAIN_SIGNAL**
- Short plan: **1** installment (thin) or **2** (moderate / established)
- Limit in the **$12 / $20 / $24** band
- If `BASE_EXECUTE=1` and the agent is funded: a real ETH send to your wallet plus an explorer link. If not: simulated payout, plan still stored.

### b. Repay on time

On `/buy` (open plans) or `/history`: **Pay next** until the plan is `completed_on_time`. Confirm the ETH transfer in the wallet.

The API (`POST /api/repay`) records the installment only after it verifies a native ETH transfer (from your wallet, to Alex, USDC-equivalent at `ETH_USD`) on Base Sepolia. No on-chain transfer means no repay.

Due dates are in the future, so paying now is `on_time`.

### c. Same wallet, second purchase → memory-improved terms

Amount `12` again → **Request Purchase**.

Expect:

- **Limit much higher** than the $12–24 on-chain band (about **$2,358** gross after one completed on-time $12)
- **4 installments** (clean relationship book), not 1–2
- Reasoning cites **that purchase / repayment** (`ONCHAIN_SIGNAL not used`)
- Why-line that the last purchase was repaid on time

That jump is the point: the better plan lived in Sibyl, not in the wallet’s public chain history.

### d. Reset memory → treated as new again

```bash
pnpm memory:reset
```

Same wallet, same **12**, **without** seeding.

Expect:

- Empty-relationship copy again
- Limit and installment count back to the step-a baseline
- The improved terms are gone even though the wallet’s on-chain history is unchanged

### e. Agent solvency — decline that ignores the wallet

This beat is **not about the user**. Use any wallet that would otherwise Approve.

Stop the dev server, then:

```bash
MIN_AGENT_RESERVE=10000 pnpm dev
```

On `/buy`, amount `12` → **Request Purchase**.

Expect:

- Decision: **Decline**
- Terms: `insolvent_declined`
- Reasoning says **MIN_AGENT_RESERVE** and that user standing was not used

Restore reserve (`5`) and restart `pnpm dev`. Same wallet at reserve 5 is Approve again.

### Optional: seeded contrast (local CLI, no private keys)

These addresses are not wallets you connect in the UI. They are books you can seed and inspect:

```bash
pnpm memory:reset
pnpm memory:seed          # seeds/bnpl-demo-seed.json
```

| Wallet | Book | Quote for 12 at Test Shop |
|---|---|---|
| `0x111111111111111111111111111111111111c1ea` | 3 on-time purchases | **Approve**, high limit, **4** installments, relationship primary |
| `0x222222222222222222222222222222222222d00d` | 2 on-time + **1 default** | **Decline**, relationship primary |

A third wallet (yours) is the on-chain-only baseline until it has a purchase in this agent’s book.

`MAX_PURCHASE_AMOUNT` default is **10000** (ceiling-blocked above that). Two active plans is **Ceiling blocked** (`MAX_ACTIVE_PLANS`).

## Setup

Python 3.10+ (3.12 recommended) and Node 20+ **on your laptop**. Vercel’s Node runtime cannot spawn `.venv/bin/python`. There the same Sibyl ops run in Node. **Create a Redis store on the Vercel project** so every visitor shares one durable book:

1. Vercel dashboard → the Trace project → **Storage** → **Create Database** → **Redis** (Upstash)
2. Connect it to Production (and Preview if you want)
3. Redeploy. Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`)

Without that store, Vercel memory is `/tmp` and can reset on a cold start.

```bash
cd Trace
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
pnpm install
cp .env.example .env.local
pnpm test
pnpm wallet:create
pnpm dev                     # http://localhost:3002
```

`pnpm wallet:create` writes `AGENT_PRIVATE_KEY` to `.env.local` (gitignored) and the public address to `config/agent-wallet.json`. It aborts if `.gitignore` does not list `.env.local`.

### Fund the agent (Base Sepolia)

BNPL settlement is **native ETH**, priced at `ETH_USD` (default `2000`). Fund the printed agent address with **Base Sepolia ETH**:

- **Gas** for broadcasts
- **Payouts** to users when `BASE_EXECUTE=1`

You do **not** need Circle testnet USDC for the current BNPL path. (USDC still exists in leftover treasury send code.)

End users **Connect Wallet** on `/buy` and also need Base Sepolia ETH to repay.

Set `BASE_EXECUTE=1` in `.env.local` to broadcast. `runAcceptPurchase` only broadcasts when that value is exactly `1`. Leave it unset/off to record simulated payouts while still writing the plan to Sibyl.

## Memory seed and reset

Local CLI only. **Not** exposed as HTTP routes.

```bash
pnpm memory:seed                          # seeds/bnpl-demo-seed.json
pnpm memory:seed seeds/demo-seed.json     # leftover treasury seed (actions, not BNPL relationships)
pnpm memory:reset                         # 0 relationships, 0 actions
pnpm memory:export                        # backup
```

`pnpm memory:seed` (default file) should print 2 relationships: **clean repeat** `0x1111…c1ea` (Approve, 4 installments, `used_onchain=false`) and **default in book** `0x2222…d00d` (Decline, `used_onchain=false`).

## Sibyl Memory

| Block | Stored? | Contents |
|---|---|---|
| USER_RELATIONSHIP | yes — Redis `sibyl:{tenant}:rel:{wallet}` (or local SQLite / `.data/sibyl-memory.json`) | purchases, installment schedule, quotes, overrides, merchant labels, payout hashes. Standing and limit are **stripped** before write and recomputed on read. |
| ONCHAIN_SIGNAL | **never** | age, tx count, fetched per quote, used only if `total_purchases == 0` |
| standing / `current_limit` | **computed** | `standingFromHistory` / `limitFromStanding` on every read |
| AGENT_REPUTATION / COUNTERPARTY_PROFILE | leftover treasury only | Still produced by `/alex`, `pnpm mcp`, and `GET /api/memory`’s treasury fields. **Not** what BNPL terms use. |

If Sibyl / Redis is down, `POST /api/purchase`, `POST /api/repay`, `GET /api/health`, and `GET /api/agent-status` return **503**. The landing page shows the error on Alex’s cash.

Laptop: [`sibyl-memory-client`](https://github.com/Sibyl-Labs/Sibyl-Memory) via `sibyl/bridge.py` when `.venv/bin/python` exists. Vercel: same ops in `lib/memory/engine.ts` on Redis (per-wallet keys, no TTL). See `docs/sibyl-parity.md`.

## Env

See `.env.example`. BNPL-relevant:

| Variable | Role |
|---|---|
| `AGENT_PRIVATE_KEY` | Agent signer. From `pnpm wallet:create`. Never commit. |
| `AGENT_ADDRESS` | Public agent address if the private key is unset (stats still work from `config/agent-wallet.json`). |
| `BASE_EXECUTE` | Must be `1` to broadcast ETH payouts. Otherwise Sibyl-only / simulated. |
| `BASE_CHAIN_ID` | `84532` Base Sepolia |
| `BASE_RPC_URL` / `SEPOLIA_RPC_URL` | RPC |
| `MAX_PURCHASE_AMOUNT` | Hard purchase cap (default 10000). Unlocked at score 95. |
| `MAX_ACTIVE_PLANS` | Concurrent plans (default 2) |
| `MIN_AGENT_RESERVE` | Solvency floor in USDC-equivalent (default 5) |
| `ETH_USD` | USDC display → ETH settlement rate (default 2000) |
| `AGENT_SIMULATED_USDC` | Fallback spendable when the agent key/balance cannot be read (default 100) |
| `XAI_API_KEY` | Optional. Alex still quotes without it. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel Redis. Required in production. |
| `SIBYL_PYTHON` / `SIBYL_MEMORY_DB` / `SIBYL_TENANT` | Local Python Sibyl |

## API (BNPL)

- `POST /api/purchase` — `{ wallet, amount, merchant? }` quotes (Desk preview uses `persist: false`); `{ accept: true }` originates a plan
- `POST /api/repay` — `{ wallet, purchase_id, tx_hash }` records the next installment after verifying ETH to Alex. `{ pay_remaining: true }` pays all pending. `{ mark_default: true }` is attested, not an on-chain repay.
- `GET /api/relationship/:wallet` — relationship + computed standing/limit; on-chain only if the book is empty
- `GET /api/agent-status` — agent cash, reserve, deployable, `execute`; **503** if Sibyl/Redis is down
- `GET /api/health` — store ping; **503** if unreachable
- `GET /api/log` — public quotes + purchases
- `GET /api/memory` — relationships (plus leftover treasury fields if present)

Leftover treasury/lending routes still compile (`POST /api/decide`, `/api/quote`, `/api/borrow`, `/api/supply`). They are not the product.

## Scripts (`package.json`)

```bash
pnpm dev              # next dev --port 3002
pnpm build && pnpm start
pnpm test             # lib/**/*.test.ts and sibyl/bridge.test.ts
pnpm wallet:create
pnpm memory:seed | memory:reset | memory:export
pnpm sibyl:health     # Python bridge ping
pnpm mcp              # leftover treasury MCP (alex_decide / alex_memory / alex_log / alex_resolve)
```

## License

MIT. See [LICENSE](./LICENSE).
