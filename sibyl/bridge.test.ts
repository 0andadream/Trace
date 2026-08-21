import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { FRESH_WALLET } from "@/lib/counterparties";
import { SEED_ACTIONS } from "@/lib/memory/seed";
import { callSibyl } from "@/lib/memory/sibyl";

describe("sibyl memory is load-bearing", () => {
  it("recalls seed, then a live override, then forgets when the db is gone", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trace-sibyl-"));
    const db = path.join(dir, "memory.db");
    process.env.SIBYL_MEMORY_DB = db;
    process.env.SIBYL_TENANT = "trace-test";

    try {
      const first = await callSibyl<{ actions: { id: string }[] }>("list", { seed: SEED_ACTIONS });
      assert.ok(first.health?.loadBearing);
      assert.equal(first.actions.length, 24);
      assert.equal(first.health?.engine, "sibyl-memory-client");

      await callSibyl("append", {
        row: {
          id: "live-learned",
          at: "2026-08-21T18:00:00.000Z",
          action: "transfer",
          token: "USDT",
          amount: 400,
          recipient: FRESH_WALLET,
          counterpartyLabel: "Learned",
          outcome: "success",
          decision: "Hold for approval",
          riskScore: 0.64,
          userOverride: true,
          overrideDirection: "approved",
          seed: false,
          reasoning: ["No prior interactions with this counterparty."],
        },
      });

      const recalled = await callSibyl<{ actions: { id: string; recipient: string }[] }>("list");
      assert.equal(recalled.actions.length, 25);
      assert.ok(recalled.actions.some((a) => a.id === "live-learned"));

      const cp = await callSibyl<{ entity: { name: string } | null }>("get", {
        category: "counterparty",
        name: FRESH_WALLET.toLowerCase(),
      });
      assert.ok(cp.entity, "learned counterparty must be a Sibyl entity");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    process.env.SIBYL_MEMORY_DB = db;
    const afterDelete = await callSibyl<{ actions: { id: string }[] }>("list", { seed: SEED_ACTIONS });
    assert.equal(afterDelete.actions.length, 24);
    assert.ok(!afterDelete.actions.some((a) => a.id === "live-learned"));
  });
});
