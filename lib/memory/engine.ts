import {
  appendEvent,
  emptyBucket,
  getEntity,
  getRel,
  listCategory,
  listRels,
  patchState,
  persistLabel,
  pingStore,
  putRel,
  readEvents,
  setEntity,
  setReference,
  wipeTenant,
  type Body,
} from "@/lib/memory/persist";

type Msg = Record<string, unknown>;

function asBody(row: unknown): Body {
  if (!row || typeof row !== "object") return {};
  const rec = row as Body;
  if (rec.body && typeof rec.body === "object") return rec.body as Body;
  return rec;
}

function scrubLabels(row: Body): Body {
  if (row.counterpartyLabel === "OKX DEX Router") return { ...row, counterpartyLabel: "Swap Router" };
  return row;
}

function bodyRel(row: Body): Body {
  const payload = { ...asBody(row) };
  delete payload.current_standing_score;
  delete payload.current_limit;
  return payload;
}

async function rebuildWarm(tenant: string, actions: Body[]) {
  const byAddr: Record<string, Body[]> = {};
  for (const row of actions) {
    const addr = String(row.recipient || "").toLowerCase();
    if (!addr) continue;
    (byAddr[addr] ||= []).push(row);
  }
  for (const [addr, rows] of Object.entries(byAddr)) {
    const amounts = rows.map((r) => Number(r.amount || 0));
    const last = rows.reduce((a, b) => (String(a.at || "") > String(b.at || "") ? a : b));
    const statuses = rows.map((r) => r.verification).filter(Boolean);
    const body: Body = {
      address: addr,
      label: last.counterpartyLabel || "Unlabeled",
      interactionCount: rows.length,
      successful: rows.filter((r) => r.outcome === "success").length,
      rejected: rows.filter((r) => r.outcome === "rejected").length,
      incidents: rows.filter((r) => r.outcome === "incident").length,
      overrides: rows.filter((r) => r.userOverride).length,
      avgAmount: amounts.length ? amounts.reduce((s, n) => s + n, 0) / amounts.length : 0,
      lastAt: last.at,
    };
    if (statuses.length) body.verification = statuses[statuses.length - 1];
    await setEntity(tenant, "counterparty", addr, body);
  }
  await setEntity(tenant, "agent", "Alex", {
    totalActions: actions.length,
    successful: actions.filter((r) => r.outcome === "success").length,
    rejected: actions.filter((r) => r.outcome === "rejected").length,
    overrides: actions.filter((r) => r.userOverride).length,
    holds: actions.filter((r) => r.decision === "Hold for approval").length,
  });
}

async function listActions(tenant: string): Promise<Body[]> {
  const rows = await listCategory(tenant, "action", 400);
  const actions = rows.map((r) => scrubLabels(asBody(r)));
  let rewritten = false;
  for (const row of actions) {
    if (row.counterpartyLabel === "Swap Router") {
      const raw = rows.find((r) => asBody(r).id === row.id);
      if (raw && asBody(raw).counterpartyLabel === "OKX DEX Router") {
        await setEntity(tenant, "action", String(row.id), row);
        rewritten = true;
      }
    }
  }
  if (rewritten) await rebuildWarm(tenant, actions);
  actions.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return actions;
}

async function persistRelationship(tenant: string, rel: Body): Promise<Body> {
  const addr = String(rel.wallet_address || "").trim().toLowerCase();
  if (!addr) throw new Error("relationship.wallet_address required");
  const stored = bodyRel({ ...rel, wallet_address: addr });
  await putRel(tenant, stored);
  await appendEvent(tenant, {
    acted: [`relationship ${addr} purchases=${stored.total_purchases ?? stored.total_loans} last=${stored.last_seen}`],
    extra: { wallet: addr, total_purchases: stored.total_purchases ?? stored.total_loans },
    ts: stored.last_seen,
  });
  await patchState(tenant, "last_relationship", {
    wallet: addr,
    total_purchases: stored.total_purchases ?? stored.total_loans,
  });
  return stored;
}

async function persistAction(tenant: string, row: Body, acted: string) {
  await setEntity(tenant, "action", String(row.id), row);
  await appendEvent(tenant, {
    acted: [acted],
    evaluated: { decision: row.decision, riskScore: row.riskScore },
    extra: { id: row.id, recipient: row.recipient, outcome: row.outcome },
    ts: row.at,
  });
  const actions = await listActions(tenant);
  await rebuildWarm(tenant, actions);
  await patchState(tenant, "last_decision", { id: row.id, decision: row.decision });
}

async function health(tenant: string) {
  const store = await pingStore();
  const actions = await listCategory(tenant, "action", 400);
  const counterparties = await listCategory(tenant, "counterparty", 400);
  const relationships = await listRels(tenant);
  const events = await readEvents(tenant, 20);
  return {
    engine: store.backend === "kv" ? "sibyl-memory-node" : "sibyl-memory-node",
    db: persistLabel(),
    tenant,
    tier: store.backend,
    actionCount: actions.length,
    counterpartyCount: counterparties.length,
    relationshipCount: relationships.length,
    recentEvents: events.length,
    lastEvent: events[0] || null,
    freeTier: { mode: "node", persistence: store.backend === "kv" ? "redis-no-ttl" : "file" },
    loadBearing: true,
    store: store.backend,
  };
}

