import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FRESH_WALLET, TREASURY_VAULT } from "@/lib/counterparties";
import { EMPTY_CP } from "@/lib/agent/reason";
import { deterministicReasoning, enforceVerdict, parseAlexOutput } from "@/lib/agent/reason";
import { buildCounterpartyProfile, buildReputation } from "@/lib/memory/derive";
import { SEED_ACTIONS } from "@/lib/memory/seed";
import { decideFromScore } from "@/lib/policy/decide";
import { computeRiskScore } from "@/lib/risk/score";
import type { ActionRecord, AgentReputation, TreasuryRequest } from "@/types";

const typical: TreasuryRequest = {
  action: "transfer",
  token: "USDT",
  amount: 500,
  recipient: TREASURY_VAULT,
};

const oversized: TreasuryRequest = {
  action: "transfer",
  token: "USDT",
  amount: 2400,
  recipient: TREASURY_VAULT,
};

const unknown: TreasuryRequest = {
  action: "transfer",
  token: "USDT",
  amount: 400,
  recipient: FRESH_WALLET,
};

function scoreFor(request: TreasuryRequest, actions = SEED_ACTIONS) {
  const reputation = buildReputation(actions);
  const profile = buildCounterpartyProfile(actions, request.recipient);
  const assessment = computeRiskScore(request, reputation, profile);
  return { reputation, profile, assessment, decision: decideFromScore(assessment.score) };
}

describe("seeded reputation", () => {
  it("counts 24 actions with 2 unverified rejections and 1 hold override", () => {
    const r = buildReputation(SEED_ACTIONS);
    assert.equal(r.totalActions, 24);
    assert.equal(r.successfulActions, 22);
    assert.equal(r.rejectedActions, 2);
    assert.equal(r.userOverrides, 1);
    assert.equal(r.rejectedUnverifiedCount, 2);
    assert.equal(r.thinHistory, false);
    assert.equal(r.byActionType.transfer.count, 22);
    assert.equal(r.byActionType.swap.count, 2);
    assert.equal(r.byActionType.approve.count, 0);
  });
});

describe("risk policy on seed history", () => {
  it("typical vault transfer proceeds", () => {
    const { assessment, decision, profile } = scoreFor(typical);
    assert.ok(profile && profile.interactionCount === 16);
    assert.ok(assessment.score < 0.3, `expected < 0.30, got ${assessment.score}`);
    assert.equal(decision, "Proceed");
  });

  it("oversized vault transfer is flagged", () => {
    const { assessment, decision } = scoreFor(oversized);
    assert.ok(assessment.score >= 0.3 && assessment.score <= 0.6, `got ${assessment.score}`);
    assert.equal(decision, "Proceed with flag");
    assert.ok(assessment.factors.some((f) => f.id === "amount_deviation"));
  });

  it("unknown recipient is held and cites empty counterparty", () => {
    const { assessment, decision, profile } = scoreFor(unknown);
    assert.equal(profile, null);
    assert.ok(assessment.score > 0.6, `got ${assessment.score}`);
    assert.equal(decision, "Hold for approval");
    assert.ok(assessment.factors.some((f) => f.id === "unknown_counterparty"));
    assert.ok(assessment.factors.some((f) => f.id === "similar_unverified_rejected"));

    const verdict = deterministicReasoning({
      request: unknown,
      reputation: buildReputation(SEED_ACTIONS),
      profile: null,
      assessment,
    });
    assert.equal(verdict.reasoning[0], EMPTY_CP);
    assert.ok(verdict.reasoning.some((line) => /rejected in 2 previous/.test(line)));
  });
});

describe("thin history", () => {
  it("holds when the agent has fewer than 3 actions", () => {
    const thin: ActionRecord[] = SEED_ACTIONS.slice(0, 2);
    const { assessment, decision, reputation } = scoreFor(typical, thin);
    assert.equal(reputation.thinHistory, true);
    assert.ok(assessment.score > 0.6);
    assert.equal(decision, "Hold for approval");
    assert.ok(assessment.factors.some((f) => f.id === "thin_history" || f.id === "insufficient_evidence"));
  });
});

