import {
  checkDemoRateLimit,
  clientIp,
  demoRateWindowSec,
  releaseDemoLock,
  tryAcquireDemoLock,
} from "@/lib/bnpl/demoRateLimit";
import { runAgentDemo, type DemoEvent } from "@/lib/bnpl/demoRun";
import { SibylUnavailable } from "@/lib/memory/sibyl";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function sse(event: DemoEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rate = await checkDemoRateLimit(ip);
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: `Demo is rate limited. Try again in ${rate.retryAfterSec}s.`,
        retryAfterSec: rate.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  const locked = await tryAcquireDemoLock();
  if (!locked) {
    return NextResponse.json(
      { error: "A demo run is already in progress. Try again in a moment.", retryAfterSec: 30 },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: DemoEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          // visitor disconnected; the on-chain run still finishes
        }
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // ignore
        }
      }, 15_000);
      try {
        await runAgentDemo(emit);
      } catch (err) {
        const message =
          err instanceof SibylUnavailable
            ? err.message
            : err instanceof Error
              ? err.message
              : "Demo run failed.";
        emit({
          step: "error",
          status: "error",
          title: "Demo failed",
          message,
        });
      } finally {
        clearInterval(heartbeat);
        await releaseDemoLock();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Demo-Rate-Window": String(demoRateWindowSec()),
    },
  });
}
