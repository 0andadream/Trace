import { NextResponse } from "next/server";
import { readAcpJob } from "@/lib/virtuals/acp";
import { getAgentInfrastructure } from "@/lib/virtuals/status";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId")?.trim();
    if (jobId) {
      const job = await readAcpJob(jobId);
      return NextResponse.json({ job });
    }
    const infra = await getAgentInfrastructure();
    return NextResponse.json(infra);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "virtuals status failed" },
      { status: 400 },
    );
  }
}
