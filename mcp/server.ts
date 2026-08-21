#!/usr/bin/env npx tsx
/**
 * stdio MCP server for Trace / Alex.
 *
 *   pnpm mcp
 *
 * Tools: alex_decide, alex_memory, alex_log, alex_resolve
 */
import { memorySnapshot, resolveHold, runDecide } from "../lib/desk/run";
import type { TxAction } from "../types";

type JsonRpc = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: unknown };

const tools = [
  {
    name: "alex_decide",
    description:
      "Submit a treasury intent to Alex. Returns Proceed / Proceed with flag / Hold for approval, the three memory blocks, and memory-grounded reasoning. The model cannot override the decision.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["transfer", "approve", "swap", "contract"] },
        token: { type: "string" },
        amount: { type: "number" },
        recipient: { type: "string" },
        scenario: { type: "string", enum: ["typical", "oversized", "unknown"] },
      },
    },
  },
  {
    name: "alex_memory",
    description: "Read AGENT_REPUTATION and all COUNTERPARTY_PROFILE records.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "alex_log",
    description: "List recorded treasury actions, including pending Holds.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "alex_resolve",
    description: "Approve or reject a pending Hold. Approval is recorded as a user override.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        resolution: { type: "string", enum: ["approved", "rejected"] },
      },
      required: ["id", "resolution"],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "alex_memory") {
    const snap = await memorySnapshot();
    return { AGENT_REPUTATION: snap.reputation, counterparties: snap.counterparties };
  }
  if (name === "alex_log") {
    const snap = await memorySnapshot();
    return { total: snap.actions.length, items: snap.actions };
  }
  if (name === "alex_resolve") {
    const id = String(args.id || "");
    const resolution = args.resolution === "rejected" ? "rejected" : "approved";
    return resolveHold(id, resolution);
  }
  if (name === "alex_decide") {
    return runDecide({
      action: (args.action as TxAction) || "transfer",
      token: String(args.token || "USDT"),
      amount: args.amount == null ? 500 : Number(args.amount),
      recipient: args.recipient ? String(args.recipient) : undefined,
      scenario: args.scenario as "typical" | "oversized" | "unknown" | undefined,
    });
  }
  throw new Error(`unknown tool: ${name}`);
}

function reply(id: JsonRpc["id"], result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }) + "\n");
}

function fail(id: JsonRpc["id"], message: string, code = -32000) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }) + "\n");
}

async function handle(msg: JsonRpc) {
  if (msg.method === "initialize") {
    reply(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "trace", version: "0.1.0" },
    });
    return;
  }
  if (msg.method === "notifications/initialized") return;
  if (msg.method === "tools/list") {
    reply(msg.id, { tools });
    return;
  }
  if (msg.method === "tools/call") {
    const params = msg.params as { name?: string; arguments?: Record<string, unknown> };
    const name = params?.name || "";
    const result = await callTool(name, params?.arguments || {});
    reply(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    return;
  }
  fail(msg.id ?? null, `unknown method ${msg.method}`, -32601);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\n");
  buf = lines.pop() || "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg: JsonRpc;
    try {
      msg = JSON.parse(trimmed) as JsonRpc;
    } catch {
      continue;
    }
    handle(msg).catch((err) => fail(msg.id ?? null, err instanceof Error ? err.message : "internal"));
  }
});
