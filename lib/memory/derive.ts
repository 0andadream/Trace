/**
 * Trace reputation constructors. Pure functions over action records.
 * Alex does not own this file, it reads the structs these return.
 */
import { AGENT_NAME } from "@/lib/counterparties";
import { labelAddress, normalizeAddress } from "@/lib/format";
import type {
  ActionRecord,
  ActionTypeStats,
  AgentReputation,
  CounterpartyProfile,
  TxAction,
  VerificationStatus,
} from "@/types";

const ACTIONS: TxAction[] = ["transfer", "approve", "swap", "contract"];

function emptyStats(): ActionTypeStats {
  return {
    count: 0,
    successful: 0,
    rejected: 0,
    incidents: 0,
    overrides: 0,
    holdDecisions: 0,
    avgAmount: 0,
  };
}

export function buildReputation(actions: ActionRecord[]): AgentReputation {
  const byActionType = Object.fromEntries(ACTIONS.map((a) => [a, emptyStats()])) as Record<
    TxAction,
    ActionTypeStats
  >;
  const sums: Record<TxAction, number> = { transfer: 0, approve: 0, swap: 0, contract: 0 };

  let successfulActions = 0;
  let rejectedActions = 0;
  let incidentActions = 0;
  let pendingActions = 0;
  let userOverrides = 0;
  let holdDecisions = 0;

  for (const row of actions) {
    const stats = byActionType[row.action] ?? emptyStats();
    stats.count += 1;
    sums[row.action] += row.amount;
    if (row.outcome === "success") {
      successfulActions += 1;
      stats.successful += 1;
    } else if (row.outcome === "rejected") {
      rejectedActions += 1;
      stats.rejected += 1;
    } else if (row.outcome === "incident") {
      incidentActions += 1;
      stats.incidents += 1;
    } else {
      pendingActions += 1;
    }
    if (row.userOverride) {
      userOverrides += 1;
      stats.overrides += 1;
    }
    if (row.decision === "Hold for approval") {
      holdDecisions += 1;
      stats.holdDecisions += 1;
    }
    byActionType[row.action] = stats;
  }

  for (const action of ACTIONS) {
    const stats = byActionType[action];
    stats.avgAmount = stats.count ? Math.round((sums[action] / stats.count) * 100) / 100 : 0;
  }

  const totalActions = actions.length;
  const holdOverrides = actions.filter(
    (a) => a.decision === "Hold for approval" && a.userOverride && a.overrideDirection === "approved",
  ).length;

  return {
    agent: AGENT_NAME,
    totalActions,
    successfulActions,
    rejectedActions,
    incidentActions,
    pendingActions,
    userOverrides,
    holdDecisions,
    holdOverrideRate: holdDecisions ? holdOverrides / holdDecisions : 0,
    incidentRate: totalActions ? incidentActions / totalActions : 0,
    rejectionRate: totalActions ? rejectedActions / totalActions : 0,
    thinHistory: totalActions < 5,
    rejectedUnverifiedCount: countRejectedUnverified(actions),
    byActionType,
  };
}

function countRejectedUnverified(actions: ActionRecord[]): number {
  const byAddr = new Map<string, { successful: number; rejected: number }>();
  for (const row of actions) {
    const key = normalizeAddress(row.recipient);
    const cur = byAddr.get(key) ?? { successful: 0, rejected: 0 };
    if (row.outcome === "success") cur.successful += 1;
    if (row.outcome === "rejected") cur.rejected += 1;
    byAddr.set(key, cur);
  }
  let n = 0;
  for (const cur of byAddr.values()) {
    if (cur.rejected > 0 && cur.successful === 0) n += 1;
  }
  return n;
}

export function buildCounterpartyProfile(
  actions: ActionRecord[],
  address: string,
): CounterpartyProfile | null {
  const key = normalizeAddress(address);
  const rows = actions.filter((a) => normalizeAddress(a.recipient) === key);
  if (rows.length === 0) return null;

  const amounts = rows.map((r) => r.amount);
  const actionTypes = [...new Set(rows.map((r) => r.action))];
  const last = [...rows].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  const verification = latestVerification(rows);

  return {
    address: key,
    label: last.counterpartyLabel || labelAddress(address),
    ...(verification ? { verification } : {}),
    interactionCount: rows.length,
    successful: rows.filter((r) => r.outcome === "success").length,
    rejected: rows.filter((r) => r.outcome === "rejected").length,
    incidents: rows.filter((r) => r.outcome === "incident").length,
    overrides: rows.filter((r) => r.userOverride).length,
    avgAmount: amounts.reduce((s, n) => s + n, 0) / amounts.length,
    minAmount: Math.min(...amounts),
    maxAmount: Math.max(...amounts),
    lastAt: last.at,
    actions: actionTypes,
  };
}

export function listCounterparties(actions: ActionRecord[]): CounterpartyProfile[] {
  const seen = new Set<string>();
  const out: CounterpartyProfile[] = [];
  for (const row of actions) {
    const key = normalizeAddress(row.recipient);
    if (seen.has(key)) continue;
    seen.add(key);
    const profile = buildCounterpartyProfile(actions, row.recipient);
    if (profile) out.push(profile);
  }
  return out.sort((a, b) => b.interactionCount - a.interactionCount);
}

function latestVerification(rows: ActionRecord[]): VerificationStatus | undefined {
  const dated = [...rows].sort((a, b) => (a.at < b.at ? -1 : 1));
  for (let i = dated.length - 1; i >= 0; i--) {
    if (dated[i].verification) return dated[i].verification;
  }
  return undefined;
}
