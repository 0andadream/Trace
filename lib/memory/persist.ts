import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

export class StoreUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreUnavailable";
  }
}

export type Body = Record<string, unknown>;

export type TenantBucket = {
  entities: Record<string, Record<string, Body>>;
  events: Body[];
  state: Body;
  references: Body;
};

export type MemoryRoot = {
  tenants: Record<string, TenantBucket>;
};

type Versioned<T> = { v: number; data: T };

const LEGACY_BLOB = "trace-sibyl-store";
const PREFIX = "sibyl";

function filePath() {
  const raw = process.env.SIBYL_MEMORY_JSON;
  if (raw) return raw;
  return path.join(process.cwd(), ".data/sibyl-memory.json");
}

export function emptyBucket(): TenantBucket {
  return { entities: {}, events: [], state: {}, references: {} };
}

function emptyRoot(): MemoryRoot {
  return { tenants: {} };
}

function kvCreds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function kvEnabled() {
  return Boolean(kvCreds());
}

export function kvRequired() {
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-production-compile") {
    return false;
  }
  return process.env.VERCEL === "1" || process.env.SIBYL_REQUIRE_KV === "1";
}

function kvClient() {
  const creds = kvCreds();
  if (!creds) {
    if (kvRequired()) {
      throw new StoreUnavailable(
        "Sibyl Memory Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*).",
      );
    }
    return null;
  }
  return new Redis({ url: creds.url, token: creds.token });
}

function k(tenant: string, ...parts: string[]) {
  return [PREFIX, tenant, ...parts].join(":");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withLock<T>(redis: Redis, lockKey: string, fn: () => Promise<T>): Promise<T> {
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  for (let i = 0; i < 8; i++) {
    const ok = await redis.set(lockKey, token, { nx: true, ex: 8 });
    if (ok) {
      try {
        return await fn();
      } finally {
        const cur = await redis.get<string>(lockKey);
        if (cur === token) await redis.del(lockKey);
      }
    }
    await sleep(40 * (i + 1));
  }
  throw new StoreUnavailable("Sibyl Memory is busy (lock timeout). Retry the request.");
}

async function pingRedis(redis: Redis) {
  try {
    await redis.ping();
  } catch (err) {
    throw new StoreUnavailable(
      `Sibyl Memory Redis is unreachable (${err instanceof Error ? err.message : "ping failed"}).`,
    );
  }
}

const g = globalThis as typeof globalThis & { __traceSibyl?: MemoryRoot; __traceSibylMigrated?: boolean };

function readFileRoot(): MemoryRoot {
  const p = filePath();
  if (!existsSync(p)) return emptyRoot();
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as MemoryRoot;
    if (!parsed?.tenants) return emptyRoot();
    return parsed;
  } catch {
    return emptyRoot();
  }
}

function writeFileRoot(root: MemoryRoot) {
  const p = filePath();
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(root));
}

function fileRoot(): MemoryRoot {
  if (!g.__traceSibyl) g.__traceSibyl = readFileRoot();
  return g.__traceSibyl;
}

async function migrateLegacyBlob(redis: Redis) {
  if (g.__traceSibylMigrated) return;
  const blob = await redis.get<MemoryRoot>(LEGACY_BLOB);
  g.__traceSibylMigrated = true;
  if (!blob?.tenants) return;
  for (const [tenant, bucket] of Object.entries(blob.tenants)) {
    const rels = bucket.entities?.relationship || {};
    for (const [wallet, data] of Object.entries(rels)) {
      const key = k(tenant, "rel", wallet);
      const existing = await redis.get(key);
      if (existing == null) {
        await redis.set(key, { v: 1, data } satisfies Versioned<Body>);
        await redis.sadd(k(tenant, "rel", "index"), wallet);
      }
    }
    const actions = bucket.entities?.action || {};
    for (const [id, data] of Object.entries(actions)) {
      const key = k(tenant, "action", id);
      if ((await redis.get(key)) == null) {
        await redis.set(key, data);
        await redis.sadd(k(tenant, "action", "index"), id);
      }
    }
    const cps = bucket.entities?.counterparty || {};
    for (const [addr, data] of Object.entries(cps)) {
      const key = k(tenant, "cp", addr);
      if ((await redis.get(key)) == null) {
        await redis.set(key, data);
        await redis.sadd(k(tenant, "cp", "index"), addr);
      }
    }
    if (bucket.entities?.agent?.Alex && (await redis.get(k(tenant, "agent"))) == null) {
      await redis.set(k(tenant, "agent"), bucket.entities.agent.Alex);
    }
    if ((await redis.get(k(tenant, "events"))) == null) await redis.set(k(tenant, "events"), bucket.events || []);
    if ((await redis.get(k(tenant, "state"))) == null) await redis.set(k(tenant, "state"), bucket.state || {});
    if ((await redis.get(k(tenant, "refs"))) == null) await redis.set(k(tenant, "refs"), bucket.references || {});
  }
}

