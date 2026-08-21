import { runDecide } from "@/lib/desk/run";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await runDecide(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "decide failed" },
      { status: 400 },
    );
  }
}
