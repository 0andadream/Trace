"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resolve(resolution: "approved" | "rejected") {
    setBusy(true);
    try {
      await fetch("/api/log/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, resolution }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button className="btn-trace h-9 px-3 text-xs" disabled={busy} onClick={() => resolve("approved")}>
        Approve
      </button>
      <button className="btn-hold h-9 px-3 text-xs" disabled={busy} onClick={() => resolve("rejected")}>
        Reject
      </button>
    </div>
  );
}
