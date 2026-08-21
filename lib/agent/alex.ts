import OpenAI from "openai";
import { ALEX_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { enforceVerdict, formatVerdict, parseAlexOutput } from "@/lib/agent/reason";
import { decideFromScore } from "@/lib/policy/decide";
import type { AgentReputation, AlexVerdict, CounterpartyProfile, RiskAssessment, TreasuryRequest } from "@/types";

export async function askAlex(input: {
  request: TreasuryRequest;
  reputation: AgentReputation;
  profile: CounterpartyProfile | null;
  assessment: RiskAssessment;
}): Promise<AlexVerdict> {
  const computed = decideFromScore(input.assessment.score);
  const fallback = enforceVerdict({
    parsed: null,
    ...input,
    source: "deterministic",
    raw: "",
  });

  const key = process.env.XAI_API_KEY;
  if (!key) return { ...fallback, raw: formatVerdict(fallback) };

  const userPayload = [
    "AGENT_REPUTATION",
    JSON.stringify(input.reputation, null, 2),
    "",
    "COUNTERPARTY_PROFILE",
    input.profile ? JSON.stringify(input.profile, null, 2) : "(empty)",
    "",
    "RISK_SCORE",
    String(input.assessment.score),
    "",
    "CURRENT REQUEST",
    JSON.stringify(input.request, null, 2),
    "",
    "COMPUTED_DECISION",
    computed,
    "",
    "Write the decision in the required OUTPUT FORMAT. Ground reasoning only in the memory blocks. The Decision line MUST equal COMPUTED_DECISION.",
  ].join("\n");

  try {
    const client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" });
    const completion = await client.chat.completions.create({
      model: "grok-4.6",
      temperature: 0,
      messages: [
        { role: "system", content: ALEX_SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseAlexOutput(raw);
    const enforced = enforceVerdict({
      parsed,
      ...input,
      source: "grok-4.6",
      raw,
    });
    return { ...enforced, raw: formatVerdict(enforced) };
  } catch {
    return { ...fallback, raw: formatVerdict(fallback) };
  }
}
