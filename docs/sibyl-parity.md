# Sibyl memory: Python vs Node (production)

Standing, limits, ceilings, and on-time/late/default classification are **not** in Sibyl.
They live in TypeScript (`lib/bnpl/relationship.ts`, `lib/bnpl/policy.ts`, `lib/bnpl/ceiling.ts`)
and run the same code on laptop and Vercel. Sibyl only **stores and recalls** entities.

## What Python `sibyl-memory-client` does here

`sibyl/bridge.py` is a JSON stdin/stdout adapter:

| Op | Effect |
|---|---|
| `get_relationship` / `upsert_relationship` / `list_relationships` | `relationship` entities keyed by wallet |
| `append` / `update` / `list` | treasury `action` entities + warm counterparty/agent |
| `wipe` / `replace` / `replace_relationships` | reset + seed |
| `health` | counts + `loadBearing: true` |

It does **not** compute score, `MAX_PURCHASE_AMOUNT`, `MAX_ACTIVE_PLANS`, `MIN_AGENT_RESERVE`, installment lateness, interest, or rounding.

## Node path (Vercel)

`lib/memory/engine.ts` implements the same ops. Persistence is `lib/memory/persist.ts`.

Laptop: if `.venv/bin/python` exists, the Python client + SQLite is used.
Vercel: no Python, Node engine + Redis.

## Differences (none change Approve / Decline / limit)

| Item | Python | Node | Decision impact |
|---|---|---|---|
| Engine id | `sibyl-memory-client` | `sibyl-memory-node` | Display only |
| Storage | SQLite file | Redis keys, no TTL; file fallback off Vercel | None if Redis holds the book |
| Events window | SDK `read_events(20)` for health | Last 100 stored, health shows 20 | None |
| `get` entity wrap | May return SDK `{body, name}` | Returns the body dict | Unused by BNPL |
| Concurrent wallet writes | SQLite single writer | Per-wallet Redis lock (`SET NX EX 8`) + version field | Prevents lost updates |
| OKX label rewrite | Persists scrubbed action | Same | Treasury-only |

## Redis key shape (no expiry)

```
sibyl:{tenant}:rel:{wallet}     JSON { v, data }   USER_RELATIONSHIP
sibyl:{tenant}:rel:index        SET of wallets
sibyl:{tenant}:action:{id}
sibyl:{tenant}:action:index
sibyl:{tenant}:cp:{addr}
sibyl:{tenant}:events / state / refs / agent
```

Locks use `*:lock` with TTL 8s only. Relationship keys are never given a TTL.

A leftover blob `trace-sibyl-store` from the first Node version is migrated into per-wallet keys on first access and left in place as a fallback copy.

## Durability

Vercel Marketplace Redis is Upstash Redis, not a volatile cache tier. We do not set `EX`/`PX` on history keys. Hobby/regional Redis still persists; treat it as the live book and run `pnpm memory:export` before risky changes.

## Production requirement

On Vercel (`VERCEL=1`), Redis env must be present. If ping fails, APIs return **503** (`Sibyl unavailable`) instead of an empty book.