export async function pingStore() {
  const redis = kvClient();
  if (!redis) {
    if (kvRequired()) {
      throw new StoreUnavailable("Sibyl Memory Redis is not configured on this host.");
    }
    return { ok: true as const, backend: "file" as const, label: filePath() };
  }
  await pingRedis(redis);
  await migrateLegacyBlob(redis);
  return { ok: true as const, backend: "kv" as const, label: "kv", persistence: "upstash-redis" };
}

export async function getRel(tenant: string, wallet: string): Promise<Body | null> {
  const addr = wallet.trim().toLowerCase();
  const redis = kvClient();
  if (!redis) {
    const data = fileRoot().tenants[tenant]?.entities?.relationship?.[addr];
    return data ? { ...data } : null;
  }
  await migrateLegacyBlob(redis);
  const row = await redis.get<Versioned<Body> | Body>(k(tenant, "rel", addr));
  if (!row) return null;
  if (typeof row === "object" && "data" in row && row.data) return { ...(row.data as Body) };
  return { ...(row as Body) };
}

export async function deleteRel(tenant: string, wallet: string): Promise<boolean> {
  const addr = wallet.trim().toLowerCase();
  if (!addr) return false;
  const redis = kvClient();
  if (!redis) {
    const root = fileRoot();
    const table = root.tenants[tenant]?.entities?.relationship;
    if (!table || !table[addr]) return false;
    delete table[addr];
    writeFileRoot(root);
    return true;
  }
  await migrateLegacyBlob(redis);
  const key = k(tenant, "rel", addr);
  const existed = (await redis.get(key)) != null;
  await redis.del(key);
  await redis.srem(k(tenant, "rel", "index"), addr);
  return existed;
}

export async function putRel(tenant: string, rel: Body): Promise<Body> {
  const addr = String(rel.wallet_address || "").trim().toLowerCase();
  if (!addr) throw new Error("relationship.wallet_address required");
  const stored = { ...rel, wallet_address: addr };
  const redis = kvClient();
  if (!redis) {
    const root = fileRoot();
    if (!root.tenants[tenant]) root.tenants[tenant] = emptyBucket();
    const bucket = root.tenants[tenant];
    if (!bucket.entities.relationship) bucket.entities.relationship = {};
    bucket.entities.relationship[addr] = stored;
    writeFileRoot(root);
    return stored;
  }
  await migrateLegacyBlob(redis);
  const key = k(tenant, "rel", addr);
  await withLock(redis, `${key}:lock`, async () => {
    const cur = await redis.get<Versioned<Body>>(key);
    const v = cur && typeof cur === "object" && typeof cur.v === "number" ? cur.v : 0;
    await redis.set(key, { v: v + 1, data: stored } satisfies Versioned<Body>);
    await redis.sadd(k(tenant, "rel", "index"), addr);
  });
  return stored;
}

export async function listRels(tenant: string): Promise<Body[]> {
  const redis = kvClient();
  if (!redis) {
    const table = fileRoot().tenants[tenant]?.entities?.relationship || {};
    return Object.values(table).map((r) => ({ ...r }));
  }
  await migrateLegacyBlob(redis);
  const wallets = (await redis.smembers(k(tenant, "rel", "index"))) as string[];
  if (!wallets.length) return [];
  const keys = wallets.map((w) => k(tenant, "rel", String(w).toLowerCase()));
  const rows = (await redis.mget(...keys)) as (Versioned<Body> | Body | null)[];
  const out: Body[] = [];
  for (const row of rows || []) {
    if (!row) continue;
    if (typeof row === "object" && "data" in row && row.data) out.push({ ...(row.data as Body) });
    else out.push({ ...(row as Body) });
  }
  return out;
}

