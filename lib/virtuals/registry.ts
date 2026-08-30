import {
  ALEX_ACP_AGENT_ID,
  ALEX_ACP_PORTAL_WALLET,
  ALEX_ACP_PROFILE_URL,
  ALEX_ACP_REGISTRY_URL,
  ALEX_AGENT_NAME,
} from "@/lib/virtuals/identity";

export type AlexRegistryProfile = {
  ok: boolean;
  id: string;
  name: string;
  role: string | null;
  walletAddress: string | null;
  offerings: number;
  lastActiveAt: string | null;
  profileUrl: string;
  registryUrl: string;
  reason?: string;
};

export async function fetchAlexRegistry(): Promise<AlexRegistryProfile> {
  const fallback: AlexRegistryProfile = {
    ok: false,
    id: ALEX_ACP_AGENT_ID,
    name: ALEX_AGENT_NAME,
    role: "HYBRID",
    walletAddress: ALEX_ACP_PORTAL_WALLET,
    offerings: 0,
    lastActiveAt: null,
    profileUrl: ALEX_ACP_PROFILE_URL,
    registryUrl: ALEX_ACP_REGISTRY_URL,
    reason: "Virtuals registry unreachable.",
  };
  try {
    const res = await fetch(ALEX_ACP_REGISTRY_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { ...fallback, reason: `Virtuals registry HTTP ${res.status}.` };
    }
    const body = (await res.json()) as { data?: Record<string, unknown> };
    const row = body.data || {};
    const offerings = Array.isArray(row.offerings) ? row.offerings.length : 0;
    const wallet =
      typeof row.walletAddress === "string" && /^0x[a-fA-F0-9]{40}$/.test(row.walletAddress)
        ? row.walletAddress.toLowerCase()
        : null;
    return {
      ok: true,
      id: String(row.id || ALEX_ACP_AGENT_ID),
      name: String(row.name || ALEX_AGENT_NAME),
      role: row.role ? String(row.role) : null,
      walletAddress: wallet,
      offerings,
      lastActiveAt: row.lastActiveAt ? String(row.lastActiveAt) : null,
      profileUrl: ALEX_ACP_PROFILE_URL,
      registryUrl: ALEX_ACP_REGISTRY_URL,
    };
  } catch (err) {
    return { ...fallback, reason: err instanceof Error ? err.message : "registry fetch failed" };
  }
}
