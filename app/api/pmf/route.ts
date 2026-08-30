import { callSibyl } from "@/lib/memory/sibyl";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    const row = {
      email,
      audience: String(body.audience || "").slice(0, 240),
      pain: String(body.pain || "").slice(0, 240),
      at: new Date().toISOString(),
    };
    const result = await callSibyl("waitlist_add", { row });
    return NextResponse.json({ ok: true, saved: true, health: result.health });
  } catch (err) {
    const status = err instanceof SibylUnavailable ? 503 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "pmf failed" },
      { status },
    );
  }
}