export async function getEntity(tenant: string, category: string, name: string): Promise<Body | null> {
  if (category === "relationship") return getRel(tenant, name);
  const redis = kvClient();
  if (!redis) {
    const data = fileRoot().tenants[tenant]?.entities?.[category]?.[name];
    return data ? { ...data } : null;
  }
  await migrateLegacyBlob(redis);
  if (category === "action") {
    const row = await redis.get<Body>(k(tenant, "action", name));
    return row ? { ...row } : null;
  }
  if (category === "counterparty") {
    const row = await redis.get<Body>(k(tenant, "cp", name));
    return row ? { ...row } : null;
  }
  if (category === "agent") {
    const row = await redis.get<Body>(k(tenant, "agent"));
    return row ? { ...row } : null;
  }
  const row = await redis.get<Body>(k(tenant, category, name));
  return row ? { ...row } : null;
}

export async function setEntity(tenant: string, category: string, name: string, body: Body) {
  if (category === "relationship") {
    await putRel(tenant, { ...body, wallet_address: name });
    return;
  }
  const redis = kvClient();
  if (!redis) {
    const root = fileRoot();
    if (!root.tenants[tenant]) root.tenants[tenant] = emptyBucket();
    const bucket = root.tenants[tenant];
    if (!bucket.entities[category]) bucket.entities[category] = {};
    bucket.entities[category][name] = { ...body };
    writeFileRoot(root);
    return;
  }
  await migrateLegacyBlob(redis);
  if (category === "action") {
    await redis.set(k(tenant, "action", name), body);
    await redis.sadd(k(tenant, "action", "index"), name);
    return;
  }
  if (category === "counterparty") {
    await redis.set(k(tenant, "cp", name), body);
    await redis.sadd(k(tenant, "cp", "index"), name);
    return;
  }
  if (category === "agent") {
    await redis.set(k(tenant, "agent"), body);
    return;
  }
  await redis.set(k(tenant, category, name), body);
  await redis.sadd(k(tenant, category, "index"), name);
}

export async function listCategory(tenant: string, category: string, limit = 400): Promise<Body[]> {
  if (category === "relationship") return (await listRels(tenant)).slice(0, limit);
  const redis = kvClient();
  if (!redis) {
    const table = fileRoot().tenants[tenant]?.entities?.[category] || {};
    return Object.values(table).slice(0, limit);
  }
  await migrateLegacyBlob(redis);
  if (category === "action") {
    const ids = (await redis.smembers(k(tenant, "action", "index"))) as string[];
    if (!ids.length) return [];
    const rows = (await redis.mget(...ids.map((id) => k(tenant, "action", String(id))))) as (Body | null)[];
    return (rows || []).filter(Boolean).slice(0, limit) as Body[];
  }
  if (category === "counterparty") {
    const ids = (await redis.smembers(k(tenant, "cp", "index"))) as string[];
    if (!ids.length) return [];
    const rows = (await redis.mget(...ids.map((id) => k(tenant, "cp", String(id))))) as (Body | null)[];
    return (rows || []).filter(Boolean).slice(0, limit) as Body[];
  }
  if (category === "agent") {
    const row = await redis.get<Body>(k(tenant, "agent"));
    return row ? [row] : [];
  }
  const ids = (await redis.smembers(k(tenant, category, "index"))) as string[];
  if (!ids.length) return [];
  const rows = (await redis.mget(...ids.map((id) => k(tenant, category, String(id))))) as (Body | null)[];
  return (rows || []).filter(Boolean).slice(0, limit) as Body[];
}

export async function appendEvent(tenant: string, event: Body) {
  const redis = kvClient();
  if (!redis) {
    const root = fileRoot();
    if (!root.tenants[tenant]) root.tenants[tenant] = emptyBucket();
    root.tenants[tenant].events.unshift(event);
    root.tenants[tenant].events = root.tenants[tenant].events.slice(0, 100);
    writeFileRoot(root);
    return;
  }
  await migrateLegacyBlob(redis);
  const key = k(tenant, "events");
  await withLock(redis, `${key}:lock`, async () => {
    const cur = ((await redis.get<Body[]>(key)) || []) as Body[];
    cur.unshift(event);
    await redis.set(key, cur.slice(0, 100));
  });
}

export async function readEvents(tenant: string, limit = 20): Promise<Body[]> {
  const redis = kvClient();
  if (!redis) return (fileRoot().tenants[tenant]?.events || []).slice(0, limit);
  await migrateLegacyBlob(redis);
  const cur = ((await redis.get<Body[]>(k(tenant, "events"))) || []) as Body[];
  return cur.slice(0, limit);
}

