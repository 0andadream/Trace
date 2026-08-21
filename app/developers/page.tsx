import { Header } from "@/components/Header";

export default function DevelopersPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10">
        <p className="mono-label text-trace">Developers</p>
        <h1 className="mt-2 text-3xl tracking-tight">Agent API</h1>
        <p className="mt-2 max-w-2xl text-sm text-paper-300">
          POST a treasury intent. Receive a policy decision, the three memory blocks, and Alex&apos;s
          reasoning. The model cannot change <code>decision</code> or <code>RISK_SCORE</code>.
        </p>

        <section className="panel mt-8 p-5">
          <div className="mono-label">POST /api/decide</div>
          <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-paper-300">{`{
  "action": "transfer",
  "token": "USDT",
  "amount": 500,
  "recipient": "0x1111111111111111111111111111111111111111"
}

// or a seeded scenario
{ "scenario": "typical" | "oversized" | "unknown" }`}</pre>
        </section>

        <section className="panel mt-4 p-5">
          <div className="mono-label">Response</div>
          <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-paper-300">{`{
  "verdict": {
    "decision": "Proceed" | "Proceed with flag" | "Hold for approval",
    "reasoning": ["…"],
    "risk": 0.08,
    "source": "deterministic" | "grok-4.6"
  },
  "memory": {
    "AGENT_REPUTATION": { "totalActions": 24, "…": "…" },
    "COUNTERPARTY_PROFILE": { "interactionCount": 16 } | null,
    "RISK_SCORE": 0.08
  }
}`}</pre>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="panel p-5">
            <div className="mono-label">Hold resolution</div>
            <pre className="mt-4 overflow-x-auto text-xs text-paper-300">{`POST /api/log/resolve
{ "id": "live-…", "resolution": "approved" | "rejected" }

GET /api/memory
GET /api/log`}</pre>
          </article>
          <article className="panel p-5">
            <div className="mono-label">Policy</div>
            <p className="mt-3 text-sm leading-relaxed text-paper-300">
              RISK_SCORE &lt; 0.30 → Proceed
              <br />
              0.30–0.60 → Proceed with flag
              <br />
              &gt; 0.60 → Hold for approval
            </p>
            <p className="mt-3 text-sm text-paper-300">
              Thin history (&lt; 3 actions) and high Hold-override rates prefer Hold. Empty
              counterparty profiles are stated in the first reasoning line.
            </p>
          </article>
        </section>

        <section className="panel mt-8 p-5">
          <div className="mono-label">MCP</div>
          <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-paper-300">{`pnpm mcp

# ~/.grok/config.toml
[mcp_servers.trace]
command = "npx"
args = ["tsx", "mcp/server.ts"]
# run from the Trace repo root

# tools: alex_decide · alex_memory · alex_log · alex_resolve`}</pre>
        </section>
      </main>
    </div>
  );
}
