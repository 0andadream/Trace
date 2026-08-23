"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectWallet, useInjectedWallet } from "@/components/ConnectWallet";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { formatAmount } from "@/lib/format";
import type { AgentStatus } from "@/lib/bnpl/status";

const NAV: { href: string; label: string; ownerOnly?: boolean }[] = [
  { href: "/buy", label: "Buy" },
  { href: "/history", label: "My History", ownerOnly: true },
  { href: "/log", label: "Agent Log" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isLanding = path === "/";
  const wallet = useInjectedWallet();
  const [status, setStatus] = useState<AgentStatus | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/agent-status")
        .then((r) => r.json())
        .then((d) => {
          if (live && !d.error) setStatus(d as AgentStatus);
        })
        .catch(() => {});
    load();
    const t = window.setInterval(load, 15_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div className="app-light">
      <header className="fixed left-1/2 top-6 z-50 w-full max-w-7xl -translate-x-1/2 px-4 sm:px-6">
        <div className="glass-nav flex h-16 items-center justify-between rounded-full px-5">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <Logo variant="compact" tone="light" subtitle="Buy now, pay later" />
            </Link>
            {!isLanding ? (
              <nav className="hidden items-center gap-1 md:flex">
                {NAV.filter((n) => !n.ownerOnly || wallet.connected).map((n) => {
                  const active = path === n.href || path?.startsWith(`${n.href}/`);
                  const cls = `px-4 py-2 text-xs font-medium transition-all rounded-full ${
                    active
                      ? "bg-black/5 text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:bg-black/5 hover:text-neutral-900"
                  }`;
                  return (
                    <Link key={n.href} href={n.href} className={cls}>
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-[#7828E8] px-3 py-1 text-[11px] font-semibold text-white shadow-sm sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              Testnet
            </span>
            {isLanding ? (
              <Link
                href="/buy"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-[#0A0219] px-5 text-xs font-semibold text-white shadow-sm hover:bg-[#16082c]"
              >
                Launch App
              </Link>
            ) : (
              <ConnectWallet variant="light" />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6">
        {!isLanding ? (
          <div className="glass-panel mb-8 grid grid-cols-2 divide-y divide-[#E8E7EC] md:grid-cols-4 md:divide-x md:divide-y-0">
            {(
              [
                ["Alex’s cash", status ? formatAmount(status.spendable_usd) : "—"],
                ["Still owed", status ? formatAmount(status.outstanding_exposure) : "—"],
                ["Purchases", status ? String(status.total_purchases) : "—"],
                ["People on file", status ? String(status.wallets_with_history) : "—"],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col justify-center gap-1.5 p-6 md:p-8">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">{label}</p>
                <p className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {!isLanding && status?.as_of ? (
          <p className="-mt-4 mb-6 text-[11px] text-neutral-400">
            as of {new Date(status.as_of).toLocaleString()}
            {status.block ? ` · block ${status.block}` : ""}
          </p>
        ) : null}
        {children}
      </div>
      <SiteFooter
        explorerHref={
          status?.address ? `https://sepolia.basescan.org/address/${status.address}` : undefined
        }
      />
    </div>
  );
}
