import type { NextConfig } from "next";

const sha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);

const NO_STORE = [
  { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Vercel-CDN-Cache-Control", value: "no-store" },
  { key: "x-trace-build", value: sha },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/", headers: NO_STORE },
      {
        source: "/:path((?!_next/static|_next/image|.*\\..*).*)",
        headers: NO_STORE,
      },
    ];
  },
};

export default nextConfig;
