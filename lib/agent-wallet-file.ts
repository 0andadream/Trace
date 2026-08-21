import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type AgentWalletFile = {
  address: string;
  network: string;
};

export function readAgentWalletFile(): AgentWalletFile | null {
  const file = path.join(process.cwd(), "config/agent-wallet.json");
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as AgentWalletFile;
    if (!parsed.address) return null;
    return parsed;
  } catch {
    return null;
  }
}
