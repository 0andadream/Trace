import { getLogPayload } from "@/lib/trace/logPayload";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const payload = await getLogPayload();
  return NextResponse.json({
    ...payload,
    items: [],
    pending: 0,
  });
}
