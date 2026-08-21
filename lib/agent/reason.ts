import { decideFromScore } from "@/lib/policy/decide";
import { formatAmount, formatPct } from "@/lib/format";
import type {
  AgentReputation,
  AlexVerdict,
  CounterpartyProfile,
  Decision,
  RiskAssessment,
  TreasuryRequest,
} from "@/types";

const EMPTY_CP = "No prior interactions with this counterparty.";

export function formatVerdict(verdict: Pick<AlexVerdict, "decision" | "reasoning" | "risk">) {
  const bullets = verdict.reasoning.slice(0, 3).map((line) => `- ${line}`).join("\n");
  return `Decision: ${verdict.decision}\n\nReasoning:\n${bullets}\n\nRisk: ${verdict.risk.toFixed(2)}`;
}

export function parseAlexOutput(text: string): { decision: Decision; reasoning: string[]; risk: number } | null {
  const decisionMatch = text.match(/Decision:\s*(Proceed with flag|Hold for approval|Proceed)/i);
  if (!decisionMatch) return null;
  const rawDecision = decisionMatch[1];
  const decision: Decision =
    /flag/i.test(rawDecision) ? "Proceed with flag" : /hold/i.test(rawDecision) ? "Hold for approval" : "Proceed";

  const reasoning: string[] = [];
  const bulletBlock = text.split(/Reasoning:/i)[1]?.split(/Risk:/i)[0] ?? "";
  for (const line of bulletBlock.split("\n")) {
    const cleaned = line.replace(/^\s*[-*]\s*/, "").trim();
    if (cleaned) reasoning.push(cleaned);
  }

  const riskMatch = text.match(/Risk:\s*([0-9]*\.?[0-9]+)/i);
  const risk = riskMatch ? Number(riskMatch[1]) : NaN;
  if (!Number.isFinite(risk) || reasoning.length === 0) return null;
  return { decision, reasoning: reasoning.slice(0, 3), risk };
}

function topFactors(assessment: RiskAssessment, n = 3) {
  return [...assessment.factors].sort((a, b) => b.delta - a.delta).slice(0, n);
}

export function deterministicReasoning(input: {
  request: TreasuryRequest;
  reputation: AgentReputation;
  profile: CounterpartyProfile | null;
  assessment: RiskAssessment;
}): AlexVerdict {
  const decision = decideFromScore(input.assessment.score);
  const facts: string[] = [];

  if (!input.profile) {
    facts.push(EMPTY_CP);
  }

  for (const factor of topFactors(input.assessment, 4)) {
    if (factor.reason === EMPTY_CP && facts.includes(EMPTY_CP)) continue;
    if (!facts.includes(factor.reason)) facts.push(factor.reason);
    if (facts.length >= 3) break;
  }

  if (input.profile && facts.length < 2) {
    facts.push(
      `This counterparty has ${input.profile.interactionCount} prior interaction${input.profile.interactionCount === 1 ? "" : "s"} (${input.profile.successful} successful, ${input.profile.rejected} rejected). Average size ${formatAmount(input.profile.avgAmount, input.request.token)}.`,
    );
  }

  if (facts.length < 2) {
    facts.push(
      `Agent history: ${input.reputation.totalActions} actions, ${input.reputation.successfulActions} successful, ${input.reputation.rejectedActions} rejected, ${input.reputation.userOverrides} user override${input.reputation.userOverrides === 1 ? "" : "s"}.`,
    );
  }

  if (decision === "Hold for approval") {
    const unlock = input.profile
      ? "Explicit user approval, or a documented policy add for this counterparty, would allow the transaction to proceed."
      : "User approval of this recipient, or a successful prior interaction recorded in memory, would allow the transaction to proceed.";
    if (!facts.some((f) => /would allow/i.test(f))) {
      if (facts.length >= 3) facts[2] = unlock;
      else facts.push(unlock);
    }
  }

  if (input.reputation.holdOverrideRate >= 0.4 && input.reputation.holdDecisions >= 3) {
    const overrideFact = `User override rate on Hold decisions is ${formatPct(input.reputation.holdOverrideRate)}. Deferring to explicit approval.`;
    if (!facts.some((f) => /override/i.test(f))) {
      if (facts.length >= 3) facts[1] = overrideFact;
      else facts.push(overrideFact);
    }
  }

  return {
    decision,
    reasoning: facts.slice(0, 3),
    risk: input.assessment.score,
    source: "deterministic",
    raw: "",
  };
}

export function enforceVerdict(input: {
  parsed: { decision: Decision; reasoning: string[]; risk: number } | null;
  request: TreasuryRequest;
  reputation: AgentReputation;
  profile: CounterpartyProfile | null;
  assessment: RiskAssessment;
  source: AlexVerdict["source"];
  raw: string;
}): AlexVerdict {
  const fallback = deterministicReasoning(input);
  const decision = decideFromScore(input.assessment.score);
  const reasoning = [...(input.parsed?.reasoning ?? fallback.reasoning)];

  if (!input.profile && !reasoning.some((line) => line.includes(EMPTY_CP))) {
    reasoning.unshift(EMPTY_CP);
  }

  const cleaned = reasoning
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  while (cleaned.length < 1) cleaned.push(fallback.reasoning[0]);
  if (decision === "Hold for approval" && cleaned.length < 3) {
    for (const line of fallback.reasoning) {
      if (cleaned.length >= 3) break;
      if (!cleaned.includes(line)) cleaned.push(line);
    }
  }

  return {
    decision,
    reasoning: cleaned.slice(0, 3),
    risk: input.assessment.score,
    source: input.parsed ? input.source : "deterministic",
    raw: input.raw,
  };
}

export { EMPTY_CP };
