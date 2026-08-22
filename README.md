# Trace

Trace is the persistent reputation layer. Alex is the lending agent that uses it.

Users connect a wallet, supply collateral, and borrow. **Alex’s own memory of loans it originated with that wallet** sets the rate. On-chain wallet history is a conservative baseline for wallets the agent has never lent to. Delete Sibyl and Alex forgets — the chain still looks the same.

```
REQUEST → CEILING → USER_RELATIONSHIP? → RATE_POLICY → REASONING → RECORD
                         │ no loans
                         ▼
                   ONCHAIN_SIGNAL (fresh, not stored)
```

Memory is **load-bearing** — the [Sibyl Labs Hackathon](https://hack.sibyllabs.org/) gate.

## Core principle (enforced in code)

`lib/lending/rate.ts` → `selectRateInputs()`:

- `USER_RELATIONSHIP.total_loans == 0` → `base_rate = f(ONCHAIN_SIGNAL)` (conservative)
- `total_loans > 0` → **on-chain is set to `null`** and never enters the rate function

What Sibyl stores **cannot** be reconstructed from the chain:

- Loans this agent originated with this wallet
- Repayment outcomes on **those** loans (`on_time` / `late` / `defaulted`)
- Human overrides of this agent’s terms
- This agent’s prior quotes and reasoning

On-chain age / tx count is fetched fresh, never cached as memory, and is unused once a relationship exists. Tests in `lib/lending/rate.test.ts` lock this.

The LLM only writes reasoning from those same inputs. Decision, APR, collateral ratio, and Score are computed in code and re-applied even if the model lies.

## Demo in 90 seconds

Needs the app running (`pnpm dev` → http://localhost:3002).

```bash
pnpm memory:reset
pnpm memory:seed          # seeds/lending-demo-seed.json
```

Expect two relationships:

| Wallet | Book | Quote for 8 USDC |
|---|---|---|
| `0x111111111111111111111111111111111111c1ea` | 4 on-time loans | **Approve**, ~6% APR, relationship primary |
| `0x222222222222222222222222222222222222d00d` | 2 on-time + **1 default** (higher volume) | **Decline**, ~33% APR, relationship primary |

A third wallet (yours, or any unlisted `0x`) is the on-chain-only baseline: **USER_RELATIONSHIP is empty**, ~16–24% APR.

Open `/lend`. Paste a demo address or connect a wallet. Amount **51+** is **Ceiling blocked**, not Decline. Scoring is skipped.

## Load-bearing test (run this live)

This is the judge script. Use a wallet that is **not** in the seed file. Same wallet every step. Amounts stay at **8 USDC** so the **rate** is what changes, not the ceiling.

### 0. Reset, then run the app

```bash
pnpm memory:reset
pnpm dev                  # http://localhost:3002
```

Confirm reset printed `Relationships: 0`.

### a. New wallet → on-chain baseline

1. Open http://localhost:3002/lend
2. **Connect wallet** (MetaMask / Rabby / Coinbase on Base Sepolia) — or paste that `0x` into Wallet
3. **Supply** `25` USDC (recorded in Sibyl as collateral; does not need a real token transfer for the memory demo)
4. Switch to **Borrow**, amount `8`, **Get quote**

Expect:

- Decision: **Approve** (or Approve with reduced limit if the wallet is brand-new and thin)
- Reasoning **must** say `USER_RELATIONSHIP is empty.`
- Primary signal **ONCHAIN_SIGNAL**
- APR in the **16–24%** band (thin wallets 24%, moderate 18%, very active 16%)
- Score is the on-chain baseline standing (≤ 0.38)

### b. Accept and repay on time

1. **Accept loan** — writes an `active` loan into USER_RELATIONSHIP
2. Switch to **Repay** → **Repay** (due date is 14 days out, so this is `on_time`)

Expect standing to move off 0. Memory page `/memory` now shows 1 loan, outcome `on_time`.

### c. Same wallet, second quote → memory-improved rate

1. Borrow tab, amount `8` again, **Get quote**

Expect:

- APR **visibly lower** (around **6%** after one on-time repayment)
- Reasoning cites **that specific loan / repayment**, not wallet age or tx count
- Line that **ONCHAIN_SIGNAL not used**
- `/memory` still has the repayment; the chain has not changed

### d. Reset memory → back to on-chain baseline

```bash
pnpm memory:reset
```

Same wallet, same **8 USDC** quote, **without** seeding.

Expect:

- `USER_RELATIONSHIP is empty.` again
- APR back in the **16–24%** band (same as step a)
- The improved 6% rate is gone even though the wallet’s on-chain history is unchanged

That is the load-bearing proof: the cheap rate lived in Sibyl, not on Base.

### Optional: seeded contrast (no private keys needed)

On `/lend`, click **Demo: clean book** then quote 8 USDC → Approve / ~6%.  
Click **Demo: defaulted** then quote 8 USDC → Decline, despite more volume than the clean wallet.

Amount `51` on either → **Ceiling blocked** (`MAX_BORROW_AMOUNT`, default 50).

## Architecture

Trace (`lib/trace`, `lib/memory`, `lib/lending`) is the reusable layer: relationship log, standing score, rate policy, ceilings.

Alex (`/lend`, `lib/lending/run.ts`, `lib/base`) is the consumer: user wallet connect for identity, agent key for optional origination, Grok-written reasoning that cannot change the numbers.

Sibyl Memory is how Trace persists. Treasury Alex remains at `/alex` as a second consumer of the same store.

## Use Alex

```bash
pnpm dev                 # http://localhost:3002
```

| URL | What |
|---|---|
| `/` | Landing |
| `/lend` | Supply / borrow / repay |
| `/memory` | USER_RELATIONSHIP blocks in Sibyl |
| `/log` | Originated loans and prior quotes |
| `/alex` | Legacy treasury desk |

On `/lend`:

1. Connect (end-user wallet) or paste an address
2. **Supply** collateral (memory record; optional on-chain send)
3. **Borrow** → Decision / Reasoning / Score
4. **Accept loan** or, if Decline, **Override and originate** (writes an override into memory)
5. **Repay** marks `on_time` / `late` from due vs repaid, or **Mark default**

```
Decision: Approve

Reasoning:
- …
- …

Score: 0.68
```

| Decision | What happens |
|---|---|
| **Approve** | Quoted APR + collateral ratio. Accept writes an `active` loan. |
| **Approve with reduced limit** | Amount exceeds this wallet’s standing limit. Accept originates the reduced size. |
| **Decline** | Default (or standing &lt; 0.18) in this agent’s book. Override is a human memory event. |
| **Ceiling blocked** | Amount &gt; `MAX_BORROW_AMOUNT`. Not a credit decision. Scoring skipped. |

The agent signer (`AGENT_PRIVATE_KEY`) is **not** the user’s wallet. Users connect for identity. The agent still broadcasts from its own funded key on Base Sepolia when `BASE_EXECUTE=1`.

## RATE_POLICY

Deterministic, in `lib/lending/rate.ts`.

| Book | APR (approx) | Collateral | Notes |
|---|---|---|---|
| Empty + thin chain (age &lt; 7d or &lt; 3 txs) | 24% | 2.5x | New-borrower baseline |
| Empty + moderate chain | 18% | 2.0x | Still worse than one on-time loan |
| Empty + established chain | 16% | 1.8x | On-chain standing **capped at 0.38** |
| Clean repeat (this agent) | 6% floor | 1.5x floor | `MIN_APR` / `MIN_COLLATERAL_RATIO` |
| Any default in this agent’s book | ~33% | high | Standing **capped at 0.12** → Decline |

A single default is asymmetric: volume does not save you. That is why the penalized seed wallet (53 borrowed, one default) is declined while a smaller clean book is approved at 6%.

`MAX_BORROW_AMOUNT` (default **50**) and `MIN_COLLATERAL_RATIO` (default **1.5**) are checked **before** scoring. Standing and the LLM cannot undercut them.

## Setup

Python 3.10+ (3.12 recommended) and Node 20+.

```bash
cd Trace
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
pnpm install
cp .env.example .env.local
pnpm test
pnpm dev                     # http://localhost:3002
```

## Wallet (agent signer, not Connect Wallet)

The agent originates from an env key. Generate it locally:

```bash
pnpm wallet:create
```

That prints the address and private key **once**, writes the key to **`.env.local`** as `AGENT_PRIVATE_KEY` (gitignored), and writes the public address to `config/agent-wallet.json`.

Fund **that address** on **Base Sepolia** (chain 84532):

1. Copy the address from the console or `config/agent-wallet.json`
2. Paste it into https://www.alchemy.com/faucets/base-sepolia
3. Confirm `.env.local` has `BASE_EXECUTE=1` and `BASE_CHAIN_ID=84532`
4. Restart `pnpm dev`

End users **Connect wallet** on `/lend`. That address is the relationship key. It is not the agent key.

Do not commit `.env.local`. Do not use a key that holds funds you cannot lose.

## Memory seed and reset

Local CLI only. **Not** exposed as HTTP routes.

```bash
pnpm memory:seed                          # seeds/lending-demo-seed.json
pnpm memory:seed seeds/demo-seed.json     # optional: legacy treasury seed
pnpm memory:reset                         # 0 relationships, 0 actions
```

`pnpm memory:seed` should print:

- 2 relationships
- **clean repeat** `0x1111…c1ea` — 4 on_time, standing ~0.95, Approve ~6%, `used_onchain=false`
- **default in book** `0x2222…d00d` — 1 default, standing 0.12, Decline ~33%, `used_onchain=false`

Load-bearing check: steps **a–d** above. After reset, the connected wallet is unknown again even though Base Sepolia has not changed.

## Policy

| USER_RELATIONSHIP | Rate driver |
|---|---|
| `total_loans == 0` | ONCHAIN_SIGNAL (fresh) |
| `total_loans > 0` | Relationship only (on-chain dropped in `selectRateInputs`) |

Code maps the quote. Grok (optional `XAI_API_KEY`) only writes reasoning. The model cannot change `decision`, APR, collateral ratio, or Score.

## Sibyl Memory

| Block | Stored? | Contents |
|---|---|---|
| USER_RELATIONSHIP | WARM `relationship/<wallet>` | loans, outcomes, quotes, overrides, collateral |
| ONCHAIN_SIGNAL | **never** | age, tx count — fetched per quote, used only if `total_loans == 0` |
| standing score | **computed** | recomputed from the loan book on every read |

If Sibyl is down, `POST /api/quote` returns **503**.

Engine: [`sibyl-memory-client`](https://github.com/Sibyl-Labs/Sibyl-Memory) · local SQLite + FTS5 · no vector DB.

## Env

See `.env.example`. Important:

| Variable | Role |
|---|---|
| `AGENT_PRIVATE_KEY` | Agent signer. From `pnpm wallet:create`. |
| `BASE_EXECUTE` | `1` to broadcast origination; otherwise Sibyl only |
| `BASE_CHAIN_ID` | `84532` Base Sepolia |
| `MAX_BORROW_AMOUNT` | Hard borrow cap (default 50) |
| `MIN_COLLATERAL_RATIO` | Collateral floor (default 1.5) |
| `MAX_TX_AMOUNT_USDC` | Treasury desk cap (default 25) |
| `XAI_API_KEY` | Optional. Alex still quotes without it. |

## API

- `POST /api/quote` — `{ wallet, amount, asset? }`
- `POST /api/supply` — `{ wallet, amount, asset? }`
- `POST /api/borrow` — `{ wallet, amount, asset?, override? }`
- `POST /api/repay` — `{ wallet, loan_id, mark_default? }`
- `GET /api/relationship/:wallet` — relationship + computed standing; on-chain only if the book is empty
- `GET /api/memory` · `GET /api/log`
- `POST /api/decide` — legacy treasury

## MCP

```bash
pnpm mcp
```

Tools: `alex_decide` · `alex_memory` · `alex_log` · `alex_resolve`

## License

MIT. See [LICENSE](./LICENSE).
