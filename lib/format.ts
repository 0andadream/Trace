import { COUNTERPARTY_LABELS, UNKNOWN_LABEL } from "@/lib/counterparties";

export function shortAddress(address: string) {
  const a = address.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

export function labelAddress(address: string) {
  const key = normalizeAddress(address);
  return COUNTERPARTY_LABELS[key] || UNKNOWN_LABEL;
}

export function formatAmount(amount: number, token = "USDT") {
  const n = Number.isFinite(amount) ? amount : 0;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${token}`;
}

export function formatPct(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
