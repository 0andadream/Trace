import { formatAmount } from "@/lib/format";
import { citeSpecificRepayment, EMPTY_RELATIONSHIP_LINE } from "@/lib/lending/relationship";
import type { LendingDecision, LendingVerdict, OnchainSignal, RateQuote, UserRelationship } from "@/types/lending";

export function formatApr(n: number) {
  return `${(n * 100).toFixed(1)}% APR`;
}

export function formatLendingVerdict(verdict: Pick<LendingVerdict, "decision" | "reasoning" | "score">) {
  const bullets = verdict.reasoning.slice(0, 3).map((line) => `- ${line}`).join("\n");
  return `Decision: ${verdict.decision}\n\nReasoning:\n${bullets}\n\nScore: ${verdict.score.toFixed(2)}`;
}

export function parseLendingOutput(text: string): { decision: LendingDecision; reasoning: string[]; score: number } | null {
  const decisionMatch = text.match(
    /Decision:\s*(Approve with reduced limit|Ceiling blocked|Approve|Decline)/i,
  );
  if (!decisionMatch) return null;
  const raw = decisionMatch[1];
  const decision: LendingDecision = /reduced/i.test(raw)
    ? "Approve with reduced limit"
    : /ceiling/i.test(raw)
      ? "Ceiling blocked"
      : /decline/i.test(raw)
        ? "Decline"
        : "Approve";

  const reasoning: string[] = [];
  const bulletBlock = text.split(/Reasoning:/i)[1]?.split(/Score:/i)[0] ?? "";
  for (const line of bulletBlock.split("\n")) {
    const cleaned = line.replace(/^\s*[-*]\s*/, "").trim();
    if (cleaned) reasoning.push(cleaned);
  }

  const scoreMatch = text.match(/Score:\s*([0-9]*\.?[0-9]+)/i);
  const score = scoreMatch ? Number(scoreMatch[1]) : NaN;
  if (!Number.isFinite(score) || reasoning.length === 0) return null;
  return { decision, reasoning: reasoning.slice(0, 3), score };
}

function citesOnchain(line: string) {
  return /on-chain|onchain|wallet age|tx_count|transaction count|ONCHAIN_SIGNAL/i.test(line);
}

export function deterministicLendingReasoning(input: {
  quote: RateQuote;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  amount: number;
  asset: string;
}): LendingVerdict {
  const facts: string[] = [];
  const { quote, relationship } = input;

  if (quote.skipped_scoring) {
    facts.push(quote.ceiling.reason);
    facts.push("This refusal is a hard execution ceiling. Standing, on-chain history, and the LLM were not used.");
    facts.push(`Lower the amount to at most ${quote.ceiling.max} to proceed to scoring.`);
    return {
      decision: quote.decision,
      reasoning: facts.slice(0, 3),
      score: quote.standing_score,
      source: "deterministic",
      raw: "",
    };
  }

  if (quote.relationship_empty) {
    facts.push(`${EMPTY_RELATIONSHIP_LINE} Terms use ONCHAIN_SIGNAL only.`);
    const age = input.onchain?.wallet_age_days ?? 0;
    const txs = input.onchain?.tx_count ?? 0;
    facts.push(`Wallet age ${age} days, ${txs} transactions, conservative new-borrower baseline.`);
    facts.push(
      `Quoted ${formatApr(quote.apr)} with ${quote.collateral_ratio.toFixed(2)}x collateral. Max borrow for this baseline ${formatAmount(quote.max_borrow_for_user, input.asset)}.`,
    );
  } else {
    facts.push(
      `${relationship.total_loans} loan${relationship.total_loans === 1 ? "" : "s"} this agent originated with this wallet (${relationship.on_time_count} on_time, ${relationship.late_count} late, ${relationship.default_count} defaulted). ONCHAIN_SIGNAL not used.`,
    );
    facts.push(citeSpecificRepayment(relationship));
    const extra =
      quote.decision === "Decline"
        ? `Standing ${quote.standing_score.toFixed(2)} after default history. Quoted ${formatApr(quote.apr)}, declined.`
        : `Quoted ${formatApr(quote.apr)} with ${quote.collateral_ratio.toFixed(2)}x collateral (standing ${quote.standing_score.toFixed(2)}).`;
    facts.push(extra);
  }

  if (quote.decision === "Approve with reduced limit" && quote.reduced_limit != null) {
    facts[2] = `Amount exceeds this wallet's limit. Reduced max ${formatAmount(quote.reduced_limit, input.asset)} at ${formatApr(quote.apr)}.`;
  }

  return {
    decision: quote.decision,
    reasoning: facts.slice(0, 3),
    score: quote.standing_score,
    source: "deterministic",
    raw: "",
  };
}

export function enforceLendingVerdict(input: {
  parsed: { decision: LendingDecision; reasoning: string[]; score: number } | null;
  quote: RateQuote;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  amount: number;
  asset: string;
  source: LendingVerdict["source"];
  raw: string;
}): LendingVerdict {
  const fallback = deterministicLendingReasoning(input);
  const reasoning = [...(input.parsed?.reasoning ?? fallback.reasoning)];

  if (input.quote.relationship_empty) {
    if (!reasoning.some((line) => line.includes(EMPTY_RELATIONSHIP_LINE))) {
      reasoning.unshift(`${EMPTY_RELATIONSHIP_LINE} Terms use ONCHAIN_SIGNAL only.`);
    }
  } else {
    const stripped = reasoning.filter((line) => !citesOnchain(line) || /not used/i.test(line));
    reasoning.length = 0;
    reasoning.push(...stripped);
    if (!reasoning.some((line) => /loan|repay|on_time|late|default/i.test(line))) {
      reasoning.unshift(citeSpecificRepayment(input.relationship));
    }
    if (!reasoning.some((line) => /ONCHAIN_SIGNAL not used/i.test(line))) {
      if (reasoning.length >= 3) {
        reasoning[1] = `${input.relationship.total_loans} loan${input.relationship.total_loans === 1 ? "" : "s"} this agent originated. ONCHAIN_SIGNAL not used.`;
      } else {
        reasoning.push(
          `${input.relationship.total_loans} loan${input.relationship.total_loans === 1 ? "" : "s"} this agent originated. ONCHAIN_SIGNAL not used.`,
        );
      }
    }
  }

  const cleaned = reasoning
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  while (cleaned.length < 1) cleaned.push(fallback.reasoning[0]);

  return {
    decision: input.quote.decision,
    reasoning: cleaned.slice(0, 3),
    score: input.quote.standing_score,
    source: input.parsed ? input.source : "deterministic",
    raw: input.raw,
  };
}
