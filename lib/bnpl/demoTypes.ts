import type { ApprovalTerms, PolicyPrimary } from "@/types/bnpl";

export type DemoEvent = {
  step: string;
  status: "start" | "ok" | "error";
  title: string;
  message: string;
  terms?: ApprovalTerms;
  factors?: ApprovalTerms["factors"];
  txHash?: string | null;
  explorerUrl?: string | null;
  acpJobId?: string | null;
  acpExplorer?: string | null;
  primary?: PolicyPrimary;
  used_onchain?: boolean;
  limit?: number;
  installments?: number;
  standing?: number;
  purchases?: number;
  on_time?: number;
};

export type DemoStatus = {
  available: boolean;
  reason: string | null;
  demoWallet: string | null;
  agent: string | null;
  execute: boolean;
  demoEth: string | null;
  agentEth: string | null;
  spendableUsd: number | null;
  reserve: number;
  sku: { id: string; name: string; price: number };
};
