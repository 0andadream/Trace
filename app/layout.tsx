import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { buildSha } from "@/lib/trace/build";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3002"),
  title: "TRACE, buy now, pay later",
  description: "Reputation-weighted BNPL that remembers you. Buy now. Pay over time. Powered by Sibyl Memory.",
  icons: {
    icon: "/icon.jpg",
    apple: "/icon.jpg",
  },
  openGraph: {
    title: "Trace",
    description: "Buy now. Pay over time. Build a financial reputation as you go.",
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sha = buildSha();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <div
          data-trace-build={sha}
          className="pointer-events-none fixed bottom-3 right-4 z-[60] font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400"
        >
          build {sha}
        </div>
      </body>
    </html>
  );
}
