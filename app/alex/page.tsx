import { Alex } from "@/components/Alex";
import { Header } from "@/components/Header";
import { readAgentWalletFile } from "@/lib/agent-wallet-file";

export default function AlexPage() {
  const wallet = readAgentWalletFile();
  return (
    <div className="min-h-screen">
      <Header />
      {wallet ? (
        <p className="mx-auto max-w-6xl px-5 pt-4 font-mono text-xs text-paper-500">
          Agent {wallet.address} · {wallet.network}
        </p>
      ) : null}
      <Alex />
    </div>
  );
}
