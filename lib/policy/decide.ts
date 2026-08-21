import type { Decision } from "@/types";

export function decideFromScore(score: number): Decision {
  if (score > 0.6) return "Hold for approval";
  if (score >= 0.3) return "Proceed with flag";
  return "Proceed";
}
