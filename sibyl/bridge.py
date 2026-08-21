#!/usr/bin/env python3
"""Load-bearing Sibyl Memory bridge for Trace / Alex.

Reads one JSON object from stdin, writes one JSON object to stdout.
The Next.js app does not keep a parallel JSON log. If this database is
deleted, learned counterparties and overrides disappear.
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


def client() -> MemoryClient:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    return MemoryClient.local(str(path), tenant_id=TENANT)


def body(row: dict) -> dict:
    return row.get("body") if isinstance(row.get("body"), dict) else row


def list_actions(mem: MemoryClient) -> list[dict]:
    rows = mem.list_entities("action", limit=400)
    actions = [body(r) for r in rows]
    actions.sort(key=lambda a: a.get("at") or "", reverse=True)
    return actions


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
        mem.set_entity(
            "counterparty",
            addr,
            {
                "address": addr,
                "label": last.get("counterpartyLabel") or "Unlabeled",
                "interactionCount": len(rows),
                "successful": sum(1 for r in rows if r.get("outcome") == "success"),
                "rejected": sum(1 for r in rows if r.get("outcome") == "rejected"),
                "incidents": sum(1 for r in rows if r.get("outcome") == "incident"),
                "overrides": sum(1 for r in rows if r.get("userOverride")),
                "avgAmount": sum(amounts) / len(amounts) if amounts else 0,
                "lastAt": last.get("at"),
            },
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
    events = mem.read_events(limit=20)
    status = mem.free_tier_status()
    return {
        "engine": "sibyl-memory-client",
        "db": str(db_path()),
        "tenant": mem.get_tenant(),
        "tier": mem.get_tier(),
        "actionCount": len(actions),
        "counterpartyCount": len(counterparties),
        "recentEvents": len(events),
        "lastEvent": events[0] if events else None,
        "freeTier": status,
        "loadBearing": True,
    }


def handle(msg: dict) -> dict:
    op = msg.get("op")
    mem = client()

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
