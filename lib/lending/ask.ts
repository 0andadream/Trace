import OpenAI from "openai";
import { LENDING_SYSTEM_PROMPT } from "@/lib/lending/prompt";
import {
  deterministicLendingReasoning,
  enforceLendingVerdict,
  formatLendingVerdict,
  parseLendingOutput,
} from "@/lib/lending/reason";
import type { LendingVerdict, OnchainSignal, RateQuote, UserRelationship } from "@/types/lending";

export async function askLendingReasoning(input: {
  quote: RateQuote;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  amount: number;
  asset: string;
}): Promise<LendingVerdict> {
  const fallback = deterministicLendingReasoning(input);

  const key = process.env.XAI_API_KEY;
  if (!key) return { ...fallback, raw: formatLendingVerdict(fallback) };

  const blocks: string[] = [];
  if (input.quote.relationship_empty) {
    blocks.push("USER_RELATIONSHIP is empty (total_loans == 0).");
    blocks.push("ONCHAIN_SIGNAL");
    blocks.push(JSON.stringify(input.onchain, null, 2));
  } else {
    blocks.push("USER_RELATIONSHIP");
    blocks.push(JSON.stringify(input.relationship, null, 2));
    blocks.push("ONCHAIN_SIGNAL is omitted. Do not cite wallet age, tx count, or other protocol activity.");
  }

  const userPayload = [
    ...blocks,
    "",
    "COMPUTED_QUOTE (immutable, copy Decision and Score exactly)",
    JSON.stringify(
      {
        decision: input.quote.decision,
        apr: input.quote.apr,
        collateral_ratio: input.quote.collateral_ratio,
        standing_score: input.quote.standing_score,
        used_onchain: input.quote.used_onchain,
        relationship_empty: input.quote.relationship_empty,
        factors: input.quote.factors,
      },
      null,
      2,
    ),
    "",
    "REQUEST",
    JSON.stringify({ amount: input.amount, asset: input.asset }),
    "",
    "Write the decision in the required OUTPUT FORMAT. Ground reasoning only in the blocks above. The Decision line MUST equal COMPUTED_QUOTE.decision. Score MUST equal COMPUTED_QUOTE.standing_score.",
  ].join("\n");

  try {
    const client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" });
    const completion = await client.chat.completions.create({
      model: "grok-4.6",
      temperature: 0,
      messages: [
        { role: "system", content: LENDING_SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseLendingOutput(raw);
    const enforced = enforceLendingVerdict({
      parsed,
      ...input,
      source: "grok-4.6",
      raw,
    });
    return { ...enforced, raw: formatLendingVerdict(enforced) };
  } catch {
    return { ...fallback, raw: formatLendingVerdict(fallback) };
  }
}
