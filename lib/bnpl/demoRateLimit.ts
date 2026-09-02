import { kvEnabled } from "@/lib/memory/persist";

const DEFAULT_WINDOW_SEC = 180;
const LOCK_TTL_SEC = 240;
const memoryHits = new Map<string, number>();
let inProcessLocked = false;
let redisLockHeld = false;

function prune(now: number) {
  for (const [k, exp] of memoryHits) {
    if (exp <= now) memoryHits.delete(k);
  }
}

async function redisClient() {
  const { Redis } = await import("@upstash/redis");
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return new Redis({ url, token });
}

export function demoRateWindowSec() {
  const n = Number(process.env.DEMO_RATE_WINDOW_SEC ?? DEFAULT_WINDOW_SEC);
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : DEFAULT_WINDOW_SEC;
}

export async function checkDemoRateLimit(ip: string): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const now = Date.now();
  const windowSec = demoRateWindowSec();
  const key = (ip || "unknown").slice(0, 128);
  prune(now);
  if (kvEnabled()) {
    try {
      const redis = await redisClient();
      const redisKey = `sibyl:demo:ip:${key}`;
      const acquired = await redis.set(redisKey, String(now), { nx: true, ex: windowSec });
      if (acquired === null) {
        const ttl = await redis.ttl(redisKey);
        return { ok: false, retryAfterSec: Math.max(1, ttl) };
      }
      return { ok: true };
    } catch {
      // fall through to memory
    }
  }
  const exp = memoryHits.get(key);
  if (exp && exp > now) {
    return { ok: false, retryAfterSec: Math.ceil((exp - now) / 1000) };
  }
  memoryHits.set(key, now + windowSec * 1000);
  return { ok: true };
}

export async function tryAcquireDemoLock(): Promise<boolean> {
  if (inProcessLocked) return false;
  if (kvEnabled()) {
    try {
      const redis = await redisClient();
      const acquired = await redis.set("sibyl:demo:lock", "1", { nx: true, ex: LOCK_TTL_SEC });
      if (acquired === null) return false;
      redisLockHeld = true;
    } catch {
      // fall through to in-process lock
    }
  }
  inProcessLocked = true;
  return true;
}

export async function releaseDemoLock() {
  inProcessLocked = false;
  if (redisLockHeld) {
    redisLockHeld = false;
    try {
      const redis = await redisClient();
      await redis.del("sibyl:demo:lock");
    } catch {
      // lock expires via TTL
    }
  }
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
