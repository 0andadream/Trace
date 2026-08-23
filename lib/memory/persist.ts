import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type TenantBucket = {
  entities: Record<string, Record<string, Record<string, unknown>>>;
  events: Record<string, unknown>[];
  state: Record<string, unknown>;
  references: Record<string, unknown>;
};

export type MemoryRoot = {
  tenants: Record<string, TenantBucket>;
};

const KV_KEY = "trace-sibyl-store";

function filePath() {
  if (process.env.VERCEL) return "/tmp/sibyl-memory.json";
  const raw = process.env.SIBYL_MEMORY_JSON;
  if (raw) return raw;
  return path.join(process.cwd(), ".data/sibyl-memory.json");
}

function emptyRoot(): MemoryRoot {
  return { tenants: {} };
}

export function emptyBucket(): TenantBucket {
  return { entities: {}, events: [], state: {}, references: {} };
}

function kvCreds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function kvGet(): Promise<MemoryRoot | null> {
  const kv = kvCreds();
  if (!kv) return null;
  const res = await fetch(kv.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["GET", KV_KEY]),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | null };
  if (!data.result) return null;
  try {
    return JSON.parse(data.result) as MemoryRoot;
  } catch {
    return null;
  }
}

async function kvSet(root: MemoryRoot) {
  const kv = kvCreds();
  if (!kv) return;
  await fetch(kv.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["SET", KV_KEY, JSON.stringify(root)]),
    cache: "no-store",
  });
}

function readFileRoot(): MemoryRoot | null {
  const p = filePath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as MemoryRoot;
  } catch {
    return null;
  }
}

function writeFileRoot(root: MemoryRoot) {
  const p = filePath();
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(root));
}

const g = globalThis as typeof globalThis & { __traceSibyl?: MemoryRoot };

export async function loadRoot(): Promise<MemoryRoot> {
  if (g.__traceSibyl) return g.__traceSibyl;
  const fromKv = await kvGet();
  const root = fromKv || readFileRoot() || emptyRoot();
  g.__traceSibyl = root;
  return root;
}

export async function saveRoot(root: MemoryRoot) {
  g.__traceSibyl = root;
  writeFileRoot(root);
  await kvSet(root);
}

export function persistLabel() {
  if (kvCreds()) return "kv";
  return filePath();
}
