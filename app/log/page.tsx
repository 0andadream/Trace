import { AppShell } from "@/components/AppShell";
import { AgentLog } from "@/components/AgentLog";
import { payoutIsLive } from "@/lib/bnpl/execute";

export default function LogPage() {
  return (
    <AppShell>
      <AgentLog execute={payoutIsLive()} />
    </AppShell>
  );
}
