import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purchaseCeilingCheck } from "@/lib/bnpl/ceiling";

describe("BNPL ceilings", () => {
  it("blocks amounts above MAX_PURCHASE_AMOUNT regardless of memory", () => {
    process.env.MAX_PURCHASE_AMOUNT = "80";
    const over = purchaseCeilingCheck(81, 0);
    assert.equal(over.blocked, true);
    assert.match(over.reason, /MAX_PURCHASE_AMOUNT/);
    const under = purchaseCeilingCheck(80, 0);
    assert.equal(under.blocked, false);
  });

  it("blocks a new plan at MAX_ACTIVE_PLANS regardless of score", () => {
    process.env.MAX_ACTIVE_PLANS = "2";
    const over = purchaseCeilingCheck(12, 2);
    assert.equal(over.blocked, true);
    assert.match(over.reason, /MAX_ACTIVE_PLANS/);
    const under = purchaseCeilingCheck(12, 1);
    assert.equal(under.blocked, false);
  });
});
