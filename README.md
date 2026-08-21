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

**Load-bearing test:** approve Desk scenario C (unknown recipient), restart the process, run C again → **Proceed**. Then:

```bash
rm .data/sibyl-memory.db
```

Run C again → **Hold**. The learned counterparty is gone because Sibyl is gone. A JSON file next to the app is not a backup of this.

Engine: [`sibyl-memory-client`](https://github.com/Sibyl-Labs/Sibyl-Memory) · file-based SQLite + FTS5 · no vector DB.

## Policy

| RISK_SCORE | Decision |
|---|---|
| `< 0.30` | Proceed |
| `0.30 – 0.60` | Proceed with flag |
| `> 0.60` | Hold for approval |

Code maps the score. Alex (Grok) writes reasoning from the Sibyl blocks only. The model cannot change `decision` or `RISK_SCORE`.

## Demo

```bash
# Python 3.10+ required for Sibyl Memory
/opt/homebrew/bin/python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt

pnpm install
cp .env.example .env.local   # optional XAI_API_KEY, BASE_PRIVATE_KEY
pnpm test
pnpm dev                     # http://localhost:3002
```

### Fresh-session recall (the judging moment)

1. Open `/desk`.
2. **C · Unknown recipient** → Hold. First reasoning line: *No prior interactions with this counterparty.*
3. Approve the Hold (user override).
4. Restart `pnpm dev` (new process, new session).
5. Run **C** again → Proceed. Sibyl still has the counterparty entity.
6. `rm .data/sibyl-memory.db` and run **C** → Hold again.

| | Expected |
|---|---|
| **A · Typical vault** | Proceed · $500 USDT to Treasury Vault |
| **B · Oversized vault** | Proceed with flag · $2,400 to the same vault |
| **C · Unknown recipient** | Hold, until Sibyl records an approval |

## Base (optional stack)

Each persisted decision hashes `id + decision + risk + recipient`. If `BASE_PRIVATE_KEY` is set, Trace writes that hash as calldata on **Base Sepolia**. Sibyl is still the source of truth; Base is the public receipt.

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
