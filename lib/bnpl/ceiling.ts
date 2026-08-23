/**
 * Hard execution limits. Checked BEFORE terms calculation.
 * Standing, on-chain activity, and the LLM cannot override these.
 *
 * $10k is the unlocked ceiling at standing 0.95 (displayed score 95).
 * Working limits: scores 0–50 stay under $3k (50 = $3k), then climb to $10k.
 */
export const DEFAULT_MAX_PURCHASE_AMOUNT = 10_000;

export function maxPurchaseAmount() {
  const n = Number(process.env.MAX_PURCHASE_AMOUNT ?? DEFAULT_MAX_PURCHASE_AMOUNT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_PURCHASE_AMOUNT;
}

export function maxActivePlans() {
  const n = Number(process.env.MAX_ACTIVE_PLANS ?? 2);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}

export function purchaseCeilingCheck(amount: number, activePlans: number) {
  const max = maxPurchaseAmount();
  const maxActive = maxActivePlans();
  const invalid = !(Number.isFinite(amount) && amount > 0);
  const overAmount = !invalid && amount > max;
  const overPlans = activePlans >= maxActive;
  const blocked = invalid || overAmount || overPlans;
  let reason = `Under ceiling (max ${max}, max active plans ${maxActive}).`;
  if (invalid) reason = "Purchase amount must be greater than 0.";
  else if (overAmount) {
    reason = `Requested ${amount} exceeds MAX_PURCHASE_AMOUNT (${max}). Ceiling block is independent of standing, on-chain history, and the LLM.`;
  } else if (overPlans) {
    reason = `Already ${activePlans} active installment plan${activePlans === 1 ? "" : "s"}. MAX_ACTIVE_PLANS is ${maxActive}. Ceiling block is independent of standing, on-chain history, and the LLM.`;
  }
  return { blocked, max, maxActive, amount, activePlans, reason };
}
