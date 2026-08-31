import { AppShell } from "@/components/AppShell";
import { HistoryView } from "@/components/HistoryView";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return (
    <AppShell>
      <HistoryView />
    </AppShell>
  );
}
