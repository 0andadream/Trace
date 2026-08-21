import { resolveHold } from "@/lib/desk/run";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; resolution?: "approved" | "rejected" };
    if (!body.id || (body.resolution !== "approved" && body.resolution !== "rejected")) {
      return NextResponse.json({ error: "id and resolution required" }, { status: 400 });
    }
    const updated = await resolveHold(body.id, body.resolution);
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "resolve failed" },
      { status: 400 },
    );
  }
}
