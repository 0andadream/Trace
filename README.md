# Trace

**Alex — autonomous treasury agent.**

Treasury decisions grounded in operating history, not vibes.

```
REQUEST → MEMORY → RISK → DECIDE → RECORD
```

Alex always receives three memory blocks:

1. **AGENT_REPUTATION** — totals, success/reject/override rates, patterns by action type
2. **COUNTERPARTY_PROFILE** — prior interactions with this address (may be empty)
3. **RISK_SCORE** — 0.0–1.0, how far this request deviates from recorded history

Code computes the score and applies the policy. Alex (Grok) writes the reasoning from those blocks only.

## Policy

| RISK_SCORE | Decision |
|---|---|
| `< 0.30` | Proceed |
| `0.30 – 0.60` | Proceed with flag |
| `> 0.60` | Hold for approval |

Thin history (&lt; 3 actions) prefers Hold. An empty counterparty profile is stated in the first reasoning line: *No prior interactions with this counterparty.* High user-override rates on Hold decisions defer to you.

The model cannot change `decision` or `RISK_SCORE`.

## Demo

```bash
pnpm install
cp .env.example .env.local   # optional XAI_API_KEY for Grok-written reasoning
pnpm test
pnpm dev                     # http://localhost:3002
```

### Desk — `/desk`

| | Expected |
|---|---|
| **A · Typical vault** | Proceed · $500 USDT to Treasury Vault |
| **B · Oversized vault** | Proceed with flag · $2,400 to the same vault |
| **C · Unknown recipient** | Hold · $400 to a wallet with no profile |

Approve C, then run C again. Memory now has one successful interaction. The decision changes.

## API

`POST /api/decide`

```json
{
  "action": "transfer",
  "token": "USDT",
  "amount": 500,
  "recipient": "0x1111111111111111111111111111111111111111"
}
```

Scenarios: `"typical"` · `"oversized"` · `"unknown"`.

`POST /api/log/resolve` — `{ "id", "resolution": "approved" | "rejected" }`. Approval is a user override.

`GET /api/memory` · `GET /api/log`

## MCP

```bash
pnpm mcp
```

```toml
# ~/.grok/config.toml
[mcp_servers.trace]
command = "npx"
args = ["tsx", "mcp/server.ts"]
```

Tools: `alex_decide` · `alex_memory` · `alex_log` · `alex_resolve`

## Principle

Memory decides. Alex reports.
