import { AppShell } from "@/components/AppShell";
import { AgentLog } from "@/components/AgentLog";
import { payoutIsLive } from "@/lib/bnpl/execute";
import { getLogPayload } from "@/lib/trace/logPayload";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const initial = await getLogPayload();
  return (
    <AppShell>
      <AgentLog execute={payoutIsLive()} initial={initial} />
    </AppShell>
  );
}
