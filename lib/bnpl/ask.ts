import OpenAI from "openai";
import { BNPL_SYSTEM_PROMPT } from "@/lib/bnpl/prompt";
import {
  deterministicBnplReasoning,
  enforceBnplVerdict,
  formatBnplVerdict,
  formatTermsLine,
  parseBnplOutput,
} from "@/lib/bnpl/reason";
import type { ApprovalTerms, BnplVerdict, OnchainSignal, UserRelationship } from "@/types/bnpl";

export async function askBnplReasoning(input: {
  terms: ApprovalTerms;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  amount: number;
  merchant: string;
}): Promise<BnplVerdict> {
  const fallback = deterministicBnplReasoning(input);

  const key = process.env.XAI_API_KEY;
  if (!key) return { ...fallback, raw: formatBnplVerdict(fallback) };

  const termsLine = formatTermsLine(input.terms);
  const blocks: string[] = [];
  if (input.terms.relationship_empty) {
    blocks.push("USER_RELATIONSHIP is empty (total_purchases == 0). No purchase history exists.");
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
    "COMPUTED_TERMS (immutable — copy Decision and Terms exactly)",
    JSON.stringify(
      {
        decision: input.terms.decision,
        limit: input.terms.limit,
        available: input.terms.available,
        installments: input.terms.installments,
        due_dates: input.terms.due_dates,
        standing_score: input.terms.standing_score,
        used_onchain: input.terms.used_onchain,
        relationship_empty: input.terms.relationship_empty,
        terms_line: termsLine,
        factors: input.terms.factors,
      },
      null,
      2,
    ),
    "",
    "REQUEST",
    JSON.stringify({ amount: input.amount, merchant: input.merchant }),
    "",
    "Write the decision in the required OUTPUT FORMAT. Ground reasoning only in the blocks above. The Decision line MUST equal COMPUTED_TERMS.decision. The Terms line MUST equal COMPUTED_TERMS.terms_line.",
  ].join("\n");

  try {
    const client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" });
    const completion = await client.chat.completions.create({
      model: "grok-4.6",
      temperature: 0,
      messages: [
        { role: "system", content: BNPL_SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseBnplOutput(raw);
    const enforced = enforceBnplVerdict({
      parsed,
      ...input,
      source: "grok-4.6",
      raw,
    });
    return { ...enforced, raw: formatBnplVerdict(enforced) };
  } catch {
    return { ...fallback, raw: formatBnplVerdict(fallback) };
  }
}
