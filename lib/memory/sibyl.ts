import { spawn } from "node:child_process";
import path from "node:path";
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
  return process.env.SIBYL_PYTHON || path.join(process.cwd(), ".venv/bin/python");
}

function bridgePath() {
  return path.join(process.cwd(), "sibyl/bridge.py");
}

export function callSibyl<T = Record<string, unknown>>(
  op: string,
  payload: Record<string, unknown> = {},
): Promise<T & { ok: boolean; error?: string; health?: SibylHealth }> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), [bridgePath()], {
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
