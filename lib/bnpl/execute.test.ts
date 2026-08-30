import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payoutIsLive, settlementPayoutLabel } from "@/lib/bnpl/execute";

describe("settlement payout status is one check", () => {
  it("treats BASE_EXECUTE=1 as live", () => {
    assert.equal(payoutIsLive("1"), true);
    assert.equal(payoutIsLive("true"), true);
    assert.equal(payoutIsLive(""), false);
    assert.equal(payoutIsLive("0"), false);
  });

  it("uses the same label for Under the hood and Agent infrastructure", () => {
    assert.equal(settlementPayoutLabel(true), "Live on Base Sepolia");
    assert.equal(settlementPayoutLabel(false), "Simulated on this testnet");
    assert.equal(settlementPayoutLabel(true).includes("simulated"), false);
    assert.equal(settlementPayoutLabel(true).includes("Checking"), false);
    assert.equal(settlementPayoutLabel(false).includes("Checking"), false);
  });
});
