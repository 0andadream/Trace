# TRACE

Reputation-weighted BNPL that remembers you. Powered by [Sibyl Memory](https://github.com/Sibyl-Labs/Sibyl-Memory).

**TRACE** is the product. **Alex** is TRACE’s autonomous BNPL agent. **Sibyl** is the persistent memory that lets Alex remember this wallet’s purchases and repayments across sessions.

You connect a wallet (that address is your login). You pick a purchase. TRACE looks up **USER_RELATIONSHIP** for that wallet — purchases it approved here, and whether those were repaid on time, late, or missed. If the book is empty, it uses a conservative on-chain baseline (wallet age and tx count, fetched fresh, never stored). Then it says yes or no.

On **Approve**, TRACE finances the purchase: native **ETH** to **your connected wallet** when `BASE_EXECUTE=1` (this is on at [trace-26xx.vercel.app](https://trace-26xx.vercel.app/)). Amounts on screen are **USDC-equivalent**. You repay by signing an **ETH** transfer back to the agent. The installment is written to Sibyl only after that transfer is verified on-chain.

Pay on time and the next limit and plan can get better. Miss a payment and it gets harder, fast. Delete Sibyl and TRACE starts from zero; the chain still looks the same. That is the [Sibyl Labs Hackathon](https://hack.sibyllabs.org/) load-bearing gate.

```
USER → ALEX → SIBYL MEMORY → CREDIT DECISION → VIRTUALS / ACP → BASE SEPOLIA SETTLEMENT
```

Sibyl determines what Alex remembers. TRACE determines the credit decision. Virtuals enables Alex to execute the agent job. Base settles the transaction.

```
WALLET HISTORY → SIBYL MEMORY → TRACE REPUTATION → ELIGIBILITY
        → PURCHASE → ACP JOB → REPAY → SIBYL UPDATED → NEXT OFFER
```

Live: [https://trace-26xx.vercel.app/](https://trace-26xx.vercel.app/) · Base Sepolia (`84532`) · Agent [`0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e`](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e).

Testnet only — no real goods or loans. Merchant names are labels. Settlement is ETH to/from the connected wallet.

## Core principle (enforced in code)

`lib/bnpl/policy.ts` → `selectPolicyInputs()`:

- `USER_RELATIONSHIP.total_purchases == 0` → terms = f(ONCHAIN_SIGNAL)
- `total_purchases > 0` → on-chain is set to `null` and never enters the terms function

What Sibyl stores **cannot** be reconstructed from the chain:

- Purchases this agent approved for this wallet
- Installment outcomes on **those** plans (`on_time` / `late` / `defaulted`)
- Human overrides of this agent’s approve/decline
- This agent’s prior quotes and reasoning

Standing (shown as **TRACE reputation**) and limit are computed in TypeScript (`standingFromHistory` / `limitFromStanding` in `lib/bnpl/relationship.ts`), not by Sibyl or Grok. Sibyl stores the book; code turns it into a score. Displayed score is standing × 100.

- An **open** plan does not raise standing above the starter cap (`STARTER_STANDING` = 0.38, score 38).
- Each **completed on-time** plan adds 0.005 standing (~0.5 displayed points), plus a small repaid-share term.
- Limit: scores 0–50 stay under **$3k** (50 = $3k), then climb to **$10k** at standing 0.95 (`MAX_PURCHASE_AMOUNT`).
- One default caps standing at 0.12 and Declines, regardless of volume (`DEFAULT_LIMIT_CAP` = $8).
- Due dates are 7 days out for a 1-payment plan, otherwise 14 days apart, so a repay made now is `on_time`.

The LLM (`XAI_API_KEY`, optional) only writes reasoning. Decision, limit, installment count, interest, and due dates are computed in code and re-applied even if the model lies.

## Routes

Live nav (`components/AppShell.tsx`):

| URL | What |
|---|---|
| `/` | Landing: hero, How it works (one heading), Sibyl memory sections, **Under the hood** |
| `/buy` | **Buy with TRACE** — purchase → pay today or pay with TRACE → why you’re eligible → confirm. Repay open plans. Reputation + **Sibyl Memory found** only when a real relationship was loaded. |
| `/history` | **My History** — private to the connected wallet. Timeline, reputation breakdown, repay. |
| `/log` | **Agent Log** — public quotes and purchases, explorer links on real payouts |
| `/docs` | Product docs |
| `/demo` | Judge path: Sibyl recall, ACP job, Base settlement, deletion test |
| `/privacy` · `/terms` | Legal |

Redirects: `/lend` → `/buy`, `/memory` → `/history`, `/agent-log` → `/log`, `/developers` → `/`, `/desk` → `/alex`.

`/alex` is leftover treasury (Proceed / Hold). Not in the live nav.

## Use TRACE

Needs Node 20, pnpm, and (for local Sibyl) Python 3.10+ with the venv below. Dev server is **port 3002**.

```bash
pnpm dev                 # http://localhost:3002
```

On `/buy`:

1. **Connect wallet** (MetaMask, Rabby, or Coinbase Wallet on Base Sepolia). That address is the relationship key. It is not `AGENT_PRIVATE_KEY`.
2. **Purchase** — pick Notebook Set `$12`, Desk Lamp `$40`, Wireless Headphones `$150`, or a custom amount. Merchant is **Test Shop** (a label).
3. **How you’ll pay** — **Pay today** (one payment of principal + TRACE interest) or **Pay with TRACE** (the quoted installment count). Schedule, first payment, total repayment, and available / purchase / remaining are from the live quote.
4. **Why you’re eligible** — Decision, Sibyl-grounded reasoning, terms, reputation breakdown, timeline. Not hidden.
5. **Confirm purchase** — originates the plan when the decision is Approve / Approve with reduced limit.
6. If `BASE_EXECUTE=1` and the agent key can broadcast: payout is **on_chain** with a Base Sepolia explorer link (**Purchase financed**). Otherwise the approval is still stored and labeled simulated.
7. **Upcoming payments** on `/buy` or `/history`: **Pay next** or **Pay remaining**. Confirm the transfer in your wallet. The API records the installment only after it verifies ETH to the agent.

If Sibyl actually returned a relationship with purchases, the UI shows **Sibyl Memory found**. **Previous repayment: On time** / **Late** only appears when a paid installment exists. The homepage first-time / returning toggle is a walkthrough, not live Sibyl.

| Decision | What happens |
|---|---|
| **Approve** | Quoted limit + installment count + due dates. TRACE finances the purchase (`on_chain` with a tx hash, or **simulated**). |
| **Approve with reduced limit** | Amount exceeds available limit. Origination uses the reduced size. |
| **Decline** | Default (or standing &lt; `DECLINE_STANDING` 0.18) in this agent’s book, available limit 0, or agent insolvency. |
| **Ceiling blocked** | Amount &gt; `MAX_PURCHASE_AMOUNT`, or `MAX_ACTIVE_PLANS` already open. Scoring skipped. |

The agent signer (`AGENT_PRIVATE_KEY`) finances the purchase. You connect to identify yourself, receive the ETH, and send repay ETH.

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

TRACE interest is higher when standing is lower (floor 2%, ceiling 26%). You can pay the next installment or the remaining balance at repay time.

Hard caps (defaults):

| Variable | Default | Role |
|---|---|---|
| `MAX_PURCHASE_AMOUNT` | `10000` | Hard purchase cap. Unlocked at score 95. |
| `MAX_ACTIVE_PLANS` | `2` | Concurrent open plans per book. |
| `MIN_AGENT_RESERVE` | `5` | Agent cannot approve a payout that would leave spendable cash below this (USDC-equivalent). |

`MAX_TX_AMOUNT_USDC` is still in `.env.example` and `lib/policy/ceiling.ts`. It applies to leftover `/alex` only. BNPL payouts skip it (`sendMerchantPayout` → `skipTreasuryCeiling`).

## Load-bearing test (run this live, under a few minutes)

Needs the app running (`pnpm dev` → http://localhost:3002). Use a wallet that is **not** in the seed file. Same wallet every step. Amount stays at **12** (Notebook Set, or custom). You need Base Sepolia ETH in that wallet to repay.

### 0. Reset, then run the app

```bash
pnpm memory:reset
pnpm dev                  # http://localhost:3002
```

Confirm reset printed `Relationships:    0 (want 0)`.

### a. New wallet → on-chain baseline

1. Open http://localhost:3002/buy
2. **Connect wallet**
3. Purchase **Notebook Set** `$12` (Test Shop) → Pay with TRACE → Why you’re eligible → **Confirm purchase**

Expect:

- Decision: **Approve** (or **Approve with reduced limit** if the ask is above the on-chain band)
- Why-line about not having a relationship yet
- Reasoning / factors include `USER_RELATIONSHIP is empty. No purchase history exists.`
- Primary **ONCHAIN_SIGNAL**
- Short plan: **1** installment (thin) or **2** (moderate / established)
- Limit in the **$12 / $20 / $24** band
- No **Sibyl Memory found** (book is empty)
- If `BASE_EXECUTE=1` and the agent is funded: on-chain finance plus an explorer link. If not: simulated payout, plan still stored.

### b. Repay on time

On `/buy` (Upcoming payments) or `/history`: **Pay next** until the plan is `completed_on_time`. Confirm the transfer in the wallet.

The API (`POST /api/repay`) records the installment only after it verifies a native ETH transfer (from your wallet, to the agent, USDC-equivalent at `ETH_USD`) on Base Sepolia. No on-chain transfer means no repay.

Due dates are in the future, so paying now is `on_time`.

### c. Same wallet, second purchase → memory-improved terms

`$12` again → Confirm purchase.

Expect:

- **Sibyl Memory found**
- **Previous repayment: On time** (a paid installment exists)
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
- **Sibyl Memory found** gone
- The improved terms are gone even though the wallet’s on-chain history is unchanged

### e. Agent solvency — decline that ignores the wallet

This beat is **not about the user**. Use any wallet that would otherwise Approve.

Stop the dev server, then:

```bash
MIN_AGENT_RESERVE=10000 pnpm dev
```

On `/buy`, amount `12` → **Confirm purchase**.

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

1. Vercel dashboard → the TRACE project → **Storage** → **Create Database** → **Redis** (Upstash)
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

You do **not** need Circle testnet USDC for the current BNPL path.

End users **Connect wallet** on `/buy` and also need Base Sepolia ETH to repay.

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

If Sibyl / Redis is down, `POST /api/purchase`, `POST /api/repay`, `GET /api/health`, and `GET /api/agent-status` return **503**.

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
| `XAI_API_KEY` | Optional. TRACE still quotes without it. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel Redis. Required in production. |
| `SIBYL_PYTHON` / `SIBYL_MEMORY_DB` / `SIBYL_TENANT` | Local Python Sibyl |
| `VIRTUALS_ACP` | Set `0` to skip ACP jobs. Default: ACP broadcasts when `BASE_EXECUTE=1`. Never fakes a job id. |

## API (BNPL)

- `POST /api/purchase` — `{ wallet, amount, merchant? }` quotes (Buy preview uses `persist: false`); `{ accept: true }` originates a plan; `{ pay_in_full: true }` is one payment of principal + interest
- `POST /api/repay` — `{ wallet, purchase_id, tx_hash }` records the next installment after verifying ETH to the agent. `{ pay_remaining: true }` pays all pending. `{ mark_default: true }` is attested, not an on-chain repay.
- `GET /api/relationship/:wallet` — relationship + computed standing/limit; on-chain only if the book is empty
- `GET /api/agent-status` — agent cash, reserve, deployable, `execute`; **503** if Sibyl/Redis is down
- `GET /api/health` — store ping; **503** if unreachable
- `GET /api/log` — public quotes, purchases, and structured agent events (MEMORY_READ, CREDIT_DECISION, ACP_JOB_*, SETTLEMENT)
- `GET /api/virtuals` — ACP contract reachability + last real job; `?jobId=` reads `getJob` on-chain
- `DELETE /api/relationship/:wallet` — `{ confirm: true }` deletes **that wallet’s** Sibyl relationship (deletion test). Chain history is untouched.
- `GET /api/memory` — relationships (plus leftover treasury fields if present)
- `POST /api/pmf` — early-access waitlist row. Not a usage metric.

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

## Virtuals Protocol Integration

Alex is TRACE’s BNPL agent. TRACE registers that agent identity as the **client / provider / evaluator** on the Virtuals ACP v2 contract and uses ACP as the **autonomous execution** step after a deterministic credit decision.

Virtuals does **not** remember the user. Virtuals does **not** choose the credit amount. Sibyl Memory remains the persistent financial book. Base remains settlement.

Flow on Confirm purchase (`runAcceptPurchase`):

1. Sibyl `get_relationship` (memory read)
2. `computeApproval` in `lib/bnpl/policy.ts` (numbers)
3. ACP job `createJob` on Base Sepolia — offering **BNPL Settlement**, budget `0` (no user funds in ACP escrow)
4. `setBudget` / `fund` / `submit` / `complete` when the contract accepts a 0-budget self-eval
5. Existing Base ETH payout to the connected wallet
6. Later: user-signed repay → Sibyl write

If `BASE_EXECUTE` is off, or the agent key is missing, ACP is **skipped** with a real reason. The UI never marks a job completed unless `getJob` reports COMPLETED or `complete()` was mined.

Public job metadata (on-chain description + Sibyl `purchase.acp.metadata`) is only:

`product, agent, purpose, user (wallet), amount, memoryVerified, memoryProvider, creditLimit, decisionReason`

No private keys, API secrets, or personal data.

### Judge links (under two minutes)

Repo: [https://github.com/0andadream/Trace](https://github.com/0andadream/Trace) · Live: [https://trace-26xx.vercel.app/](https://trace-26xx.vercel.app/) · Demo path: [/demo](https://trace-26xx.vercel.app/demo)

| # | What | Where |
|---|---|---|
| 1 | Virtuals agent identity (Alex signer) | [`config/agent-wallet.json`](https://github.com/0andadream/Trace/blob/main/config/agent-wallet.json) · [`0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e`](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e) |
| 2 | ACP integration (official v2 contract) | [`lib/virtuals/acp.ts`](https://github.com/0andadream/Trace/blob/main/lib/virtuals/acp.ts) · contract [`0x0b93793923CD5De81850aF8604a233f3f24d461e`](https://sepolia.basescan.org/address/0x0b93793923CD5De81850aF8604a233f3f24d461e) (addresses from `@virtuals-protocol/acp-node-v2`) |
| 3 | ACP job creation | [`executeBnplSettlementJob`](https://github.com/0andadream/Trace/blob/main/lib/virtuals/acp.ts#L307) called from [`runAcceptPurchase`](https://github.com/0andadream/Trace/blob/main/lib/bnpl/run.ts#L126) |
| 4 | ACP job execution | same function: `setBudget` → `fund` → `submit` → `complete`; status `executed` only after on-chain COMPLETED |
| 5 | Base settlement | [`sendMerchantPayout`](https://github.com/0andadream/Trace/blob/main/lib/base/send.ts#L172) |
| 6 | Sibyl writeMemory | Node [`upsert_relationship`](https://github.com/0andadream/Trace/blob/main/lib/memory/engine.ts#L215) · Python [`persist_relationship`](https://github.com/0andadream/Trace/blob/main/sibyl/bridge.py#L129) |
| 7 | Sibyl readMemory | Node [`get_relationship`](https://github.com/0andadream/Trace/blob/main/lib/memory/engine.ts#L205) · [`getRelationship`](https://github.com/0andadream/Trace/blob/main/lib/bnpl/store.ts) |
| 8 | Deterministic credit decision | [`selectPolicyInputs`](https://github.com/0andadream/Trace/blob/main/lib/bnpl/policy.ts#L41) · [`computeApproval`](https://github.com/0andadream/Trace/blob/main/lib/bnpl/policy.ts#L389) |

Verify a live job: Agent Log → ACP_JOB_CREATED / EXECUTED, then `GET /api/virtuals?jobId=<id>` (reads `getJob` on the contract).

## Partner stack

| Partner | Role | Where used |
|---------|------|------------|
| Sibyl | Persistent financial memory | Credit history (`USER_RELATIONSHIP`) |
| Virtuals | Agent identity / ACP execution | BNPL Settlement job |
| Base | Onchain settlement | Loan payout / repayment |

Sibyl determines what Alex remembers. TRACE determines the credit decision. Virtuals enables Alex to execute the agent job. Base settles the transaction.

Sibyl Memory is mandatory for the hackathon gate and is **not** a multiplier. Base and Virtuals are claimed only because they do real work in the product loop (executed ETH tx; executed or created ACP job with an on-chain id).

## Prior Work

- **Pre-existing TRACE work:** product UI, Alex as BNPL agent, Sibyl-backed `USER_RELATIONSHIP`, deterministic `computeApproval` (on-chain baseline when the book is empty; relationship standing after that), Base Sepolia ETH payout/repay, Agent Log of quotes/purchases.
- **This Sibyl Labs hackathon pass:** Virtuals ACP v2 job on Confirm purchase; Agent Infrastructure panel; structured Agent Log (MEMORY_READ / CREDIT_DECISION / ACP / SETTLEMENT); single-wallet Sibyl deletion for the load-bearing test; `/demo`; waitlist form; this README section.
- **Third-party infrastructure:** [Sibyl Memory](https://github.com/Sibyl-Labs/Sibyl-Memory), Virtuals Protocol ACP v2 contracts, Base Sepolia.
- **Virtuals integration:** new. Not a logo. `createJob` is a contract call from the agent key.
- **Sibyl integration:** already load-bearing before this pass; not replaced and not moved into Virtuals.

Do not read the homepage How-it-works `$75 → $300` walkthrough as the live policy. Live first-time limits are the on-chain band **$12 / $20 / $24**; one on-time repayment in Sibyl lifts the book into relationship standing (about **$2,358** after a completed on-time $12). The deletion test still returns the same wallet to that first-time band.

## Build in public

Prepared posts (not published from this repo): [`docs/build-in-public.md`](./docs/build-in-public.md). They tag `@sibylcap` and `@virtuals_io`. They do not invent users or volume.

## License

MIT. See [LICENSE](./LICENSE).
