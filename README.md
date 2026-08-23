# Trace

Trace is the persistent reputation layer. Alex is the BNPL agent that uses it.

Users connect a wallet and request a purchase in installments. **Alex’s own memory of plans it approved for that wallet** sets the limit and plan length. On-chain wallet history is a conservative baseline for wallets the agent has never checked out. Delete Sibyl and Alex forgets; the chain still looks the same.

```
REQUEST → CEILING → SOLVENCY → USER_RELATIONSHIP? → APPROVAL_POLICY → PAY MERCHANT → RECORD
              │          │              │ no purchases
              │          │              ▼
              │          │        ONCHAIN_SIGNAL (fresh, not stored)
              │          ▼
              │     MIN_AGENT_RESERVE vs wallet + outstanding exposure
              ▼
        MAX_PURCHASE_AMOUNT / MAX_ACTIVE_PLANS
```

On **Approve**, the agent **fronts capital**: it sends **ETH** from `AGENT_PRIVATE_KEY` to the **connected user wallet** on Base Sepolia (`BASE_EXECUTE=1`). Amounts in the UI are **USDC**. **Repay is live:** the user signs an **ETH** transfer back to Alex for the USDC-equivalent. The installment is recorded in Sibyl only after that transfer is verified on-chain.

Memory is **load-bearing** — the [Sibyl Labs Hackathon](https://hack.sibyllabs.org/) gate.

Base Sepolia (84532). USDC: [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e). Agent: [`0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e`](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e).

## Core principle (enforced in code)

`lib/bnpl/policy.ts` → `selectPolicyInputs()`:

- `USER_RELATIONSHIP.total_purchases == 0` → terms = f(ONCHAIN_SIGNAL) (short plan, low limit)
- `total_purchases > 0` → **on-chain is set to `null`** and never enters the terms function

What Sibyl stores **cannot** be reconstructed from the chain:

- Purchases this agent approved for this wallet
- Installment outcomes on **those** plans (`on_time` / `late` / `defaulted`)
- Human overrides of this agent’s approve/decline
- This agent’s prior quotes and reasoning

On-chain age / tx count is fetched fresh, never cached as memory, and is unused once a purchase history exists. Tests in `lib/bnpl/policy.test.ts` lock this.

The LLM only writes reasoning from those same inputs. Decision, limit, installment count, and due dates are computed in code and re-applied even if the model lies.

Standing is also computed in code (`standingFromHistory` in `lib/bnpl/relationship.ts`), not by Sibyl or Grok. Sibyl stores the book; TypeScript turns it into a score. An open plan does not raise standing above the on-chain cap (0.38). Each **completed** on-time plan adds 0.005 to standing (displayed score is standing × 100, so the ring moves about 1 point every 1–2 finishes). Purchase limit is computed separately and still rises with on-time completions. Due dates are 7–14 days out, so a repay made immediately is `on_time`.

## Load-bearing test (run this live, under 2 minutes)

Needs the app running (`pnpm dev` → http://localhost:3002). Use a wallet that is **not** in the seed file. Same wallet every step. Amount stays at **12**.

### 0. Reset, then run the app

```bash
pnpm memory:reset
pnpm dev                  # http://localhost:3002
```

Confirm reset printed `Relationships: 0`.

### a. New wallet → on-chain baseline (~20s)

1. Open http://localhost:3002/buy
2. **Connect wallet**
3. Merchant `Test Shop`, amount `12` → **Request Purchase**

Expect:

- Decision: **Approve** (or reduced limit if the wallet is brand-new and thin)
- Reasoning **must** say `USER_RELATIONSHIP is empty. No purchase history exists.`
- Primary **ONCHAIN_SIGNAL**
- Short plan: **1** installment (thin) or **2** (moderate/established)
- Limit in the **12–24** band

### b. Accept (agent fronts the merchant) and repay on time (~30s)

1. **Request Purchase** originates the plan when terms are Approve
   - If `BASE_EXECUTE=1` and the agent key has USDC: on-chain payout to the merchant, `payout_tx_hash` stored
   - Otherwise: approval is real in Sibyl, payout is labeled **simulated**
2. **Repay** on `/buy` (open plans) or `/history` — confirm an **ETH** transfer in the connected wallet to Alex (value shown as USDC). Repeat until `completed_on_time`.

The API records the installment only after it verifies a native ETH transfer (from your wallet, to Alex, USDC-equivalent at `ETH_USD`) on Base Sepolia. No signature means no repay.

Due dates are 7–14 days out, so paying now is `on_time`.

### c. Same wallet, second quote → memory-improved terms (~20s)

Amount `12` again → **Request Purchase**.

Expect:

- **Limit visibly higher** (often ~60 vs 12–24)
- **More installments** (3 or 4 vs 1–2)
- Reasoning cites **that specific purchase / repayment**, not wallet age or tx count
- Line that **ONCHAIN_SIGNAL not used**

### d. Reset memory → back to on-chain baseline (~20s)

```bash
pnpm memory:reset
```

Same wallet, same **12** quote, **without** seeding.

Expect:

- `No purchase history exists.` again
- Limit and installment count back to the step-a baseline
- The improved terms are gone even though the wallet’s on-chain history is unchanged

That is the load-bearing proof: the longer plan lived in Sibyl, not on Base.

### e. Agent solvency — decline that ignores the wallet (~20s)

This beat is **not about the user**. Use any wallet that would otherwise Approve.

Stop the dev server, then:

```bash
MIN_AGENT_RESERVE=10000 pnpm dev
```

On `/buy`, amount `12` → **Request Purchase**.

Expect:

- Decision: **Decline**
- Terms: `insolvent_declined`
- Reasoning says **MIN_AGENT_RESERVE** and **User reputation was not used**

Restore normal reserve (`5`) and restart `pnpm dev`.

Same wallet at reserve 5 is Approve again — proving the refusal was the agent’s own capital, not that wallet’s book.

### Optional: seeded contrast (no private keys)

```bash
pnpm memory:reset
pnpm memory:seed          # seeds/bnpl-demo-seed.json
```

| Wallet | Book | Quote for 12 at Test Shop |
|---|---|---|
| `0x111111111111111111111111111111111111c1ea` | 3 on-time purchases | **Approve**, high limit, **4** installments, relationship primary |
| `0x222222222222222222222222222222222222d00d` | 2 on-time + **1 default** (higher volume) | **Decline**, relationship primary |

A third wallet (yours, or any unlisted `0x`) is the on-chain-only baseline: **No purchase history exists**, short plan (1–2 installments), limit 12–24.

Amount **81+** is **Ceiling blocked**. Two active plans is **Ceiling blocked** (`MAX_ACTIVE_PLANS`).

## Architecture

Trace (`lib/trace`, `lib/memory`, `lib/bnpl`) is the reusable layer: purchase log, standing, approval policy, ceilings.

Alex (`/buy`, `lib/bnpl/run.ts`, `lib/base`) is the consumer: user wallet connect for identity **and** on-chain repay; agent key for merchant payout; Grok-written reasoning that cannot change the numbers.

Treasury Alex remains at `/alex` as a second consumer of the same store.

## Use Alex

```bash
pnpm dev                 # http://localhost:3002
```

| URL | What |
|---|---|
| `/` | Landing (how it works, live vs not live, agent cash) |
| `/buy` | Request a purchase; repay open plans |
| `/history` | Purchases this agent originated; repay |
| `/log` | Public agent log: quotes and purchases across wallets |
| `/docs` | Short docs |
| `/alex` | Legacy treasury desk |

On `/buy`:

1. Connect (end-user wallet)
2. Amount + merchant → **Request Purchase** (quotes and originates on Approve)
3. **Repay** — confirm ETH to Alex in the wallet (amount shown in USDC); the last installment sets `completed_on_time` / `completed_late`

```
Decision: Approve

Reasoning:
- …
- …

Terms: limit 20 · 2 installments · due 2026-04-05, 2026-04-19
```

| Decision | What happens |
|---|---|
| **Approve** | Quoted limit + installment count + due dates. Agent sends ETH to the user’s wallet (`on_chain` or **simulated**). |
| **Approve with reduced limit** | Amount exceeds available limit (standing or outstanding). Origination uses the reduced size. |
| **Decline** | Default (or standing &lt; 0.18) in this agent’s book, or agent insolvency. |
| **Ceiling blocked** | Amount &gt; `MAX_PURCHASE_AMOUNT`, or `MAX_ACTIVE_PLANS` already open. Scoring skipped. |

The agent signer (`AGENT_PRIVATE_KEY`) is **not** the user’s wallet. Users connect for identity, to receive the ETH payout, and to send repay ETH. If `BASE_EXECUTE=1`, origination sends ETH to that connected address.

## APPROVAL_POLICY

Deterministic, in `lib/bnpl/policy.ts`.

| Book | Limit (approx) | Installments | Notes |
|---|---|---|---|
| Empty + thin chain (age &lt; 7d or &lt; 3 txs) | 12 | 1 | Short plan / pay-in-one |
| Empty + moderate chain | 20 | 2 | Still worse than one on-time purchase |
| Empty + established chain | 24 | 2 | On-chain standing **capped at 0.38** |
| Clean repeat (this agent) | **$3k at score 50**, then → **$10k** at 95 | up to 4 | Scores 0–50 stay under $3k (50 = $3k). Score **95** unlocks the `$10k` ceiling. At repay, pay the next installment or the remaining balance. Trace interest is lower at higher standing. |
| Any default in this agent’s book | cut hard | 0 | Standing **capped at 0.12** → Decline |
| Active unpaid plan | limit − outstanding | unchanged | Cannot overextend an open plan |

A single default is asymmetric: volume does not save you. That is why the penalized seed wallet (74 purchased, one default) is declined while a smaller clean book is approved at 4 installments.

`MAX_PURCHASE_AMOUNT` (default **10000**, unlocked at standing 0.95 / score 95) and `MAX_ACTIVE_PLANS` (default **2**) are checked **before** scoring. The LLM cannot undercut them. Working limit is gated by score: **$3k at 50**, lower below that, then up to $10k at 95.

## Setup

Python 3.10+ (3.12 recommended) and Node 20+ **on your laptop**. Vercel’s Node runtime cannot spawn `.venv/bin/python`. There the same Sibyl ops run in Node. **Create a Redis store on the Vercel project** so every visitor shares one durable book:

1. Vercel dashboard → the Trace project → **Storage** → **Create Database** → **Redis** (Upstash)
2. Connect it to Production (and Preview if you want)
3. Redeploy. Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or the Upstash `UPSTASH_REDIS_REST_*` pair)

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

Fund the printed agent address on **Base Sepolia** with ETH (gas) and **USDC** if you want merchant payouts to broadcast. End users **Connect wallet** on `/buy`. That address is the relationship key. It is not the agent key.

Circle testnet USDC: [faucet.circle.com](https://faucet.circle.com/) (Base Sepolia).

## Memory seed and reset

Local CLI only. **Not** exposed as HTTP routes.

```bash
pnpm memory:seed                          # seeds/bnpl-demo-seed.json
pnpm memory:seed seeds/demo-seed.json     # optional: legacy treasury seed
pnpm memory:reset                         # 0 relationships, 0 actions
```

`pnpm memory:seed` should print:

- 2 relationships
- **clean repeat** `0x1111…c1ea` — 3 on_time, Approve, 4 installments, `used_onchain=false`
- **default in book** `0x2222…d00d` — 1 default, Decline, `used_onchain=false`

Load-bearing check: steps **a–d** above.

## Policy

| USER_RELATIONSHIP | Terms driver |
|---|---|
| `total_purchases == 0` | ONCHAIN_SIGNAL (fresh) |
| `total_purchases > 0` | Relationship only (on-chain dropped in `selectPolicyInputs`) |

Code maps the quote. Grok (optional `XAI_API_KEY`) only writes reasoning. The model cannot change `decision`, limit, installment count, or due dates.

## Sibyl Memory

| Block | Stored? | Contents |
|---|---|---|
| USER_RELATIONSHIP | WARM `relationship/<wallet>` | purchases, installment schedule, quotes, overrides |
| ONCHAIN_SIGNAL | **never** | age, tx count, fetched per quote, used only if `total_purchases == 0` |
| standing / current_limit | **computed** | recomputed from the purchase book on every read |

If Sibyl is down, `POST /api/purchase` and `POST /api/repay` return **503**.

Engine: [`sibyl-memory-client`](https://github.com/Sibyl-Labs/Sibyl-Memory) · local SQLite + FTS5 · no vector DB.

## Env

See `.env.example`. Important:

| Variable | Role |
|---|---|
| `AGENT_PRIVATE_KEY` | Agent signer. From `pnpm wallet:create`. |
| `BASE_EXECUTE` | `1` to broadcast merchant payout; otherwise Sibyl only |
| `BASE_CHAIN_ID` | `84532` Base Sepolia |
| `MAX_PURCHASE_AMOUNT` | Hard purchase cap (default 10000). Unlocked at score 95. |
| `MAX_ACTIVE_PLANS` | Hard cap on concurrent plans (default 2) |
| `MIN_AGENT_RESERVE` | Agent cannot front a payout that leaves cash below this (default 5) |
| `AGENT_SIMULATED_USDC` | Fallback spendable when the agent key/balance cannot be read |
| `ETH_USD` | USDC display → ETH settlement rate (default 2000) |
| `XAI_API_KEY` | Optional. Alex still quotes without it. |

## API

- `POST /api/purchase` — `{ wallet, amount, merchant? }` quotes terms; `{ accept: true }` originates a plan
- `POST /api/repay` — `{ wallet, purchase_id, tx_hash }` records the next installment after verifying the ETH transfer to Alex. `{ mark_default: true }` still attested.
- `GET /api/relationship/:wallet` — relationship + computed standing/limit; on-chain only if the book is empty
- `GET /api/agent-status` — agent cash, reserve, deployable, execute flag
- `GET /api/memory` · `GET /api/log` — public agent log (quotes + purchases)
- `POST /api/decide` — legacy treasury

## MCP

```bash
pnpm mcp
```

Tools: `alex_decide` · `alex_memory` · `alex_log` · `alex_resolve`

## License

MIT. See [LICENSE](./LICENSE).
