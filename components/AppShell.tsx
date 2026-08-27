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
  const isDocs = path === "/docs";
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
    <div className="app-light min-w-0">
      <header className="fixed left-1/2 top-3 z-50 w-full max-w-7xl -translate-x-1/2 px-3 sm:top-6 sm:px-6">
        <div className="glass-nav flex h-14 items-center justify-between gap-2 rounded-full px-3 sm:h-16 sm:gap-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-8">
            <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Logo variant="compact" tone="light" subtitle="Reputation-weighted BNPL" />
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
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            {isLanding ? (
              <Link
                href="/docs"
                className="px-2 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 sm:px-3"
              >
                Docs
              </Link>
            ) : null}
            <span className="hidden items-center gap-1.5 rounded-full bg-[#7828E8] px-3 py-1 text-[11px] font-semibold text-white shadow-sm sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              Testnet
            </span>
            {isLanding ? (
              <Link
                href="/buy"
                className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-[#0A0219] px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-[#16082c] sm:h-9 sm:px-5 sm:text-xs"
              >
                Launch App
              </Link>
            ) : (
              <ConnectWallet variant="light" />
            )}
          </div>
        </div>
        {!isLanding ? (
          <nav className="mt-2 flex gap-1 overflow-x-auto rounded-full bg-white/80 px-2 py-1 ring-1 ring-black/5 md:hidden">
            {NAV.filter((n) => !n.ownerOnly || wallet.connected).map((n) => {
              const active = path === n.href || path?.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium ${
                    active ? "bg-black/5 text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <div className={`mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 ${!isLanding ? "pt-32 sm:pt-28" : "pt-24 sm:pt-28"}`}>
        {!isLanding && !isDocs ? (
          <div className="relative z-10">
            <div className="glass-panel stats-float overflow-hidden">
              <div className="grid grid-cols-2 divide-y divide-[#E8E7EC] md:grid-cols-4 md:divide-x md:divide-y-0">
                {(
                  [
                    ["What Alex can lend right now", status ? formatAmount(status.spendable_usd) : "—"],
                    ["Still owed to Alex, in total", status ? formatAmount(status.outstanding_exposure) : "—"],
                    ["Purchases on file", status ? String(status.total_purchases) : "—"],
                    ["People Alex has seen before", status ? String(status.wallets_with_history) : "—"],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col justify-center gap-1 p-4 sm:gap-1.5 sm:p-6 md:p-8">
                    <p className="text-[10px] font-medium uppercase leading-tight tracking-[0.1em] text-neutral-500 sm:text-[11px] sm:tracking-[0.12em]">{label}</p>
                    <p className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">{value}</p>
                  </div>
                ))}
              </div>
              {status?.as_of ? (
                <p className="border-t border-[#E8E7EC] px-6 py-3 text-[11px] text-neutral-400">
                  as of {new Date(status.as_of).toLocaleString()}
                  {status.block ? ` · block ${status.block}` : ""}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={!isLanding && !isDocs ? "relative z-20 -mt-4 pt-2 md:-mt-5" : undefined}>{children}</div>
      </div>
      <SiteFooter
        explorerHref={
          status?.address ? `https://sepolia.basescan.org/address/${status.address}` : undefined
        }
      />
    </div>
  );
}
