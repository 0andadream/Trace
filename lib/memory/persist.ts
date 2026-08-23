import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

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

function kvClient() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function kvEnabled() {
  return Boolean(kvClient());
}

async function kvGet(): Promise<MemoryRoot | null> {
  const kv = kvClient();
  if (!kv) return null;
  const data = await kv.get<MemoryRoot>(KV_KEY);
  if (!data || typeof data !== "object" || !data.tenants) return null;
  return data;
}

async function kvSet(root: MemoryRoot) {
  const kv = kvClient();
  if (!kv) return;
  await kv.set(KV_KEY, root);
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
  if (kvEnabled()) {
    return (await kvGet()) || emptyRoot();
  }
  if (g.__traceSibyl) return g.__traceSibyl;
  const root = readFileRoot() || emptyRoot();
  g.__traceSibyl = root;
  return root;
}

export async function saveRoot(root: MemoryRoot) {
  if (kvEnabled()) {
    await kvSet(root);
    return;
  }
  g.__traceSibyl = root;
  writeFileRoot(root);
}

export function persistLabel() {
  if (kvEnabled()) return "kv";
  return filePath();
}
