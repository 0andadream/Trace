import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ceilingCheck } from "@/lib/policy/ceiling";

describe("transaction ceiling", () => {
  it("blocks USDC above MAX_TX_AMOUNT_USDC regardless of memory", () => {
    process.env.MAX_TX_AMOUNT_USDC = "25";
    const over = ceilingCheck({ token: "USDC", amount: 26 });
    assert.equal(over.blocked, true);
    assert.match(over.reason, /MAX_TX_AMOUNT_USDC/);
    const under = ceilingCheck({ token: "USDC", amount: 25 });
    assert.equal(under.blocked, false);
  });
});
