import { AppShell } from "@/components/AppShell";
import { Desk } from "@/components/Desk";
import { payoutIsLive } from "@/lib/bnpl/execute";

export const dynamic = "force-dynamic";

export default function BuyPage() {
  return (
    <AppShell>
      <Desk execute={payoutIsLive()} />
    </AppShell>
  );
}
