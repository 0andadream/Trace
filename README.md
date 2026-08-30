# TRACE

Reputation-weighted BNPL that remembers you.

**TRACE** is the product. **Alex** is TRACE’s autonomous BNPL agent. **Sibyl** is the memory that stores this wallet’s purchases and repayments. **Base Sepolia** is settlement.

[Live](https://trace-26xx.vercel.app/) · [Demo](https://trace-26xx.vercel.app/demo) · [Alex on Virtuals](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp) · Agent [`0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e`](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e)

```
Alex          registered Virtuals ACP identity
Sibyl         persistent memory
TRACE         BNPL / risk decision
Base Sepolia  testnet settlement
```

## Memory implementation

Sibyl stores `USER_RELATIONSHIP` per wallet: purchases, installment schedules, outcomes (`on_time` / `late` / `defaulted`), quotes, overrides, and a compact `snapshot` (`last_outcome`, `open_plans`, `standing`, `trust_note`). ONCHAIN_SIGNAL (wallet age, tx count) is fetched fresh and never written.

A purchase is written after TRACE originates a plan. A repayment is written only after ETH to the agent is verified on Base Sepolia (`lib/bnpl/verifyUserRepay.ts`). Standing and limit are not trusted as stored fields. They are recomputed on every read by `standingFromHistory` / `limitFromStanding`.

`selectPolicyInputs` (`lib/bnpl/policy.ts`): empty book → terms = f(ONCHAIN_SIGNAL) $12 / $20 / $24. Any purchase on file → ONCHAIN_SIGNAL is dropped. One completed on-time $12 lifts the next limit into about $40–$80, then later clean plans step toward $3k at score 50 and $10k at 95. A late completion changes limit, installment count, and interest. Any default → $8 then Decline.

Delete (`pnpm memory:reset` or History → Delete Sibyl memory) removes that wallet’s book. The chain is unchanged. The same address looks new again.

Pointers: policy [`lib/bnpl/policy.ts`](./lib/bnpl/policy.ts), engine [`lib/memory/engine.ts`](./lib/memory/engine.ts), store [`lib/bnpl/store.ts`](./lib/bnpl/store.ts), settlement [`lib/base/send.ts`](./lib/base/send.ts). The LLM only writes reasoning.

Connect a wallet (that address is login). On Approve, TRACE sends **ETH** to the connected wallet when `BASE_EXECUTE=1`. Amounts on screen are USDC-equivalent. You repay by signing ETH back to the agent.

Testnet only. No real goods or loans. MIT.

## Core principle

`lib/bnpl/policy.ts` → `selectPolicyInputs()`:

- `total_purchases == 0` → terms = f(ONCHAIN_SIGNAL)
- `total_purchases > 0` → on-chain is dropped and never used

## Routes

| URL | What |
|---|---|
| `/` | Landing, live policy numbers |
| `/buy` | Buy with TRACE, quote, confirm, repay |
| `/demo` | Judge walkthrough, five steps, same wallet |
| `/history` | This wallet’s book |
| `/log` | Public agent log (includes seeded clean vs defaulted books) |
| `/docs` | Docs |
| `/privacy` · `/terms` | Legal |

## Use it

```bash
pnpm dev                 # http://localhost:3002
```

1. Connect a wallet on Base Sepolia.
2. Pick Notebook `$12` (default), or another Test Shop item, or a custom amount. First-time band is `$12` / `$20` / `$24`.
3. Pay today or pay with TRACE.
4. Confirm. Live payouts need `BASE_EXECUTE=1` and a funded agent.
5. Repay from `/buy` or `/history`. The API writes Sibyl only after it verifies ETH to the agent.

| Decision | What happens |
|---|---|
| Approve | Quoted plan. ETH sent if execute is on, else simulated. |
| Approve with reduced limit | Origination uses the reduced size. |
| Decline | Default, standing too low, no available limit, or agent insolvency. |
| Ceiling blocked | Over `MAX_PURCHASE_AMOUNT` or `MAX_ACTIVE_PLANS`. Scoring skipped. |

## Policy

`lib/bnpl/policy.ts`. Ceilings in `lib/bnpl/ceiling.ts` and `lib/bnpl/solvency.ts`.

| Book | Limit | Installments |
|---|---|---|
| Empty + thin chain (age &lt; 7d or &lt; 3 txs) | $12 | 1 |
| Empty + moderate | $20 | 2 |
| Empty + established | $24 | 2 |
| One clean $12 | ~$40–$80 | 4 |
| Later clean plans | toward $3k at score 50, $10k at 95 | 4 |
| Any default | $8 then Decline | 0 |
| Late, no default | lower limit, 2 payments, higher interest | 2 |
| Open plan | standing capped at 0.38, available = gross − outstanding | unchanged |

Defaults: `MAX_PURCHASE_AMOUNT=10000`, `MAX_ACTIVE_PLANS=2`, `MIN_AGENT_RESERVE=5`.

## Load-bearing test

Same wallet the whole way. Amount **12**. Base Sepolia ETH required to repay. Or click through [`/demo`](https://trace-26xx.vercel.app/demo).

```bash
pnpm memory:reset
pnpm dev
```

**a. New wallet.** `/buy` or `/demo` → Notebook $12 → Confirm. Empty relationship, `ONCHAIN_SIGNAL`, limit $12 / $20 / $24. No “Sibyl Memory found”.

**b. Repay on time.** Pay remaining until `completed_on_time`. No verified ETH, no repay.

**c. Second purchase.** Same $12. Sibyl Memory found. Limit in the $40–$80 band. 4 installments. `ONCHAIN_SIGNAL not used`.

**d. Delete memory.** `pnpm memory:reset` (or History / `/demo` step 5 → Delete Sibyl memory). Same wallet, same chain, first-time terms again.

**e. Solvency (optional).** `MIN_AGENT_RESERVE=10000 pnpm dev` → Decline that ignores the user.

## Setup

Node 20, pnpm. Local Sibyl: Python 3.10+ and `.venv`. Production: Redis on Vercel (`KV_REST_API_URL` / `KV_REST_API_TOKEN`).

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
pnpm install
cp .env.example .env.local
pnpm test
pnpm wallet:create
pnpm dev
```

Fund the printed agent with Base Sepolia ETH. `BASE_EXECUTE=1` to broadcast.

```bash
pnpm memory:seed | memory:reset | memory:export
```

## Partners

| Partner | Role |
|---|---|
| [Sibyl](https://github.com/Sibyl-Labs/Sibyl-Memory) | Persistent financial memory |
| [Virtuals](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp) | Alex’s registered ACP identity (`01a05400-aea9-7f70-a67e-f558448e86e3`) |
| Base | Sepolia settlement (ETH payout / repay) |

Sibyl remembered X → Alex requested Y → Base settled Z. Virtuals does not choose the limit and does not move user funds.

## Verify

| What | Where |
|---|---|
| Credit decision | [`lib/bnpl/policy.ts`](./lib/bnpl/policy.ts) `selectPolicyInputs` / `computeApproval` |
| Memory write | [`lib/memory/engine.ts`](./lib/memory/engine.ts) `upsert_relationship` |
| Memory read | [`lib/bnpl/store.ts`](./lib/bnpl/store.ts) `getRelationship` |
| Settlement | [`lib/base/send.ts`](./lib/base/send.ts) `sendMerchantPayout` |
| Alex on Virtuals | [agent page](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp) |
| Judge path | [`/demo`](https://trace-26xx.vercel.app/demo) · [`docs/DEMO.md`](./docs/DEMO.md) |

## Prior work

Pre-existing: TRACE UI, Alex, Sibyl `USER_RELATIONSHIP`, deterministic credit, Base Sepolia payout/repay.

This hackathon: Virtuals agent identity in the decision trace, first-repeat cliff, `/demo` load-bearing path, deletion test.

Sibyl was already load-bearing. Virtuals is identity, not a second credit engine.

## License

MIT. See [LICENSE](./LICENSE).
