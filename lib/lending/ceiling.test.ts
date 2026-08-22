import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCollateralFloor, borrowCeilingCheck } from "@/lib/lending/ceiling";

describe("lending ceilings", () => {
  it("blocks amounts above MAX_BORROW_AMOUNT regardless of memory", () => {
    process.env.MAX_BORROW_AMOUNT = "50";
    const over = borrowCeilingCheck(51);
    assert.equal(over.blocked, true);
    assert.match(over.reason, /MAX_BORROW_AMOUNT/);
    const under = borrowCeilingCheck(50);
    assert.equal(under.blocked, false);
  });

  it("collateral floor cannot be undercut by a computed ratio", () => {
    process.env.MIN_COLLATERAL_RATIO = "1.5";
    assert.equal(applyCollateralFloor(1.1), 1.5);
    assert.ok(applyCollateralFloor(2.0) >= 1.5);
  });
});
