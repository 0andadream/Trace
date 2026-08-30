import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPublicMetadata,
  decisionReasonFromBook,
  publicJobMetadata,
  repaymentStatusFromRel,
} from "@/lib/virtuals/metadata";
import { ACP_CONTRACT, ACP_OFFERING } from "@/lib/virtuals/acp";

describe("Virtuals ACP metadata", () => {
  it("only publishes non-secret TRACE job fields", () => {
    const meta = publicJobMetadata({
      wallet: "0xABCDef0000000000000000000000000000000001",
      loanAmount: 12,
      creditDecision: 24,
      memoryVerified: false,
      repaymentStatus: "NONE",
      decisionReason: "NO_REPAYMENT_HISTORY",
    });
    assert.equal(meta.product, "TRACE");
    assert.equal(meta.agent, "Alex");
    assert.equal(meta.purpose, "BNPL settlement");
    assert.equal(meta.memoryProvider, "Sibyl");
    assert.equal(meta.user, "0xabcdef0000000000000000000000000000000001");
    assert.equal(meta.amount, 12);
    assert.equal(meta.creditLimit, 24);
    assert.equal(ACP_OFFERING, "BNPL Settlement");
    assert.equal(ACP_CONTRACT[84532], "0x0b93793923CD5De81850aF8604a233f3f24d461e");
    const keys = Object.keys(meta).join(" ");
    assert.equal(/private|secret|password|mnemonic/i.test(keys), false);
  });

  it("refuses secret keys in public metadata", () => {
    assert.throws(() => assertPublicMetadata({ AGENT_PRIVATE_KEY: "0xabc" }), /secret field/i);
    assert.throws(() => assertPublicMetadata({ note: "BEGIN PRIVATE KEY" }), /private key/i);
  });

  it("maps repayment history without inventing a job", () => {
    assert.equal(repaymentStatusFromRel({}), "NONE");
    assert.equal(repaymentStatusFromRel({ on_time_count: 1 }), "ON_TIME");
    assert.equal(decisionReasonFromBook({}), "NO_REPAYMENT_HISTORY");
    assert.equal(decisionReasonFromBook({ on_time_count: 1, total_purchases: 1 }), "ON_TIME_REPAYMENT");
  });
});
