import { pingStore } from "@/lib/memory/persist";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = await pingStore();
    return NextResponse.json({
      ok: true,
      sibyl: "up",
      store: store.backend,
      persistence: store.backend === "kv" ? "redis-no-ttl" : "file",
      label: store.label,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sibyl Memory unavailable";
    return NextResponse.json({ ok: false, sibyl: "down", error: message, loadBearing: true }, { status: 503 });
  }
}
