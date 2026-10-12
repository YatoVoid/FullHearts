"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/cookies";

export default function AdminEmailRetry({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/${id}/retry`, {
        method: "POST",
        headers: { "x-csrf-token": readCookie("admin_csrf") }
      });
      if (!res.ok) {
        setError("Couldn't requeue it.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={retry} disabled={busy}>
        {busy ? "Queuing..." : "Try again"}
      </button>
      {error && <span className="hint"> {error}</span>}
    </>
  );
}
