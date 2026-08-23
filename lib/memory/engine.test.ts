import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleSibylMessage } from "@/lib/memory/engine";

describe("node Sibyl engine (Vercel fallback)", () => {
  it("stores and recalls a relationship without Python", async () => {
    delete (globalThis as typeof globalThis & { __traceSibyl?: unknown }).__traceSibyl;
    process.env.SIBYL_FORCE_NODE = "1";
    process.env.SIBYL_TENANT = "trace-node-test";
    process.env.SIBYL_MEMORY_JSON = `/tmp/trace-sibyl-node-${Date.now()}.json`;
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;

    await handleSibylMessage({ op: "wipe", tenant: "trace-node-test" });
    const saved = await handleSibylMessage({
      op: "upsert_relationship",
      tenant: "trace-node-test",
      relationship: {
        wallet_address: "0xabc",
        total_purchases: 1,
        on_time_count: 1,
        purchases: [{ purchase_id: "p1", amount: 12, outcome: "completed_on_time" }],
      },
    });
    assert.equal(saved.ok, true);
    const got = await handleSibylMessage({
      op: "get_relationship",
      tenant: "trace-node-test",
      wallet: "0xAbC",
    });
    assert.equal((got.relationship as { wallet_address: string }).wallet_address, "0xabc");
    assert.equal((got.health as { loadBearing: boolean; engine: string }).loadBearing, true);
    assert.equal((got.health as { engine: string }).engine, "sibyl-memory-node");
  });
});
