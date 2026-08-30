import { formatAmount } from "@/lib/format";
import { citeSpecificPurchase, EMPTY_RELATIONSHIP_LINE } from "@/lib/bnpl/relationship";
import type { ApprovalTerms, BnplDecision, BnplVerdict, OnchainSignal, UserRelationship } from "@/types/bnpl";

export function whyDecisionLine(input: {
  terms: ApprovalTerms;
  relationship: UserRelationship;
  amount: number;
}): string {
  const { terms, relationship, amount } = input;
  if (terms.outcome === "insolvent_declined") {
    return "Declined, TRACE cannot finance this purchase and still keep its reserve.";
  }
  if (terms.decision === "Ceiling blocked") {
    return "Blocked, this amount or another open plan hits a hard cap.";
  }
  if (terms.relationship_empty) {
    if (terms.decision === "Approve with reduced limit") {
      return "Approved with reduced limit, TRACE hasn't built up a relationship with you yet, so this stays a small first offer.";
    }
    if (terms.decision === "Approve") {
      return "Approved, TRACE hasn't built up a relationship with you yet, so this stays a cautious first purchase.";
    }
    return "Declined, TRACE hasn't built up a relationship with you yet, and this ask is outside a first offer.";
  }
  if (terms.decision === "Decline") {
    if (relationship.default_count >= 1) {
      return "Declined, a missed payment cut your TRACE reputation.";
    }
    if (relationship.late_count >= 1) {
      return "Declined, a late payment made the next deal harder.";
    }
    if (terms.available <= 0) {
      return "Declined, you already have as much open as your TRACE limit allows.";
    }
    return "Declined, your TRACE reputation is too low for this purchase.";
  }
  const closed = [...(relationship.purchases || [])]
    .filter((p) => p.outcome !== "active")
    .sort((a, b) => b.approved_date.localeCompare(a.approved_date));
  const last = closed[0];
  if (terms.decision === "Approve with reduced limit") {
    if (relationship.active_count >= 1) {
      return "Approved with reduced limit, you still have an open plan.";
    }
    if (amount > terms.available) {
      return "Approved with reduced limit, this is more than your TRACE limit allows right now.";
    }
    return "Approved with reduced limit, this is outside your usual purchase size.";
  }
  if (last?.outcome === "completed_on_time") {
    return "Approved, your last purchase was repaid on time, so your limit went up.";
  }
  if (last?.outcome === "completed_late") {
    return "Approved, TRACE has your history on file, with a late payment still remembered.";
  }
  return "Approved, TRACE already has a relationship with you.";
}

export function formatTermsLine(terms: ApprovalTerms) {
  if (terms.outcome === "insolvent_declined") return "Terms: insolvent_declined";
  if (terms.decision === "Ceiling blocked") return "Terms: blocked";
  if (terms.decision === "Decline") return "Terms: declined";
  const dues = terms.due_dates.map((d) => d.slice(0, 10)).join(", ");
  const limit = terms.reduced_limit ?? terms.available;
  const n = terms.installments;
  const pay = n === 1 ? "pay in full" : `${n} installments`;
  const rate = Math.round((terms.interest_rate || 0) * 100);
  return `Terms: receive ${terms.principal || limit} · repay ${terms.total_due || limit} · Trace interest ${rate}% · ${pay} · due ${dues}`;
}

export function formatBnplVerdict(verdict: Pick<BnplVerdict, "decision" | "reasoning" | "terms">) {
  const bullets = verdict.reasoning.slice(0, 3).map((line) => `- ${line}`).join("\n");
  return `Decision: ${verdict.decision}\n\nReasoning:\n${bullets}\n\n${verdict.terms}`;
}

export function parseBnplOutput(
  text: string,
): { decision: BnplDecision; reasoning: string[]; terms: string } | null {
  const decisionMatch = text.match(
    /Decision:\s*(Approve with reduced limit|Ceiling blocked|Approve|Decline)/i,
  );
  if (!decisionMatch) return null;
  const raw = decisionMatch[1];
  const decision: BnplDecision = /reduced/i.test(raw)
    ? "Approve with reduced limit"
    : /ceiling/i.test(raw)
      ? "Ceiling blocked"
      : /decline/i.test(raw)
        ? "Decline"
        : "Approve";

  const reasoning: string[] = [];
  const afterReason = text.split(/Reasoning:/i)[1] ?? "";
  const bulletBlock = afterReason.split(/Terms:/i)[0] ?? "";
  for (const line of bulletBlock.split("\n")) {
    const cleaned = line.replace(/^\s*[-*]\s*/, "").trim();
    if (cleaned) reasoning.push(cleaned);
  }

  const termsMatch = text.match(/Terms:\s*(.+)/i);
  const terms = termsMatch ? `Terms: ${termsMatch[1].trim()}` : "";
  if (reasoning.length === 0) return null;
  return { decision, reasoning: reasoning.slice(0, 3), terms };
}

function citesOnchain(line: string) {
  return /on-chain|onchain|wallet age|tx_count|transaction count|ONCHAIN_SIGNAL/i.test(line);
}

