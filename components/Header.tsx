"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/alex", label: "Alex" },
  { href: "/memory", label: "Memory" },
  { href: "/log", label: "Log" },
];

export function Header() {
  const path = usePathname();

  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center py-1" aria-label="Trace home">
          <Logo variant="compact" />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-paper-500">
          {NAV.map((n) => {
            const active = path === n.href || path?.startsWith(`${n.href}/`);
            return (
              <Link key={n.href} href={n.href} className={active ? "text-white" : "hover:text-paper"}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
