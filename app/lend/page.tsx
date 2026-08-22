import { Header } from "@/components/Header";
import { Lend } from "@/components/Lend";
import { readAgentWalletFile } from "@/lib/agent-wallet-file";

export default function LendPage() {
  const wallet = readAgentWalletFile();
  return (
    <div className="min-h-screen">
      <Header />
      {wallet ? (
        <p className="mx-auto max-w-6xl px-5 pt-4 font-mono text-xs text-paper-500">
          Agent {wallet.address} · {wallet.network} · user wallets connect separately
        </p>
      ) : null}
      <Lend />
    </div>
  );
}
