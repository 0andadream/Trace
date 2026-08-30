# TRACE

Reputation-weighted BNPL that remembers you.

**TRACE** is the product. **Alex** is TRACE’s autonomous BNPL agent. **Sibyl** is the memory that stores this wallet’s purchases and repayments. **Base Sepolia** is settlement.

[Live](https://trace-26xx.vercel.app/) · [Alex on Virtuals](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp) · Agent [`0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e`](https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e)

```
Alex          registered Virtuals ACP identity
Sibyl         persistent memory
TRACE         BNPL / risk decision
Base Sepolia  testnet settlement
```

Connect a wallet (that address is login). TRACE loads `USER_RELATIONSHIP` from Sibyl. Empty book → conservative on-chain baseline (age + tx count, fetched fresh, never stored). Otherwise terms come only from this agent’s book.

On Approve, TRACE sends **ETH** to the connected wallet when `BASE_EXECUTE=1`. Amounts on screen are USDC-equivalent. You repay by signing ETH back to the agent. Sibyl records the installment only after that transfer is verified.

Pay on time, the next offer can get better. Delete Sibyl and the same wallet looks new again. The chain is unchanged. That is the [Sibyl Labs](https://hack.sibyllabs.org/) load-bearing gate.

Testnet only. No real goods or loans.

## Core principle

`lib/bnpl/policy.ts` → `selectPolicyInputs()`:

- `total_purchases == 0` → terms = f(ONCHAIN_SIGNAL)
- `total_purchases > 0` → on-chain is dropped and never used

Sibyl stores purchases, schedules, outcomes (`on_time` / `late` / `defaulted`), quotes, overrides. Standing and limit are computed in TypeScript (`standingFromHistory` / `limitFromStanding`). Displayed score is standing × 100.

The LLM (`XAI_API_KEY`, optional) only writes reasoning. Numbers are code.

## Routes

| URL | What |
|---|---|
| `/` | Landing |
| `/buy` | Buy with TRACE, quote, confirm, repay |
| `/history` | This wallet’s book |
| `/log` | Public agent log |
| `/docs` | Docs |
| `/demo` | Judge walkthrough |
| `/privacy` · `/terms` | Legal |

## Use it

```bash
pnpm dev                 # http://localhost:3002
```

1. Connect a wallet on Base Sepolia.
2. Pick Notebook `$12`, Lamp `$40`, Headphones `$150`, or a custom amount.
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
| Clean repeat | ~$3k at score 50, $10k at 95 | 4 |
| Any default | $8 then Decline | 0 |
| Late, no default | worse than clean | 2 |
| Open plan | gross − outstanding | unchanged |

After one completed on-time $12, gross limit is about **$2,358**, not the $12–24 first-time band. The homepage $75 walkthrough is demo copy, not live policy.

Defaults: `MAX_PURCHASE_AMOUNT=10000`, `MAX_ACTIVE_PLANS=2`, `MIN_AGENT_RESERVE=5`.

## Load-bearing test

Same wallet the whole way. Amount **12**. Base Sepolia ETH required to repay.

```bash
pnpm memory:reset
pnpm dev
```

**a. New wallet.** `/buy` → Notebook $12 → Confirm. Empty relationship, `ONCHAIN_SIGNAL`, limit $12 / $20 / $24. No “Sibyl Memory found”.

**b. Repay on time.** Pay next until `completed_on_time`. No verified ETH, no repay.

**c. Second purchase.** Same $12. Sibyl Memory found. Limit jumps (about $2,358). 4 installments. `ONCHAIN_SIGNAL not used`.

**d. Delete memory.** `pnpm memory:reset` (or History → Delete Sibyl memory). Same wallet, same chain, first-time terms again.

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

Sibyl remembers. TRACE decides. Virtuals identifies Alex. Base settles. Virtuals does not choose the limit and does not move user funds.

## Verify

| What | Where |
|---|---|
| Credit decision | [`lib/bnpl/policy.ts`](./lib/bnpl/policy.ts) `selectPolicyInputs` / `computeApproval` |
| Memory write | [`lib/memory/engine.ts`](./lib/memory/engine.ts) `upsert_relationship` |
| Memory read | [`lib/bnpl/store.ts`](./lib/bnpl/store.ts) `getRelationship` |
| Settlement | [`lib/base/send.ts`](./lib/base/send.ts) `sendMerchantPayout` |
| Alex on Virtuals | [agent page](https://app.virtuals.io/acp/agents/01a05400-aea9-7f70-a67e-f558448e86e3?tab=acp) |

## Prior work

Pre-existing: TRACE UI, Alex, Sibyl `USER_RELATIONSHIP`, deterministic credit, Base Sepolia payout/repay.

This hackathon: Virtuals agent identity on the product, Agent infrastructure panel, deletion test, `/demo`.

Sibyl was already load-bearing. Virtuals is identity, not a second credit engine.

## License

MIT. See [LICENSE](./LICENSE).