export function deterministicBnplReasoning(input: {
  terms: ApprovalTerms;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  amount: number;
  merchant: string;
}): BnplVerdict {
  const facts: string[] = [];
  const { terms, relationship } = input;
  const line = formatTermsLine(terms);

  if (terms.outcome === "insolvent_declined") {
    facts.push(terms.ceiling.reason);
    facts.push("This refusal is the agent's own solvency ceiling. User standing and on-chain history were not used.");
    facts.push("Lower the amount, raise the agent's balance, or reduce MIN_AGENT_RESERVE to proceed.");
    return {
      decision: terms.decision,
      reasoning: facts.slice(0, 3),
      why: whyDecisionLine(input),
      terms: line,
      score: terms.standing_score,
      source: "deterministic",
      raw: "",
    };
  }

  if (terms.skipped_scoring) {
    facts.push(terms.ceiling.reason);
    facts.push("This refusal is a hard execution ceiling. Standing, on-chain history, and the LLM were not used.");
    facts.push(`Lower the amount to at most ${terms.ceiling.max}, or repay an active plan first.`);
    return {
      decision: terms.decision,
      reasoning: facts.slice(0, 3),
      why: whyDecisionLine(input),
      terms: line,
      score: terms.standing_score,
      source: "deterministic",
      raw: "",
    };
  }

  if (terms.relationship_empty) {
    facts.push(`${EMPTY_RELATIONSHIP_LINE} Terms use ONCHAIN_SIGNAL only.`);
    const age = input.onchain?.wallet_age_days ?? 0;
    const txs = input.onchain?.tx_count ?? 0;
    facts.push(`Wallet age ${age} days, ${txs} transactions, conservative new-buyer baseline.`);
    facts.push(
      `Limit ${formatAmount(terms.limit)} with ${terms.installments} installment${terms.installments === 1 ? "" : "s"} (short plan).`,
    );
  } else {
    facts.push(
      `${relationship.total_purchases} purchase${relationship.total_purchases === 1 ? "" : "s"} this agent approved (${relationship.on_time_count} completed_on_time, ${relationship.late_count} completed_late, ${relationship.default_count} defaulted). ONCHAIN_SIGNAL not used.`,
    );
    facts.push(citeSpecificPurchase(relationship));
    facts.push(
      terms.decision === "Decline"
        ? `Standing ${terms.standing_score.toFixed(2)} after default history. Limit cut to ${formatAmount(terms.available)}, declined.`
        : `Limit ${formatAmount(terms.available)} available of ${formatAmount(terms.limit)} gross · ${terms.installments} installments (standing ${terms.standing_score.toFixed(2)}).`,
    );
  }

  if (terms.decision === "Approve with reduced limit" && terms.reduced_limit != null) {
    facts[2] = `Amount exceeds available limit. Reduced to ${formatAmount(terms.reduced_limit)} over ${terms.installments} installment${terms.installments === 1 ? "" : "s"}.`;
  }

  return {
    decision: terms.decision,
    reasoning: facts.slice(0, 3),
    why: whyDecisionLine(input),
    terms: line,
    score: terms.standing_score,
    source: "deterministic",
    raw: "",
  };
}

export function enforceBnplVerdict(input: {
  parsed: { decision: BnplDecision; reasoning: string[]; terms: string } | null;
  terms: ApprovalTerms;
  relationship: UserRelationship;
  onchain: OnchainSignal | null;
  amount: number;
  merchant: string;
  source: BnplVerdict["source"];
  raw: string;
}): BnplVerdict {
  const fallback = deterministicBnplReasoning(input);
  const reasoning = [...(input.parsed?.reasoning ?? fallback.reasoning)];

  if (input.terms.outcome === "insolvent_declined") {
    if (!reasoning.some((line) => /User reputation was not used|solvency/i.test(line))) {
      reasoning.unshift(input.terms.ceiling.reason);
    }
  } else if (input.terms.relationship_empty) {
    if (!reasoning.some((line) => /no purchase history exists/i.test(line))) {
      reasoning.unshift(`${EMPTY_RELATIONSHIP_LINE} Terms use ONCHAIN_SIGNAL only.`);
    }
  } else {
    const stripped = reasoning.filter((line) => !citesOnchain(line) || /not used/i.test(line));
    reasoning.length = 0;
    reasoning.push(...stripped);
    if (!reasoning.some((line) => /purchase|repay|on_time|late|default/i.test(line))) {
      reasoning.unshift(citeSpecificPurchase(input.relationship));
    }
    if (!reasoning.some((line) => /ONCHAIN_SIGNAL not used/i.test(line))) {
      const note = `${input.relationship.total_purchases} purchase${input.relationship.total_purchases === 1 ? "" : "s"} this agent approved. ONCHAIN_SIGNAL not used.`;
      if (reasoning.length >= 3) reasoning[1] = note;
      else reasoning.push(note);
    }
  }

  const cleaned = reasoning
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  while (cleaned.length < 1) cleaned.push(fallback.reasoning[0]);

  return {
    decision: input.terms.decision,
    reasoning: cleaned.slice(0, 3),
    why: whyDecisionLine(input),
    terms: formatTermsLine(input.terms),
    score: input.terms.standing_score,
    source: input.parsed ? input.source : "deterministic",
    raw: input.raw,
  };
}