export async function patchState(tenant: string, keyName: string, value: unknown) {
  const redis = kvClient();
  if (!redis) {
    const root = fileRoot();
    if (!root.tenants[tenant]) root.tenants[tenant] = emptyBucket();
    root.tenants[tenant].state[keyName] = value as Body;
    writeFileRoot(root);
    return;
  }
  await migrateLegacyBlob(redis);
  const key = k(tenant, "state");
  await withLock(redis, `${key}:lock`, async () => {
    const cur = ((await redis.get<Body>(key)) || {}) as Body;
    cur[keyName] = value as Body;
    await redis.set(key, cur);
  });
}

export async function setReference(tenant: string, name: string, value: unknown) {
  const redis = kvClient();
  if (!redis) {
    const root = fileRoot();
    if (!root.tenants[tenant]) root.tenants[tenant] = emptyBucket();
    root.tenants[tenant].references[name] = value as Body;
    writeFileRoot(root);
    return;
  }
  await migrateLegacyBlob(redis);
  const key = k(tenant, "refs");
  await withLock(redis, `${key}:lock`, async () => {
    const cur = ((await redis.get<Body>(key)) || {}) as Body;
    cur[name] = value as Body;
    await redis.set(key, cur);
  });
}

export async function wipeTenant(tenant: string) {
  const redis = kvClient();
  if (!redis) {
    const root = fileRoot();
    root.tenants[tenant] = emptyBucket();
    writeFileRoot(root);
    return;
  }
  await migrateLegacyBlob(redis);
  const rels = ((await redis.smembers(k(tenant, "rel", "index"))) as string[]) || [];
  const actions = ((await redis.smembers(k(tenant, "action", "index"))) as string[]) || [];
  const cps = ((await redis.smembers(k(tenant, "cp", "index"))) as string[]) || [];
  const keys = [
    ...rels.map((w) => k(tenant, "rel", String(w).toLowerCase())),
    ...actions.map((id) => k(tenant, "action", String(id))),
    ...cps.map((id) => k(tenant, "cp", String(id))),
    k(tenant, "rel", "index"),
    k(tenant, "action", "index"),
    k(tenant, "cp", "index"),
    k(tenant, "agent"),
    k(tenant, "events"),
    k(tenant, "state"),
    k(tenant, "refs"),
  ];
  if (keys.length) await redis.del(...keys);
}

export async function exportAll(): Promise<MemoryRoot> {
  const redis = kvClient();
  if (!redis) return structuredClone(fileRoot());
  await pingRedis(redis);
  await migrateLegacyBlob(redis);
  const root: MemoryRoot = { tenants: {} };
  const tenants = new Set<string>([process.env.SIBYL_TENANT || "trace-alex"]);
  const blob = await redis.get<MemoryRoot>(LEGACY_BLOB);
  if (blob?.tenants) Object.keys(blob.tenants).forEach((t) => tenants.add(t));
  for (const tenant of tenants) {
    const bucket = emptyBucket();
    bucket.entities.relationship = {};
    for (const rel of await listRels(tenant)) {
      const addr = String(rel.wallet_address || "").toLowerCase();
      if (addr) bucket.entities.relationship[addr] = rel;
    }
    bucket.entities.action = {};
    for (const row of await listCategory(tenant, "action", 10_000)) {
      const id = String(row.id || "");
      if (id) bucket.entities.action[id] = row;
    }
    bucket.entities.counterparty = {};
    for (const row of await listCategory(tenant, "counterparty", 10_000)) {
      const addr = String(row.address || "");
      if (addr) bucket.entities.counterparty[addr] = row;
    }
    const agent = await redis.get<Body>(k(tenant, "agent"));
    bucket.entities.agent = agent ? { Alex: agent } : {};
    bucket.events = ((await redis.get<Body[]>(k(tenant, "events"))) || []) as Body[];
    bucket.state = ((await redis.get<Body>(k(tenant, "state"))) || {}) as Body;
    bucket.references = ((await redis.get<Body>(k(tenant, "refs"))) || {}) as Body;
    root.tenants[tenant] = bucket;
  }
  return root;
}

export function persistLabel() {
  if (kvEnabled()) return "kv";
  return filePath();
}
