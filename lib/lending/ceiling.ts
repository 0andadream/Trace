/**
 * Hard execution limits. Checked BEFORE rate calculation.
 * Standing, on-chain activity, and the LLM cannot override these.
 */
export function maxBorrowAmount() {
  const n = Number(process.env.MAX_BORROW_AMOUNT ?? 50);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

/** Floor on required collateral ratio. Quoted ratio is always >= this. */
export function minCollateralRatio() {
  const n = Number(process.env.MIN_COLLATERAL_RATIO ?? 1.5);
  return Number.isFinite(n) && n >= 1 ? n : 1.5;
}

export function borrowCeilingCheck(amount: number) {
  const max = maxBorrowAmount();
  const blocked = !(Number.isFinite(amount) && amount > 0) || amount > max;
  const invalid = !(Number.isFinite(amount) && amount > 0);
  return {
    blocked,
    max,
    amount,
    reason: invalid
      ? "Borrow amount must be greater than 0."
      : blocked
        ? `Requested ${amount} exceeds MAX_BORROW_AMOUNT (${max}). Ceiling block is independent of standing score, on-chain history, and the LLM.`
        : `Under ceiling (${max}).`,
  };
}

export function applyCollateralFloor(ratio: number) {
  const floor = minCollateralRatio();
  return Math.max(floor, Number.isFinite(ratio) ? ratio : floor);
}
