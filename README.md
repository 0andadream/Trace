# Trace

**Alex — autonomous treasury agent.**

Alex decides whether a payment can go out. It reads operating history from [Sibyl Memory](https://github.com/Sibyl-Labs/Sibyl-Memory), then answers **Proceed**, **Proceed with flag**, **Hold for approval**, or **Ceiling blocked**. It does not chat. It does not connect a wallet. It signs with its own key.

```
REQUEST → SIBYL MEMORY → CEILING → RISK → DECIDE → RECORD → (optional) BROADCAST
```

Built so memory is **load-bearing**: delete Sibyl and the agent forgets. That is the [Sibyl Labs Hackathon](https://hack.sibyllabs.org/) eligibility gate.

## Use Alex

```bash
pnpm dev                 # http://localhost:3002
```

| URL | What |
|---|---|
| `/` | Landing |
| `/alex` | Agent — submit a treasury intent |
| `/memory` | What Sibyl currently stores |
| `/log` | Recorded decisions |

On `/alex` fill in:

- **Action** — `transfer` is the only action that can broadcast
- **Token** — `ETH`, `USDC`, or an ERC-20 address
- **Amount**
- **Recipient** — `0x…`

The three memory blocks load from Sibyl before you ask. The reply is only:

```
Decision: Proceed with flag

Reasoning:
- …
- …

Risk: 0.38
```

| Decision | What happens |
|---|---|
| **Proceed** / **Proceed with flag** | Written to Sibyl. Broadcasts if execute is on and the agent key is funded. |
| **Hold for approval** | Nothing sends. **Approve** (may broadcast) or **Reject**. |
| **Ceiling blocked** | Amount is over `MAX_TX_AMOUNT_USDC`. Not a Hold. Risk scoring is skipped. Nothing sends. |

Empty memory is real. Unknown counterparties and thin history **Hold**. Approve once; the next submit to that address should change because Sibyl now has a record.

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

## Wallet (no Connect Wallet)

The agent broadcasts from an env key. Generate it locally:

```bash
pnpm wallet:create
```

That prints the address and private key **once**, writes the key to **`.env.local`** as `AGENT_PRIVATE_KEY` (gitignored), and writes the public address to `config/agent-wallet.json`.

Fund **that address** on **Base Sepolia** (chain 84532), not Ethereum Sepolia:

1. Copy the address from the console or `config/agent-wallet.json`
2. Paste it into https://www.alchemy.com/faucets/base-sepolia
3. Confirm `.env.local` has `BASE_EXECUTE=1` and `BASE_CHAIN_ID=84532`
4. Restart `pnpm dev`

You need Sepolia ETH for gas. For USDC transfers, the same address also needs Base Sepolia USDC.

Verify:

```bash
cat config/agent-wallet.json
git check-ignore -v .env.local    # should hit .gitignore
```

Do not commit `.env.local`. Do not use a key that holds funds you cannot lose.

## Memory seed and reset

Local CLI only. **Not** exposed as HTTP routes.

```bash
pnpm memory:seed     # loads seeds/demo-seed.json
pnpm memory:reset    # 0 actions, no counterparties
```

`pnpm memory:seed` should print:

- 40 actions
- 4 counterparties
- 2 rejections
- 2 overrides (5%)
- **Known desk** `0xc0ffee254729296a45a3885639ac7e10f9d54979` — 10 clean transfers
- **Failed verification** `0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` — 2 rejections

After seeding, a small USDC transfer to Known desk should score low; the same amount to Failed verification should **Hold**. An amount above `MAX_TX_AMOUNT_USDC` (default **25**) is **Ceiling blocked**.

Load-bearing check:

1. Hold an unseen address, approve it
2. Restart `pnpm dev`, submit the same address — decision should change
3. `pnpm memory:reset` (or delete `.data/sibyl-memory.db`) — that address Holds again

## Policy

| RISK_SCORE | Decision |
|---|---|
| `< 0.30` | Proceed |
| `0.30 – 0.60` | Proceed with flag |
| `> 0.60` | Hold for approval |

`MAX_TX_AMOUNT_USDC` is checked **before** risk scoring. It cannot be overridden by memory or by Alex.

Code maps the score. Grok (optional `XAI_API_KEY`) only writes reasoning from the memory blocks. The model cannot change `decision` or `RISK_SCORE`.

## Sibyl Memory

Alex always receives three blocks, recalled from Sibyl — not from a parallel app log:

| Block | Sibyl tier | Contents |
|---|---|---|
| AGENT_REPUTATION | WARM `agent/Alex` + derived from `action/*` | totals, success / reject / override rates |
| COUNTERPARTY_PROFILE | WARM `counterparty/<address>` | prior interactions with that wallet (may be empty) |
| RISK_SCORE | computed in code | 0.0–1.0 deviation from history |

Each decision is also a COLD journal event and a WARM `action/<id>` entity. Policy lives in REFERENCE `policy`. If Sibyl is down, `POST /api/decide` returns **503**.

Engine: [`sibyl-memory-client`](https://github.com/Sibyl-Labs/Sibyl-Memory) · local SQLite + FTS5 · no vector DB.

## Env

See `.env.example`. Important:

| Variable | Role |
|---|---|
| `AGENT_PRIVATE_KEY` | Agent signer. From `pnpm wallet:create`. |
| `BASE_EXECUTE` | `1` to broadcast; otherwise Sibyl only |
| `BASE_CHAIN_ID` | `84532` Base Sepolia, `8453` Base |
| `MAX_TX_AMOUNT_USDC` | Hard cap (default 25) |
| `XAI_API_KEY` | Optional. Alex still decides without it. |

## API

- `POST /api/decide` — 503 if Sibyl is down
- `POST /api/log/resolve` — `{ "id", "resolution": "approved" \| "rejected" }`
- `GET /api/memory` · `GET /api/log` · `GET /api/preview`

## MCP

```bash
pnpm mcp
```

Tools: `alex_decide` · `alex_memory` · `alex_log` · `alex_resolve`

## License

MIT. See [LICENSE](./LICENSE).
