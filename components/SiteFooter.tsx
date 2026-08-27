import Link from "next/link";
import { TraceMark } from "@/components/Logo";

const COLS: { heading: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/buy", label: "Buy" },
      { href: "/log", label: "Agent Log" },
      { href: "/buy", label: "Launch App" },
    ],
  },
  {
    heading: "Verify",
    links: [
      { href: "/#agent-status", label: "Agent status" },
      { href: "/docs", label: "Docs" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
  {
    heading: "Network",
    links: [
      { href: "https://sepolia.basescan.org", label: "Base Sepolia explorer", external: true },
      { href: "https://www.base.org/", label: "About Base", external: true },
    ],
  },
];

export function SiteFooter({ explorerHref }: { explorerHref?: string }) {
  const network = COLS.map((col) =>
    col.heading !== "Network"
      ? col
      : {
          ...col,
          links: col.links.map((l) =>
            l.label === "Base Sepolia explorer" && explorerHref ? { ...l, href: explorerHref } : l,
          ),
        },
  );

  return (
    <footer className="bg-[#0A0219] text-[#F4EFE4]">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:gap-12 sm:px-6 sm:py-16 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <TraceMark size={32} className="bg-[#16082c] ring-1 ring-white/25" />
            <span className="text-[17px] font-semibold tracking-tight">Trace</span>
          </Link>
          <p className="mt-4 max-w-[16rem] text-[14px] font-medium leading-[1.45] text-[#9B96AB]">
            Reputation-weighted BNPL that remembers you.
          </p>
          <p className="mt-2 max-w-[16rem] text-[13px] font-medium leading-[1.4] text-[#6B6578]">
            Powered by Sibyl Memory.
          </p>
        </div>
        {network.map((col) => (
          <div key={col.heading}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[#6B6578]">{col.heading}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[#F4EFE4] hover:text-white"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-sm text-[#F4EFE4] hover:text-white">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-6 py-5 text-[11px] text-[#6B6578]">
          Trace · Base Sepolia testnet · not a real loan
        </p>
      </div>
    </footer>
  );
}
