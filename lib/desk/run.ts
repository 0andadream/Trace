import { askAlex } from "@/lib/agent/alex";
import { formatVerdict } from "@/lib/agent/reason";
import { requestFromBody } from "@/lib/desk/scenarios";
import { labelAddress } from "@/lib/format";
import { buildCounterpartyProfile, buildReputation, listCounterparties } from "@/lib/memory/derive";
import { appendAction, listActions, updateAction } from "@/lib/memory/store";
import { computeRiskScore } from "@/lib/risk/score";
import type { ActionRecord, DecideRequestBody, DecideResult } from "@/types";

function newId() {
  return `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
  const result: DecideResult = {
    id,
    at,
    request,
    counterpartyLabel: profile?.label || labelAddress(request.recipient),
    memory: {
      AGENT_REPUTATION: reputation,
      COUNTERPARTY_PROFILE: profile,
      RISK_SCORE: assessment.score,
    },
    assessment,
    verdict,
    emptyCounterparty: !profile,
  };

  if (body.persist === false) return result;

  const pending: ActionRecord = {
    id,
    at,
    action: request.action,
    token: request.token,
    amount: request.amount,
    recipient: request.recipient,
    counterpartyLabel: result.counterpartyLabel,
    outcome: verdict.decision === "Hold for approval" ? "pending" : "success",
    decision: verdict.decision,
    riskScore: assessment.score,
    userOverride: false,
    overrideDirection: null,
    seed: false,
    reasoning: verdict.reasoning,
    reasoningSource: verdict.source,
  };
  await appendAction(pending);
  return result;
}

export async function resolveHold(id: string, resolution: "approved" | "rejected") {
  const all = await listActions();
  const current = all.find((row) => row.id === id);
  if (!current) return null;
  if (current.decision !== "Hold for approval") {
    throw new Error("Only Hold for approval records can be resolved.");
  }
  const updated = await updateAction(id, {
    outcome: resolution === "approved" ? "success" : "rejected",
    userOverride: resolution === "approved",
    overrideDirection: resolution,
  });
  return updated;
}

export async function memorySnapshot() {
  const actions = await listActions();
  return {
    actions,
    reputation: buildReputation(actions),
    counterparties: listCounterparties(actions),
  };
}
