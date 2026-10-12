"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/cookies";

type Summary = {
  hasToken: boolean;
  paused: boolean;
  lastSeen: string | null;
  lastMode: string | null;
  lastRun: { at: string; dryRun: boolean; added: number; removed: number; present: number; preexisting: number; removedByOthers: number; errors: string[] } | null;
};

export default function AdminRealmSync({ realmId, summary }: { realmId: number; summary: Summary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "rotate" | "pause" | "resume") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/realms/${realmId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": readCookie("admin_csrf") },
        body: JSON.stringify({ action })
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (data.token) setToken(data.token);
      setConfirmRotate(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const run = summary.lastRun;
  return (
    <div className="hint" style={{ marginTop: 10, display: "grid", gap: 6 }}>
      <div>
        Whitelist sync:{" "}
        {!summary.hasToken
          ? "not set up"
          : summary.paused
            ? "paused (server changes nothing)"
            : summary.lastSeen
              ? `${summary.lastMode === "dryrun" ? "dry run" : "live"}, last check-in ${new Date(summary.lastSeen).toLocaleString()}`
              : "waiting for the server's first check-in"}
      </div>
      {run && (
        <div>
          Last run{run.dryRun ? " (dry run, would have)" : ""}: {run.added} added, {run.removed} removed, {run.present} on the list
          {run.preexisting > 0 && `, ${run.preexisting} already there by hand (left alone)`}
          {run.removedByOthers > 0 && `, ${run.removedByOthers} removed by someone on the server`}
          {run.errors.length > 0 && <div style={{ color: "#ff9fb1" }}>Errors: {run.errors.join("; ")}</div>}
        </div>
      )}
      {token && (
        <div style={{ wordBreak: "break-all" }}>
          New token, shown once. Give it to the server owner for the install script:
          <br />
          <code>{token}</code>
        </div>
      )}
      {error && <div style={{ color: "#ff9fb1" }}>{error}</div>}
      <div className="admin-actions">
        {summary.hasToken && (
          <button disabled={busy} onClick={() => act(summary.paused ? "resume" : "pause")}>
            {summary.paused ? "Resume sync" : "Pause sync"}
          </button>
        )}
        {confirmRotate ? (
          <>
            <button disabled={busy} onClick={() => act("rotate")}>
              {summary.hasToken ? "Yes, replace token" : "Create token"}
            </button>
            <button onClick={() => setConfirmRotate(false)}>Never mind</button>
          </>
        ) : (
          <button disabled={busy} onClick={() => setConfirmRotate(true)}>
            {summary.hasToken ? "Replace token" : "Set up sync"}
          </button>
        )}
      </div>
      {confirmRotate && summary.hasToken && <div>The old token stops working at once, so the server needs the new one.</div>}
    </div>
  );
}
