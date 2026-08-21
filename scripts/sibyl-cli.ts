import { spawn } from "node:child_process";
import path from "node:path";

export function callSibylCli<T = Record<string, unknown>>(
  op: string,
  payload: Record<string, unknown> = {},
): Promise<T & { ok: boolean; error?: string; health?: { actionCount: number; counterpartyCount: number; tenant: string; db: string } }> {
  return new Promise((resolve, reject) => {
    const python = process.env.SIBYL_PYTHON || path.join(process.cwd(), ".venv/bin/python");
    const child = spawn(python, [path.join(process.cwd(), "sibyl/bridge.py")], {
      env: { ...process.env },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => {
      out += c;
    });
    child.stderr.on("data", (c) => {
      err += c;
    });
    child.on("error", reject);
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out || "{}");
        if (!parsed.ok) reject(new Error(parsed.error || err || "sibyl error"));
        else resolve(parsed);
      } catch {
        reject(new Error(err || out || "invalid JSON from sibyl bridge"));
      }
    });
    child.stdin.write(
      JSON.stringify({
        op,
        tenant: payload.tenant || process.env.SIBYL_TENANT || "trace-alex",
        ...payload,
      }),
    );
    child.stdin.end();
  });
}
