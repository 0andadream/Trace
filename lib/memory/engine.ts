import { emptyBucket, loadRoot, persistLabel, saveRoot, type TenantBucket } from "@/lib/memory/persist";

type Msg = Record<string, unknown>;
type Body = Record<string, unknown>;

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

function listCategory(bucket: TenantBucket, category: string, limit = 400): Body[] {
  const table = bucket.entities[category] || {};
  return Object.values(table).slice(0, limit);
}

function getEntity(bucket: TenantBucket, category: string, name: string): Body | null {
  const row = bucket.entities[category]?.[name];
  return row ? { ...row } : null;
}

function setEntity(bucket: TenantBucket, category: string, name: string, body: Body) {
  if (!bucket.entities[category]) bucket.entities[category] = {};
  bucket.entities[category][name] = { ...body };
}

function deleteEntity(bucket: TenantBucket, category: string, name: string) {
  if (bucket.entities[category]) delete bucket.entities[category][name];
}

function writeEvent(bucket: TenantBucket, event: Body) {
  bucket.events.unshift({ ...event, ts: event.ts || new Date().toISOString() });
  bucket.events = bucket.events.slice(0, 100);
}

function bodyRel(row: Body): Body {
  const payload = { ...asBody(row) };
  delete payload.current_standing_score;
  delete payload.current_limit;
  return payload;
}

function rebuildWarm(bucket: TenantBucket, actions: Body[]) {
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
    setEntity(bucket, "counterparty", addr, body);
  }
  setEntity(bucket, "agent", "Alex", {
    totalActions: actions.length,
    successful: actions.filter((r) => r.outcome === "success").length,
    rejected: actions.filter((r) => r.outcome === "rejected").length,
    overrides: actions.filter((r) => r.userOverride).length,
    holds: actions.filter((r) => r.decision === "Hold for approval").length,
  });
}

function listActions(bucket: TenantBucket): Body[] {
  const rows = listCategory(bucket, "action", 400).map(scrubLabels);
  rows.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return rows;
}

function listRelationships(bucket: TenantBucket): Body[] {
  const rels = listCategory(bucket, "relationship", 400).map(bodyRel);
  rels.sort((a, b) => String(b.last_seen || "").localeCompare(String(a.last_seen || "")));
  return rels;
}

function persistRelationship(bucket: TenantBucket, rel: Body): Body {
  const addr = String(rel.wallet_address || "").trim().toLowerCase();
  if (!addr) throw new Error("relationship.wallet_address required");
  const stored = bodyRel({ ...rel, wallet_address: addr });
  setEntity(bucket, "relationship", addr, stored);
  writeEvent(bucket, {
    acted: [`relationship ${addr} purchases=${stored.total_purchases ?? stored.total_loans} last=${stored.last_seen}`],
    extra: { wallet: addr, total_purchases: stored.total_purchases ?? stored.total_loans },
    ts: stored.last_seen,
  });
  bucket.state.last_relationship = { wallet: addr, total_purchases: stored.total_purchases ?? stored.total_loans };
  return stored;
}

function persistAction(bucket: TenantBucket, row: Body, acted: string) {
  setEntity(bucket, "action", String(row.id), row);
  writeEvent(bucket, {
    acted: [acted],
    evaluated: { decision: row.decision, riskScore: row.riskScore },
    extra: { id: row.id, recipient: row.recipient, outcome: row.outcome },
    ts: row.at,
  });
  rebuildWarm(bucket, listActions(bucket));
  bucket.state.last_decision = { id: row.id, decision: row.decision };
}

function wipe(bucket: TenantBucket) {
  const cats = ["action", "counterparty", "agent", "relationship", "loan", "collateral", "quote", "purchase"];
  for (const c of cats) bucket.entities[c] = {};
  bucket.events = [];
  bucket.state = {};
  bucket.references = {};
}

function health(bucket: TenantBucket, tenant: string) {
  const actions = listCategory(bucket, "action", 400);
  const counterparties = listCategory(bucket, "counterparty", 400);
  const relationships = listCategory(bucket, "relationship", 400);
  return {
    engine: "sibyl-memory-node",
    db: persistLabel(),
    tenant,
    tier: "node",
    actionCount: actions.length,
    counterpartyCount: counterparties.length,
    relationshipCount: relationships.length,
    recentEvents: bucket.events.length,
    lastEvent: bucket.events[0] || null,
    freeTier: { mode: "node" },
    loadBearing: true,
  };
}

