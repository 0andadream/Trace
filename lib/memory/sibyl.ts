import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { handleSibylMessage } from "@/lib/memory/engine";
import { StoreUnavailable } from "@/lib/memory/persist";
import { currentTenant } from "@/lib/user/session";

export class SibylUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SibylUnavailable";
  }
}

export type SibylHealth = {
  engine: string;
  db: string;
  tenant: string;
  tier: string;
  actionCount: number;
  counterpartyCount: number;
  relationshipCount?: number;
  recentEvents: number;
  lastEvent: unknown;
  freeTier: unknown;
  loadBearing: boolean;
};

function pythonBin() {
  const env = process.env.SIBYL_PYTHON?.trim();
  if (env && existsSync(env)) return env;
  const venv = path.join(process.cwd(), ".venv/bin/python");
  if (existsSync(venv)) return venv;
  return null;
}

function bridgePath() {
  return path.join(process.cwd(), "sibyl/bridge.py");
}

function useNodeEngine() {
  return process.env.SIBYL_FORCE_NODE === "1" || !pythonBin();
}

function spawnPython<T>(
  op: string,
  payload: Record<string, unknown>,
  bin: string,
): Promise<T & { ok: boolean; error?: string; health?: SibylHealth }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [bridgePath()], {
      env: { ...process.env },
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new SibylUnavailable("Sibyl Memory bridge timed out."));
    }, 15_000);

    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        new SibylUnavailable(
          `Sibyl Memory is required and unavailable (${error.message}). Create .venv with Python 3.10+ and pip install -r requirements.txt.`,
        ),
      );
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out || "{}") as T & { ok: boolean; error?: string };
        if (!parsed.ok) {
          reject(new SibylUnavailable(parsed.error || err || "Sibyl Memory returned an error."));
          return;
        }
        resolve(parsed);
      } catch {
        reject(
          new SibylUnavailable(
            `Sibyl Memory returned invalid JSON. ${err || out || "Is sibyl-memory-client installed in .venv?"}`,
          ),
        );
      }
    });
    child.stdin.write(JSON.stringify({ op, tenant: payload.tenant ?? currentTenant(), ...payload }));
    child.stdin.end();
  });
}

export async function callSibyl<T = Record<string, unknown>>(
  op: string,
  payload: Record<string, unknown> = {},
): Promise<T & { ok: boolean; error?: string; health?: SibylHealth }> {
  const msg = { op, tenant: payload.tenant ?? currentTenant(), ...payload };
  try {
    if (useNodeEngine()) {
      const parsed = (await handleSibylMessage(msg)) as T & { ok: boolean; error?: string; health?: SibylHealth };
      if (!parsed.ok) throw new SibylUnavailable(parsed.error || "Sibyl Memory returned an error.");
      return parsed;
    }
    return await spawnPython<T>(op, payload, pythonBin()!);
  } catch (err) {
    if (err instanceof SibylUnavailable) throw err;
    if (err instanceof StoreUnavailable) throw new SibylUnavailable(err.message);
    throw err;
  }
}
