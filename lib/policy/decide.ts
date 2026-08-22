import type { Decision } from "@/types";

/** Fixed Trace cutoffs. Do not change: <0.30 Proceed, 0.30–0.60 Flag, >0.60 Hold. */
export function decideFromScore(score: number): Decision {
  if (score > 0.6) return "Hold for approval";
  if (score >= 0.3) return "Proceed with flag";
  return "Proceed";
}