export async function handleSibylMessage(msg: Msg) {
  const op = msg.op;
  const tenant = String(msg.tenant || process.env.SIBYL_TENANT || "trace-alex");
  const root = await loadRoot();
  if (!root.tenants[tenant]) root.tenants[tenant] = emptyBucket();
  const bucket = root.tenants[tenant];
  const save = async (payload: Record<string, unknown>) => {
    await saveRoot(root);
    return payload;
  };

  if (op === "health") return save({ ok: true, health: health(bucket, tenant) });

  if (op === "list") {
    let actions = listActions(bucket);
    if (!actions.length && Array.isArray(msg.seed)) {
      for (const row of msg.seed as Body[]) setEntity(bucket, "action", String(row.id), row);
      rebuildWarm(bucket, listActions(bucket));
      bucket.state.seeded = { ok: true, count: (msg.seed as Body[]).length };
      bucket.references.policy = {
        proceed: "<0.30",
        flag: "0.30-0.60",
        hold: ">0.60",
        note: "Code maps RISK_SCORE. Alex cannot change the decision.",
      };
      writeEvent(bucket, { acted: ["seeded treasury operating history into Sibyl Memory"] });
      actions = listActions(bucket);
    }
    return save({ ok: true, actions, health: health(bucket, tenant) });
  }

  if (op === "append") {
    const row = msg.row as Body;
    persistAction(
      bucket,
      row,
      `${row.decision} ${row.action} ${row.amount} ${row.token} -> ${row.counterpartyLabel}`,
    );
    return save({ ok: true, row, health: health(bucket, tenant) });
  }

  if (op === "update") {
    const actionId = String(msg.id);
    const current = getEntity(bucket, "action", actionId);
    if (!current) return save({ ok: true, row: null });
    const updated: Body = { ...current, ...((msg.patch as Body) || {}), id: actionId };
    persistAction(bucket, updated, `resolve ${updated.id} -> ${updated.outcome} override=${updated.userOverride}`);
    return save({ ok: true, row: updated, health: health(bucket, tenant) });
  }

  if (op === "get") {
    const entity = getEntity(bucket, String(msg.category), String(msg.name));
    return save({ ok: true, entity });
  }

  if (op === "list_relationships") {
    return save({ ok: true, relationships: listRelationships(bucket), health: health(bucket, tenant) });
  }

  if (op === "get_relationship") {
    const addr = String(msg.wallet || "").trim().toLowerCase();
    const row = getEntity(bucket, "relationship", addr);
    return save({
      ok: true,
      relationship: row ? bodyRel(row) : null,
      health: health(bucket, tenant),
    });
  }

  if (op === "upsert_relationship") {
    const rel = persistRelationship(bucket, msg.relationship as Body);
    return save({ ok: true, relationship: rel, health: health(bucket, tenant) });
  }

  if (op === "replace_relationships") {
    wipe(bucket);
    const rows = (msg.relationships as Body[]) || [];
    const stored = rows.map((rel) => persistRelationship(bucket, rel));
    bucket.state.seeded = { ok: true, kind: "bnpl", count: stored.length };
    bucket.references.bnpl_policy = {
      primary: "USER_RELATIONSHIP",
      secondary: "ONCHAIN_SIGNAL only when total_purchases == 0",
      note: "Code computes limit, installments, and decision. Alex cannot change the numbers.",
    };
    writeEvent(bucket, { acted: [`replaced Sibyl memory with ${stored.length} BNPL relationships`] });
    return save({ ok: true, health: health(bucket, tenant), relationships: listRelationships(bucket) });
  }

  if (op === "wipe") {
    wipe(bucket);
    return save({
      ok: true,
      health: health(bucket, tenant),
      actions: [],
      counterparties: 0,
      relationships: [],
    });
  }

  if (op === "replace") {
    wipe(bucket);
    const rows = (msg.actions as Body[]) || [];
    for (const row of rows) setEntity(bucket, "action", String(row.id), row);
    const rebuilt = listActions(bucket);
    rebuildWarm(bucket, rebuilt);
    bucket.state.seeded = { ok: true, count: rows.length };
    bucket.references.policy = {
      proceed: "<0.30",
      flag: "0.30-0.60",
      hold: ">0.60",
      note: "Code maps RISK_SCORE. Alex cannot change the decision.",
    };
    writeEvent(bucket, { acted: [`replaced Sibyl memory with ${rows.length} seed actions`] });
    return save({ ok: true, health: health(bucket, tenant), actions: rebuilt });
  }

  return { ok: false, error: `unknown op ${op}` };
}
