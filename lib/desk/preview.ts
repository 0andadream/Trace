import { requestFromBody } from "@/lib/desk/scenarios";
import { buildCounterpartyProfile, buildReputation } from "@/lib/memory/derive";
import { listActions, sibylHealth } from "@/lib/memory/store";
import { computeRiskScore } from "@/lib/risk/score";
import type { DecideRequestBody, PreviewResult } from "@/types";

export async function previewRequest(body: DecideRequestBody): Promise<PreviewResult> {
  const request = requestFromBody(body);
  const actions = await listActions();
  const reputation = buildReputation(actions);
  const profile = buildCounterpartyProfile(actions, request.recipient);
  const assessment = computeRiskScore(request, reputation, profile);
  return {
    request,
    memory: {
      AGENT_REPUTATION: reputation,
      COUNTERPARTY_PROFILE: profile,
      RISK_SCORE: assessment.score,
    },
    assessment,
    emptyCounterparty: !profile,
    sibyl: await sibylHealth(),
  };
}
