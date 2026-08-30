"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgentIdentityCard, AgentRoleStack, AlexVerificationRow } from "@/components/AlexIdentity";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How it works" },
  { id: "standing", label: "Reputation" },
  { id: "memory", label: "Memory" },
  { id: "payments", label: "Payments" },
  { id: "try-it", label: "Try it" },
  { id: "faq", label: "FAQ" },
] as const;

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS: Record<(typeof NAV)[number]["id"], string> = {
  overview: "M2.5 8.5 8 3l5.5 5.5M4 7.5V13h8V7.5",
  "how-it-works": "M3 4.5h10M3 8h10M3 11.5h6",
  standing: "M3 13V8.5M8 13V3M13 13V6",
  memory: "M3 4.5h10v7H3zM5.5 7h5M5.5 9.5h3",
  payments: "M3 5.5h10v6H3zM3 8h10",
  "try-it": "M5 3.5 12 8 5 12.5z",
  faq: "M5.5 6a2.5 2.5 0 1 1 3.4 2.3C8.2 8.7 8 9.1 8 9.6V10M8 12.5h.01",
};

function Section({
  id,
  title,
  children,
}: {
  id: (typeof NAV)[number]["id"];
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-40 space-y-6">
      <div className="flex items-center gap-3 border-b border-black/5 pb-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7828E8]/10 text-[#7828E8]">
          <Icon d={ICONS[id]} />
        </span>
        <h2 className="text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] text-neutral-900 sm:text-[2rem]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="text-base font-medium leading-relaxed text-neutral-800">{children}</p>;
}

function Sub({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-8 text-sm font-semibold text-neutral-900">{children}</h3>;
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex gap-3 rounded-xl border border-[#7828E8]/20 bg-[#7828E8]/5 p-5 text-[#6a1fd4]">
      <Icon d="M8 3.5A4.5 4.5 0 1 1 8 12.5 4.5 4.5 0 0 1 8 3.5ZM8 8v2.2M8 5.7h.01" className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Check({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[#7828E8]">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-sm leading-relaxed text-neutral-600">
        <strong className="font-medium text-neutral-900">{title}: </strong>
        {body}
      </span>
    </li>
  );
}

const FAQ = [
  {
    q: "Is this a real loan?",
    a: "No. This site is Base Sepolia testnet, not a real loan and not mainnet. You cannot lose mainnet dollars here.",
  },
  {
    q: "Does TRACE pull a credit score?",
    a: "No. TRACE reputation is not a bureau score. If you have bought here before, the deal uses that history. If you have not, it uses a conservative read of your wallet’s onchain activity, fetched fresh and not stored.",
  },
  {
    q: "Where does the ETH go?",
    a: "When TRACE finances a purchase, ETH is sent to the wallet you connected. Merchant names are labels. Amounts in the UI are shown in USDC. This is the technical settlement path, not a store shipment.",
  },
  {
    q: "How do I repay?",
    a: "You sign a transfer to the TRACE agent on Base Sepolia. The amount is shown in USDC. You can pay the next installment or the rest at once. Late and missed payments go in Sibyl Memory.",
  },
  {
    q: "What wallet do I need?",
    a: "An injected EVM wallet in the browser. Connect is your login. Switch to Base Sepolia (chain 84532).",
  },
  {
    q: "Is the Agent Log public?",
    a: "Yes. Anyone can read it. My History is only for the connected wallet.",
  },
  {
    q: "Can I talk TRACE into a better deal?",
    a: "No. Code sets the yes, the no, the limit, and the schedule. Any written reason is just the explanation.",
  },
  {
    q: "What if Sibyl Memory is deleted?",
    a: "You look new again: smaller limit, shorter plan. Your wallet onchain did not change. The longer deal lived in memory, not on Base.",
  },
] as const;

export function DocsView() {
  const [active, setActive] = useState<(typeof NAV)[number]["id"]>("overview");
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]?.target.id) setActive(visible[0].target.id as (typeof NAV)[number]["id"]);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.current?.observe(el);
    });
    return () => observer.current?.disconnect();
  }, []);

  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex min-w-0 gap-12">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-32 space-y-1">
          <p className="mb-4 px-3 text-[12px] font-semibold uppercase tracking-[0.07em] text-neutral-400">
            Documentation
          </p>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all ${
                active === item.id
                  ? "bg-[#7828E8]/10 text-[#7828E8]"
                  : "text-neutral-500 hover:bg-black/5 hover:text-neutral-900"
              }`}
            >
              <Icon d={ICONS[item.id]} className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      <article className="min-w-0 max-w-3xl flex-1 space-y-20 overflow-x-clip pb-24">
        <Section id="overview" title="What is Trace?">
          <Lead>
            TRACE is reputation-weighted BNPL. Buy now. Pay over time. Build a financial reputation as
            you go. Powered by Sibyl Memory. Alex is TRACE&apos;s autonomous BNPL agent.
          </Lead>
          <div className="mt-5 rounded-2xl ring-1 ring-black/5 px-5 py-4">
            <p className="text-[15px] font-semibold text-neutral-900">Alex</p>
            <p className="text-[13px] text-neutral-500">TRACE&apos;s autonomous BNPL agent</p>
            <AlexVerificationRow />
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
              Alex is a registered autonomous agent on Virtuals ACP, giving TRACE a verifiable agent
              identity while TRACE&apos;s transaction execution remains independently controlled.
            </p>
            <div className="mt-4">
              <AgentIdentityCard />
            </div>
          </div>
          <Callout>
            Testnet only — no real goods or loans are provided. This site is Base Sepolia. Mainnet is
            not turned on.
          </Callout>
          <Sub>What problem does it solve?</Sub>
          <p className="text-sm leading-relaxed text-neutral-600">
            A bureau file does not know whether you paid TRACE back. Sibyl remembers purchases approved
            here, and whether those payments were on time, late, or missed. TRACE turns that history
            into reputation, and reputation into eligibility.
          </p>
          <Sub>What holds</Sub>
          <ul className="mt-4 space-y-3">
            <Check
              title="Memory is load-bearing"
              body="Delete Sibyl Memory and you look new again, even if the chain is unchanged."
            />
            <Check
              title="Code decides the numbers"
              body="Limit, schedule, and yes or no are computed in TypeScript. Any written reason is only the explanation."
            />
            <Check
              title="First time is cautious"
              body="No purchase history means a conservative onchain read, fetched fresh and not stored. After one purchase here, memory takes over."
            />
            <Check
              title="TRACE will not empty itself"
              body="It keeps a reserve and will say no if it cannot finance the purchase, even if you always pay on time."
            />
          </ul>
        </Section>

        <Section id="how-it-works" title="How it works">
          <Lead>Three steps. Connect is your login. Nothing else is an account.</Lead>
          <ol className="mt-4 list-none space-y-3">
            {[
              "You connect and ask to buy something. Alex, TRACE's autonomous agent, checks Sibyl Memory for this wallet.",
              "TRACE finances the purchase if you are eligible. You see the amount, how many payments, and when they are due. Settlement is Base Sepolia.",
              "You repay in parts. Each payment is on time, late, or missed. That is what the next deal is based on.",
            ].map((line, i) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-neutral-600">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7828E8]/10 text-[11px] font-bold text-[#7828E8]">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-2xl ring-1 ring-black/5 p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Role split</p>
            <AgentRoleStack />
          </div>
        </Section>

        <Section id="standing" title="Reputation and limits">
          <Lead>
            TRACE reputation moves slowly. The limit can still rise. Those two numbers are not the same
            thing.
          </Lead>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Reputation", "Each completed on-time plan adds 0.005. The ring shows reputation × 100. Max is 95. An open plan does not raise it above 0.38."],
                ["TRACE limit", "Score 0–50 stays under $3k. 50 is $3k. 95 is $10k, the max you can buy at once. At most two open plans."],
                ["Interest", "Lower reputation means higher TRACE interest. You can pay the rest in one shot when you repay."],
                ["First-time cap", "New wallets start small. TRACE is extra careful with people it does not know."],
              ] as const
            ).map(([label, desc]) => (
              <div key={label} className="glass-panel space-y-2 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
                <p className="text-sm leading-relaxed text-neutral-600">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="memory" title="What Sibyl remembers">
          <Lead>
            What you bought here, when payments were due, and whether you paid on time, late, or missed.
            Not your name. Not your email.
          </Lead>
          <Sub>Sibyl Memory</Sub>
          <p className="text-sm leading-relaxed text-neutral-600">
            History lives in Sibyl Memory. Reputation, limits, and ceilings are computed in TRACE’s
            TypeScript, not inside Sibyl. Sibyl stores the book. TRACE turns it into eligibility.
          </p>
          <Callout>
            Without memory, you start from zero. Delete Sibyl Memory and TRACE loses the financial
            history behind your previous offers. With Sibyl Memory, previous behavior can influence
            what you&apos;re offered next.
          </Callout>
        </Section>

        <Section id="payments" title="Payments">
          <Lead>
            Amounts on screen are USDC-equivalent. Settlement is on Base Sepolia, to and from the
            wallet you connected.
          </Lead>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="glass-panel space-y-2 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Network</p>
              <p className="text-base font-semibold text-neutral-900">Base Sepolia</p>
              <p className="text-xs text-neutral-500">
                Chain ID: <span className="font-mono text-neutral-900">84532</span>
              </p>
            </div>
            <div className="glass-panel space-y-2 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Agent account</p>
              <p className="break-all font-mono text-[13px] text-neutral-900">0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e</p>
              <a
                href="https://sepolia.basescan.org/address/0x6F75c81375B43AcE7cE839D6eAc7192e10a4440e"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[#7828E8] hover:underline"
              >
                View on Basescan
              </a>
            </div>
          </div>
        </Section>

        <Section id="try-it" title="Try it">
          <Lead>Open Buy, connect, enter an amount, and ask. First time, you start small.</Lead>
          <ol className="mt-4 list-none space-y-3">
            {[
              "Go to Buy and connect a wallet. That is your login.",
              "Choose a purchase amount and how you’ll pay: today, or with TRACE over time.",
              "If eligible, TRACE finances the purchase. Repay from Buy or My History.",
              "The Agent Log is public. My History is only visible when that wallet is connected.",
            ].map((line, i) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-neutral-600">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7828E8]/10 text-[11px] font-bold text-[#7828E8]">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Link
              href="/buy"
              className="inline-flex h-11 items-center rounded-full bg-[#7828E8] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#6a1fd4]"
            >
              Launch App
            </Link>
          </div>
        </Section>

        <Section id="faq" title="FAQ">
          <div className="mt-4 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="glass-panel space-y-3 p-6">
                <p className="text-sm font-semibold text-neutral-900">{item.q}</p>
                <p className="text-sm leading-relaxed text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>
          <div className="glass-panel mt-12 flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-semibold text-neutral-900">Still have questions?</p>
              <p className="mt-1 text-sm text-neutral-500">The Agent Log is public. Buy is the live desk.</p>
            </div>
            <Link
              href="/buy"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-black/5"
            >
              Back to Buy
            </Link>
          </div>
        </Section>
      </article>
    </div>
  );
}
