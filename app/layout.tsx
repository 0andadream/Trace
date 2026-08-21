import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  title: "Trace — Alex, autonomous treasury agent",
  description:
    "Memory-grounded treasury decisions. Proceed, flag, or hold — from operating history, not vibes.",
  icons: {
    icon: "/icon.jpg",
    apple: "/icon.jpg",
  },
  openGraph: {
    title: "Trace",
    description: "Alex, autonomous treasury agent.",
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <div className="pointer-events-none fixed bottom-3 right-4 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-500">
          build {sha}
        </div>
      </body>
    </html>
  );
}
