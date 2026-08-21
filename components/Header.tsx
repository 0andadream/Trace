"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/desk", label: "Desk" },
  { href: "/memory", label: "Memory" },
  { href: "/log", label: "Log" },
  { href: "/developers", label: "Developers" },
];

export function Header() {
  const path = usePathname();

  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <div>
            <div className="text-sm font-medium tracking-tight">Trace</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-500">
              Alex · Treasury Agent
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-paper-500">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={active ? "text-trace" : "hover:text-paper"}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
