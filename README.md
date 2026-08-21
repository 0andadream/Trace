# Trace

**Alex — autonomous treasury agent.**

Treasury decisions grounded in operating history, not vibes. Persistent memory is **Sibyl Memory**. Delete that layer and the agent forgets.

```
REQUEST → SIBYL MEMORY → RISK → DECIDE → RECORD (Sibyl + optional Base)
```

Built for the [Sibyl Labs Hackathon](https://hack.sibyllabs.org/) eligibility gate: memory is load-bearing.

## Memory implementation note

Alex always receives three memory blocks, **recalled from Sibyl**, never from a parallel app log:

| Block | Sibyl tier | What is stored |
|---|---|---|
| AGENT_REPUTATION | WARM `agent/Alex` + derived from `action/*` | totals, success/reject/override rates |
| COUNTERPARTY_PROFILE | WARM `counterparty/<address>` | prior interactions with that wallet |
| RISK_SCORE | computed in code from those blocks | 0.0–1.0 deviation from history |

Every decision is also a COLD journal event (`write_event`) and a WARM `action/<id>` entity. Policy lives in REFERENCE `policy`. Last decision is HOT state.

**Load-bearing test:** Submit a real recipient Alex has never seen → Hold. Approve it. Restart the process. Submit the same address again → the decision changes because Sibyl still has that counterparty. Then:

```bash
rm .data/sibyl-memory.db
```

Submit it again → Hold. The learned counterparty is gone because Sibyl is gone.

Engine: [`sibyl-memory-client`](https://github.com/Sibyl-Labs/Sibyl-Memory) · file-based SQLite + FTS5 · no vector DB.

## Policy

| RISK_SCORE | Decision |
|---|---|
| `< 0.30` | Proceed |
| `0.30 – 0.60` | Proceed with flag |
| `> 0.60` | Hold for approval |

Code maps the score. Alex (Grok) writes reasoning from the Sibyl blocks only. The model cannot change `decision` or `RISK_SCORE`.

## Run

```bash
# Python 3.10+ required for Sibyl Memory
/opt/homebrew/bin/python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt

pnpm install
cp .env.example .env.local
pnpm test
pnpm dev                     # http://localhost:3002
```

Alex is the home page. Submit a treasury intent. The three memory blocks load from Sibyl before you ask. The reply is only:

```
Decision: …
Reasoning:
- …
Risk: 0.00
```

There is no canned history. Until Sibyl has recorded actions, reputation is thin and counterparties are empty, so Alex holds. History is only what you (or the agent) actually logged.

## Wallet, faucet, seed (local CLI only)

Reset and seed are **not** HTTP routes. Visitors cannot trigger them.

```bash
pnpm wallet:create          # prints address + key once; writes .env.local + config/agent-wallet.json
pnpm memory:seed            # loads seeds/demo-seed.json into Sibyl
pnpm memory:reset           # wipes Sibyl to 0 actions
```

Hard cap: `MAX_TX_AMOUNT_USDC` (default 25). Amounts above it are `ceiling_blocked` — not a Hold — and never go to risk scoring or broadcast.

The agent signs with `AGENT_PRIVATE_KEY`. There is no Connect Wallet. Token field: `ETH`, `USDC`, or an ERC-20 address.

## API

`POST /api/decide` — 503 if Sibyl Memory is down (fail closed).

`POST /api/log/resolve` — `{ "id", "resolution": "approved" | "rejected" }`. Approval is a user override **written back to Sibyl**.

`GET /api/memory` · `GET /api/log` — include `sibyl` health.

## MCP

```bash
pnpm mcp
```

Tools: `alex_decide` · `alex_memory` · `alex_log` · `alex_resolve`

## License

MIT. See [LICENSE](./LICENSE).

## Principle

Memory decides. Alex reports. Sibyl remembers.
