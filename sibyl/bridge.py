#!/usr/bin/env python3
"""Load-bearing Sibyl Memory bridge for Trace / Alex.

Reads one JSON object from stdin, writes one JSON object to stdout.
The Next.js app does not keep a parallel JSON log. If this database is
deleted, USER_RELATIONSHIP (purchases this agent approved) disappears.
On-chain wallet history is never written here.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from sibyl_memory_client import MemoryClient, NotFoundError

TENANT = os.environ.get("SIBYL_TENANT", "trace-alex")
DEFAULT_DB = Path(__file__).resolve().parent.parent / ".data" / "sibyl-memory.db"


def db_path() -> Path:
    raw = os.environ.get("SIBYL_MEMORY_DB")
    return Path(raw).expanduser() if raw else DEFAULT_DB


def client(tenant: str | None = None) -> MemoryClient:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tid = (tenant or TENANT).strip() or TENANT
    return MemoryClient.local(str(path), tenant_id=tid)


def body(row: dict) -> dict:
    return row.get("body") if isinstance(row.get("body"), dict) else row


def scrub_labels(row: dict) -> dict:
    if row.get("counterpartyLabel") == "OKX DEX Router":
        return {**row, "counterpartyLabel": "Swap Router"}
    return row


def rebuild_warm(mem: MemoryClient, actions: list[dict]) -> None:
    by_addr: dict[str, list[dict]] = {}
    for row in actions:
        addr = str(row.get("recipient") or "").lower()
        if not addr:
            continue
        by_addr.setdefault(addr, []).append(row)

    for addr, rows in by_addr.items():
        amounts = [float(r.get("amount") or 0) for r in rows]
        last = max(rows, key=lambda r: r.get("at") or "")
        statuses = [r.get("verification") for r in rows if r.get("verification")]
        body_cp = {
                "address": addr,
                "label": last.get("counterpartyLabel") or "Unlabeled",
                "interactionCount": len(rows),
                "successful": sum(1 for r in rows if r.get("outcome") == "success"),
                "rejected": sum(1 for r in rows if r.get("outcome") == "rejected"),
                "incidents": sum(1 for r in rows if r.get("outcome") == "incident"),
                "overrides": sum(1 for r in rows if r.get("userOverride")),
                "avgAmount": sum(amounts) / len(amounts) if amounts else 0,
                "lastAt": last.get("at"),
        }
        if statuses:
            body_cp["verification"] = statuses[-1]
        mem.set_entity(
            "counterparty",
            addr,
            body_cp,
        )

    mem.set_entity(
        "agent",
        "Alex",
        {
            "totalActions": len(actions),
            "successful": sum(1 for r in actions if r.get("outcome") == "success"),
            "rejected": sum(1 for r in actions if r.get("outcome") == "rejected"),
            "overrides": sum(1 for r in actions if r.get("userOverride")),
            "holds": sum(1 for r in actions if r.get("decision") == "Hold for approval"),
        },
    )


def list_actions(mem: MemoryClient) -> list[dict]:
    rows = mem.list_entities("action", limit=400)
    actions = [scrub_labels(body(r)) for r in rows]
    rewritten = False
    for row in actions:
        raw = next((body(r) for r in rows if body(r).get("id") == row.get("id")), {})
        if raw.get("counterpartyLabel") == "OKX DEX Router":
            mem.set_entity("action", row["id"], row)
            rewritten = True
    if rewritten:
        rebuild_warm(mem, actions)
    actions.sort(key=lambda a: a.get("at") or "", reverse=True)
    return actions


def wipe(mem: MemoryClient) -> None:
    for category in ("action", "counterparty", "agent", "relationship", "loan", "collateral", "quote", "purchase"):
        for row in mem.list_entities(category, limit=1000):
            name = row.get("name")
            if name:
                try:
                    mem.delete_entity(category, name)
                except NotFoundError:
                    pass


def body_rel(row: dict) -> dict:
    payload = body(row)
    payload.pop("current_standing_score", None)
    payload.pop("current_limit", None)
    return payload


def list_relationships(mem: MemoryClient) -> list[dict]:
    rows = mem.list_entities("relationship", limit=400)
    rels = [body_rel(r) for r in rows]
    rels.sort(key=lambda a: a.get("last_seen") or "", reverse=True)
    return rels


def persist_relationship(mem: MemoryClient, rel: dict) -> dict:
    addr = str(rel.get("wallet_address") or "").strip().lower()
    if not addr:
        raise ValueError("relationship.wallet_address required")
    rel = {**rel, "wallet_address": addr}
    rel.pop("current_standing_score", None)
    rel.pop("current_limit", None)
    mem.set_entity("relationship", addr, rel)
    mem.write_event(
        acted=[
            f"relationship {addr} purchases={rel.get('total_purchases', rel.get('total_loans'))} last={rel.get('last_seen')}"
        ],
        extra={
            "wallet": addr,
            "total_purchases": rel.get("total_purchases", rel.get("total_loans")),
        },
        ts=rel.get("last_seen"),
    )
    mem.set_state(
        "last_relationship",
        {"wallet": addr, "total_purchases": rel.get("total_purchases", rel.get("total_loans"))},
    )
    return rel


def persist_action(mem: MemoryClient, row: dict, acted: str) -> None:
    mem.set_entity("action", row["id"], row)
    mem.write_event(
        acted=[acted],
        evaluated={"decision": row.get("decision"), "riskScore": row.get("riskScore")},
        extra={"id": row.get("id"), "recipient": row.get("recipient"), "outcome": row.get("outcome")},
        ts=row.get("at"),
    )
    actions = list_actions(mem)
    rebuild_warm(mem, actions)
    mem.set_state("last_decision", {"id": row.get("id"), "decision": row.get("decision")})


def health(mem: MemoryClient) -> dict:
    actions = mem.list_entities("action", limit=400)
    counterparties = mem.list_entities("counterparty", limit=400)
    relationships = mem.list_entities("relationship", limit=400)
    events = mem.read_events(limit=20)
    status = mem.free_tier_status()
    return {
        "engine": "sibyl-memory-client",
        "db": str(db_path()),
        "tenant": mem.get_tenant(),
        "tier": mem.get_tier(),
        "actionCount": len(actions),
        "counterpartyCount": len(counterparties),
        "relationshipCount": len(relationships),
        "recentEvents": len(events),
        "lastEvent": events[0] if events else None,
        "freeTier": status,
        "loadBearing": True,
    }


def handle(msg: dict) -> dict:
    op = msg.get("op")
    mem = client(msg.get("tenant") if isinstance(msg.get("tenant"), str) else None)

    if op == "health":
        return {"ok": True, "health": health(mem)}

    if op == "list":
        actions = list_actions(mem)
        if not actions and msg.get("seed"):
            for row in msg["seed"]:
                mem.set_entity("action", row["id"], row)
            rebuild_warm(mem, list_actions(mem))
            mem.set_state("seeded", {"ok": True, "count": len(msg["seed"])})
            mem.set_reference(
                "policy",
                {
                    "proceed": "<0.30",
                    "flag": "0.30-0.60",
                    "hold": ">0.60",
                    "note": "Code maps RISK_SCORE. Alex cannot change the decision.",
                },
            )
            mem.write_event(acted=["seeded treasury operating history into Sibyl Memory"])
            actions = list_actions(mem)
        return {"ok": True, "actions": actions, "health": health(mem)}

    if op == "append":
        row = msg["row"]
        persist_action(
            mem,
            row,
            f"{row.get('decision')} {row.get('action')} {row.get('amount')} {row.get('token')} -> {row.get('counterpartyLabel')}",
        )
        return {"ok": True, "row": row, "health": health(mem)}

    if op == "update":
        action_id = msg["id"]
        try:
            current = body(mem.get_entity("action", action_id))
        except NotFoundError:
            return {"ok": True, "row": None}
        updated = {**current, **(msg.get("patch") or {}), "id": action_id}
        persist_action(
            mem,
            updated,
            f"resolve {updated.get('id')} -> {updated.get('outcome')} override={updated.get('userOverride')}",
        )
        return {"ok": True, "row": updated, "health": health(mem)}

    if op == "get":
        try:
            row = mem.get_entity(msg["category"], msg["name"])
        except NotFoundError:
            return {"ok": True, "entity": None}
        return {"ok": True, "entity": row}

    if op == "list_relationships":
        rels = list_relationships(mem)
        return {"ok": True, "relationships": rels, "health": health(mem)}

    if op == "get_relationship":
        addr = str(msg.get("wallet") or "").strip().lower()
        try:
            row = mem.get_entity("relationship", addr)
        except NotFoundError:
            return {"ok": True, "relationship": None, "health": health(mem)}
        return {"ok": True, "relationship": body_rel(row), "health": health(mem)}

    if op == "upsert_relationship":
        rel = persist_relationship(mem, msg["relationship"])
        return {"ok": True, "relationship": rel, "health": health(mem)}

    if op == "replace_relationships":
        wipe(mem)
        rows = msg.get("relationships") or []
        stored = []
        for rel in rows:
            stored.append(persist_relationship(mem, rel))
        mem.set_state("seeded", {"ok": True, "kind": "bnpl", "count": len(stored)})
        mem.set_reference(
            "bnpl_policy",
            {
                "primary": "USER_RELATIONSHIP",
                "secondary": "ONCHAIN_SIGNAL only when total_purchases == 0",
                "note": "Code computes limit, installments, and decision. Alex cannot change the numbers.",
            },
        )
        mem.write_event(acted=[f"replaced Sibyl memory with {len(stored)} BNPL relationships"])
        return {"ok": True, "health": health(mem), "relationships": list_relationships(mem)}

    if op == "wipe":
        wipe(mem)
        return {
            "ok": True,
            "health": health(mem),
            "actions": [],
            "counterparties": 0,
            "relationships": [],
        }

    if op == "replace":
        wipe(mem)
        rows = msg.get("actions") or []
        for row in rows:
            mem.set_entity("action", row["id"], row)
        rebuilt = list_actions(mem)
        rebuild_warm(mem, rebuilt)
        mem.set_state("seeded", {"ok": True, "count": len(rows)})
        mem.set_reference(
            "policy",
            {
                "proceed": "<0.30",
                "flag": "0.30-0.60",
                "hold": ">0.60",
                "note": "Code maps RISK_SCORE. Alex cannot change the decision.",
            },
        )
        mem.write_event(acted=[f"replaced Sibyl memory with {len(rows)} seed actions"])
        return {"ok": True, "health": health(mem), "actions": rebuilt}

    return {"ok": False, "error": f"unknown op {op}"}


def main() -> int:
    raw = sys.stdin.read()
    try:
        msg = json.loads(raw or "{}")
        result = handle(msg)
    except Exception as exc:
        result = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
    sys.stdout.write(json.dumps(result, default=str))
    sys.stdout.write("\n")
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
