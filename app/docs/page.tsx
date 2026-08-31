import { AppShell } from "@/components/AppShell";
import { DocsView } from "@/components/DocsView";

export const dynamic = "force-dynamic";

export default function DocsPage() {
  return (
    <AppShell>
      <DocsView />
    </AppShell>
  );
}
