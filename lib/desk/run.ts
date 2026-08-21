import { askAlex } from "@/lib/agent/alex";
import { formatVerdict } from "@/lib/agent/reason";
import { sendTransfer, skipped } from "@/lib/base/send";
import { requestFromBody } from "@/lib/desk/scenarios";
import { labelAddress } from "@/lib/format";
import { buildCounterpartyProfile, buildReputation, listCounterparties } from "@/lib/memory/derive";
import { appendAction, listActions, sibylHealth, updateAction } from "@/lib/memory/store";
import { computeRiskScore } from "@/lib/risk/score";
import type { ActionRecord, DecideRequestBody, DecideResult, Execution } from "@/types";

function newId() {
  return `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function shouldSend(decision: ActionRecord["decision"]) {
  return decision === "Proceed" || decision === "Proceed with flag";
}

export async function runDecide(body: DecideRequestBody): Promise<DecideResult> {
  const request = requestFromBody(body);
  const actions = await listActions();
  const reputation = buildReputation(actions);
  const profile = buildCounterpartyProfile(actions, request.recipient);
  const assessment = computeRiskScore(request, reputation, profile);
  const verdict = await askAlex({ request, reputation, profile, assessment });
  verdict.raw = formatVerdict(verdict);

  const at = new Date().toISOString();
  const id = newId();
  const pending: ActionRecord = {
    id,
    at,
    action: request.action,
    token: request.token,
    amount: request.amount,
    recipient: request.recipient,
    counterpartyLabel: profile?.label || labelAddress(request.recipient),
    outcome: verdict.decision === "Hold for approval" ? "pending" : "success",
    decision: verdict.decision,
    riskScore: assessment.score,
    userOverride: false,
    overrideDirection: null,
    seed: false,
    reasoning: verdict.reasoning,
    reasoningSource: verdict.source,
  };

  let tx: Execution = skipped("Not broadcast.");
  if (body.persist !== false && shouldSend(verdict.decision)) {
    tx = await sendTransfer(request);
    if (tx.txHash) {
      pending.txHash = tx.txHash;
      pending.explorerUrl = tx.explorerUrl;
    }
  } else if (verdict.decision === "Hold for approval") {
    tx = skipped("Held. Approve to broadcast.");
  }

  if (body.persist !== false) {
    await appendAction(pending);
  }

  const health = await sibylHealth();

  return {
    id,
    at,
    request,
    counterpartyLabel: pending.counterpartyLabel,
    memory: {
      AGENT_REPUTATION: reputation,
      COUNTERPARTY_PROFILE: profile,
      RISK_SCORE: assessment.score,
    },
    assessment,
    verdict,
    emptyCounterparty: !profile,
    sibyl: health,
    tx,
  };
}

export async function resolveHold(id: string, resolution: "approved" | "rejected") {
  const all = await listActions();
  const current = all.find((row) => row.id === id);
  if (!current) return null;
  if (current.decision !== "Hold for approval") {
    throw new Error("Only Hold for approval records can be resolved.");
  }

  let tx: Execution = skipped("Rejected. No broadcast.");
  if (resolution === "approved") {
    tx = await sendTransfer({
      action: current.action,
      token: current.token,
      amount: current.amount,
      recipient: current.recipient,
    });
  }

  const updated = await updateAction(id, {
    outcome: resolution === "approved" ? "success" : "rejected",
    userOverride: resolution === "approved",
    overrideDirection: resolution,
    txHash: tx.txHash,
    explorerUrl: tx.explorerUrl,
  });
  return { record: updated, tx };
}

export async function memorySnapshot() {
  const actions = await listActions();
  return {
    actions,
    reputation: buildReputation(actions),
    counterparties: listCounterparties(actions),
    sibyl: await sibylHealth(),
  };
}
