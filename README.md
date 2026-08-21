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

## Broadcast (no wallet connect)

The agent signs with `BASE_PRIVATE_KEY` in `.env.local`. There is no Connect Wallet.

1. Put a private key in `.env.local`. Fund that address with ETH for gas, and with USDC/ETH if that is what you will send.
2. `BASE_CHAIN_ID=84532` for Base Sepolia, or `8453` for Base.
3. `BASE_EXECUTE=1`
4. Restart `pnpm dev`.
5. Submit a **transfer**. If Alex returns Proceed or Proceed with flag, it broadcasts. If it Holds, Approve — then it broadcasts.

Token field: `ETH`, `USDC`, or an ERC-20 address. Recipient must be `0x…`.

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