describe("high override rate", () => {
  it("upgrades a flag to hold when hold-override rate is high", () => {
    const base = scoreFor(oversized);
    assert.equal(base.decision, "Proceed with flag");

    const extraHolds: ActionRecord[] = [0, 1, 2, 3].map((i) => ({
      id: `hold-ov-${i}`,
      at: `2026-08-18T0${i}:00:00.000Z`,
      action: "transfer" as const,
      token: "USDT",
      amount: 100,
      recipient: `0x${(i + 10).toString(16).padStart(40, "0")}`,
      counterpartyLabel: "Other",
      outcome: "success" as const,
      decision: "Hold for approval" as const,
      riskScore: 0.7,
      userOverride: true,
      overrideDirection: "approved" as const,
      seed: true,
      reasoning: [],
    }));
    const actions = [...SEED_ACTIONS, ...extraHolds];
    const reputation = buildReputation(actions);
    assert.ok(reputation.holdOverrideRate >= 0.4);
    assert.ok(reputation.holdDecisions >= 3);

    const { assessment, decision } = scoreFor(oversized, actions);
    assert.equal(decision, "Hold for approval");
    assert.ok(assessment.score > 0.6);
    assert.ok(assessment.factors.some((f) => f.id === "high_override_rate" || f.id === "override_upgrade_hold"));
  });
});

describe("memory changes the decision", () => {
  it("unknown address proceeds after a recorded success", () => {
    const first = scoreFor(unknown);
    assert.equal(first.decision, "Hold for approval");

    const learned: ActionRecord = {
      id: "learned",
      at: "2026-08-21T00:00:00.000Z",
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
      reasoning: [],
    };
    const second = scoreFor(unknown, [...SEED_ACTIONS, learned]);
    assert.ok(second.profile && second.profile.interactionCount === 1);
    assert.ok(second.assessment.score < first.assessment.score);
    assert.notEqual(second.decision, "Hold for approval");
  });
});

describe("decision mapping", () => {
  it("maps the published thresholds", () => {
    assert.equal(decideFromScore(0), "Proceed");
    assert.equal(decideFromScore(0.29), "Proceed");
    assert.equal(decideFromScore(0.3), "Proceed with flag");
    assert.equal(decideFromScore(0.6), "Proceed with flag");
    assert.equal(decideFromScore(0.61), "Hold for approval");
    assert.equal(decideFromScore(1), "Hold for approval");
  });
});

describe("alex output enforcement", () => {
  it("forces computed decision and injects empty-counterparty sentence", () => {
    const reputation = buildReputation(SEED_ACTIONS);
    const assessment = computeRiskScore(unknown, reputation, null);
    const parsed = parseAlexOutput(
      "Decision: Proceed\n\nReasoning:\n- This looks normal.\n- I've seen this before.\n\nRisk: 0.01",
    );
    assert.ok(parsed);
    const enforced = enforceVerdict({
      parsed,
      request: unknown,
      reputation,
      profile: null,
      assessment,
      source: "grok-4.6",
      raw: "x",
    });
    assert.equal(enforced.decision, "Hold for approval");
    assert.equal(enforced.risk, assessment.score);
    assert.equal(enforced.reasoning[0], EMPTY_CP);
  });

  it("does not invent counts absent from memory", () => {
    const emptyRep: AgentReputation = buildReputation([]);
    const assessment = computeRiskScore(typical, emptyRep, null);
    const verdict = deterministicReasoning({
      request: typical,
      reputation: emptyRep,
      profile: null,
      assessment,
    });
    for (const line of verdict.reasoning) {
      assert.ok(!/\b3[0-9]\b/.test(line), line);
    }
    assert.ok(verdict.reasoning.some((l) => /0 recorded/.test(l) || /Thin operating history: 0/.test(l) || l === EMPTY_CP));
  });
});

describe("verification status", () => {
  it("does not change address-only counterparties", () => {
    const without = scoreFor(typical);
    assert.equal(without.profile?.verification, undefined);
    assert.ok(!without.assessment.factors.some((f) => f.id.startsWith("verification_")));
  });

  it("applies a modest penalty when verification is rejected", () => {
    const actions: ActionRecord[] = SEED_ACTIONS.map((row, i) =>
      i === 0
        ? { ...row, recipient: TREASURY_VAULT, verification: "rejected" as const, counterpartyLabel: "Vault" }
        : row,
    );
    // stamp verification on all vault rows so the profile picks it up
    const stamped = actions.map((row) =>
      row.recipient.toLowerCase() === TREASURY_VAULT.toLowerCase()
        ? { ...row, verification: "rejected" as const }
        : row,
    );
    const base = scoreFor(typical);
    const marked = scoreFor(typical, stamped);
    assert.equal(marked.profile?.verification, "rejected");
    assert.ok(marked.assessment.score > base.assessment.score);
    assert.ok(marked.assessment.factors.some((f) => f.id === "verification_rejected"));
    assert.equal(decideFromScore(marked.assessment.score), base.decision);
  });
});
