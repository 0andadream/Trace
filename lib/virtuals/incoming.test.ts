import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleAcpCreditJob, parseAcpRequirement } from "@/lib/virtuals/incoming";
import { computeApproval } from "@/lib/bnpl/policy";
import { emptyRelationship } from "@/lib/bnpl/relationship";
import { emptyOnchainSignal } from "@/lib/bnpl/onchain";
import { runPurchaseQuote } from "@/lib/bnpl/run";

describe("ACP job payload mapping", () => {
  it("maps the TRACE BNPL settlement job input onto a wallet + amount", () => {
    const req = parseAcpRequirement({
      wallet: "0xABCDef0000000000000000000000000000000001",
      loanAmount: 12,
      creditDecision: 24,
      memoryVerified: false,
      repaymentStatus: "NONE",
    });
    assert.equal(req.wallet, "0xabcdef0000000000000000000000000000000001");
    assert.equal(req.amount, 12);
    assert.equal(req.merchant, "ACP");
  });

  it("refuses a Virtuals agent UUID as the relationship key", () => {
    assert.throws(
      () => parseAcpRequirement({ wallet: "01a05400-aea9-7f70-a67e-f558448e86e3", amount: 12 }),
      /0x wallet/i,
    );
  });
});

describe("ACP path uses the same approval policy", () => {
  it("produces the same decision as computeApproval for an empty book", () => {
    const wallet = "0x3333333333333333333333333333333333333333";
    const amount = 12;
    const req = parseAcpRequirement({ wallet, loanAmount: amount });
    const terms = computeApproval({
      amount: req.amount,
      relationship: emptyRelationship(req.wallet),
      onchain: emptyOnchainSignal(req.wallet, { wallet_age_days: 40, tx_count: 12 }),
    });
    assert.equal(terms.decision === "Approve" || terms.decision === "Approve with reduced limit", true);
    assert.equal(terms.primary_signal, "ONCHAIN_SIGNAL");
  });

  it("handleAcpCreditJob quotes through the same engine as POST /api/purchase", async () => {
    delete (globalThis as typeof globalThis & { __traceSibyl?: unknown }).__traceSibyl;
    process.env.SIBYL_FORCE_NODE = "1";
    delete process.env.SIBYL_REQUIRE_KV;
    delete process.env.VERCEL;
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.SIBYL_TENANT = "trace-acp-test";
    process.env.SIBYL_MEMORY_JSON = `/tmp/trace-acp-${Date.now()}.json`;
    process.env.BASE_EXECUTE = "0";
    process.env.VIRTUALS_ACP = "0";

    const wallet = "0x4444444444444444444444444444444444444444";
    const buy = await runPurchaseQuote({ wallet, amount: 12, merchant: "Test Shop", persist: false });
    const acp = await handleAcpCreditJob({
      requirement: { wallet, loanAmount: 12 },
      accept: false,
      persist: false,
    });
    assert.equal(acp.quote.terms.decision, buy.terms.decision);
    assert.equal(acp.quote.terms.limit, buy.terms.limit);
    assert.equal(acp.quote.terms.primary_signal, buy.terms.primary_signal);
    assert.equal(acp.accepted, false);
    assert.equal(acp.channel, "acp");
  });
});