export async function handleSibylMessage(msg: Msg) {
  const op = msg.op;
  const tenant = String(msg.tenant || process.env.SIBYL_TENANT || "trace-alex");

  if (op === "health") {
    await pingStore();
    return { ok: true, health: await health(tenant) };
  }

  if (op === "list") {
    let actions = await listActions(tenant);
    if (!actions.length && Array.isArray(msg.seed)) {
      for (const row of msg.seed as Body[]) await setEntity(tenant, "action", String(row.id), row);
      await rebuildWarm(tenant, await listActions(tenant));
      await patchState(tenant, "seeded", { ok: true, count: (msg.seed as Body[]).length });
      await setReference(tenant, "policy", {
        proceed: "<0.30",
        flag: "0.30-0.60",
        hold: ">0.60",
        note: "Code maps RISK_SCORE. Alex cannot change the decision.",
      });
      await appendEvent(tenant, { acted: ["seeded treasury operating history into Sibyl Memory"] });
      actions = await listActions(tenant);
    }
    return { ok: true, actions, health: await health(tenant) };
  }

  if (op === "append") {
    const row = msg.row as Body;
    await persistAction(
      tenant,
      row,
      `${row.decision} ${row.action} ${row.amount} ${row.token} -> ${row.counterpartyLabel}`,
    );
    return { ok: true, row, health: await health(tenant) };
  }

  if (op === "update") {
    const actionId = String(msg.id);
    const current = await getEntity(tenant, "action", actionId);
    if (!current) return { ok: true, row: null };
    const updated: Body = { ...current, ...((msg.patch as Body) || {}), id: actionId };
    await persistAction(
      tenant,
      updated,
      `resolve ${updated.id} -> ${updated.outcome} override=${updated.userOverride}`,
    );
    return { ok: true, row: updated, health: await health(tenant) };
  }

  if (op === "get") {
    const entity = await getEntity(tenant, String(msg.category), String(msg.name));
    return { ok: true, entity };
  }

  if (op === "list_relationships") {
    const rels = (await listRels(tenant)).map(bodyRel);
    rels.sort((a, b) => String(b.last_seen || "").localeCompare(String(a.last_seen || "")));
    return { ok: true, relationships: rels, health: await health(tenant) };
  }

  if (op === "get_relationship") {
    const addr = String(msg.wallet || "").trim().toLowerCase();
    const row = await getRel(tenant, addr);
    return {
      ok: true,
      relationship: row ? bodyRel(row) : null,
      health: await health(tenant),
    };
  }

  if (op === "upsert_relationship") {
    const rel = await persistRelationship(tenant, msg.relationship as Body);
    return { ok: true, relationship: rel, health: await health(tenant) };
  }

  if (op === "replace_relationships") {
    await wipeTenant(tenant);
    const rows = (msg.relationships as Body[]) || [];
    for (const rel of rows) await persistRelationship(tenant, rel);
    await patchState(tenant, "seeded", { ok: true, kind: "bnpl", count: rows.length });
    await setReference(tenant, "bnpl_policy", {
      primary: "USER_RELATIONSHIP",
      secondary: "ONCHAIN_SIGNAL only when total_purchases == 0",
      note: "Code computes limit, installments, and decision. Alex cannot change the numbers.",
    });
    await appendEvent(tenant, { acted: [`replaced Sibyl memory with ${rows.length} BNPL relationships`] });
    const rels = (await listRels(tenant)).map(bodyRel);
    rels.sort((a, b) => String(b.last_seen || "").localeCompare(String(a.last_seen || "")));
    return { ok: true, health: await health(tenant), relationships: rels };
  }

  if (op === "wipe") {
    await wipeTenant(tenant);
    return {
      ok: true,
      health: await health(tenant),
      actions: [],
      counterparties: 0,
      relationships: [],
    };
  }

  if (op === "replace") {
    await wipeTenant(tenant);
    const rows = (msg.actions as Body[]) || [];
    for (const row of rows) await setEntity(tenant, "action", String(row.id), row);
    const rebuilt = await listActions(tenant);
    await rebuildWarm(tenant, rebuilt);
    await patchState(tenant, "seeded", { ok: true, count: rows.length });
    await setReference(tenant, "policy", {
      proceed: "<0.30",
      flag: "0.30-0.60",
      hold: ">0.60",
      note: "Code maps RISK_SCORE. Alex cannot change the decision.",
    });
    await appendEvent(tenant, { acted: [`replaced Sibyl memory with ${rows.length} seed actions`] });
    return { ok: true, health: await health(tenant), actions: rebuilt };
  }

  return { ok: false, error: `unknown op ${op}` };
}
