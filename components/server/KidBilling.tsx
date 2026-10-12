"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BillingAction } from "@/lib/kid-status";
import { PRICE_LABEL } from "@/lib/educraft";

async function post(url: string, body: object): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export default function KidBilling({
  childId,
  nickname,
  action,
  canCancel
}: {
  childId: number;
  nickname: string;
  action: BillingAction;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function go(url: string, body: object, onOk: (data: Record<string, unknown>) => void) {
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post(url, body);
      if (!ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
        return;
      }
      onOk(data);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const redirectTo = (data: Record<string, unknown>) => {
    if (typeof data.url === "string") window.location.assign(data.url);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {action === "subscribe" && (
        <>
          <label className="checkline" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {PRICE_LABEL} a month for {nickname}, renewing automatically until I cancel. Cancelling ends access right away
              and refunds the unused days. <Link href="/server/terms/" target="_blank">Terms</Link>
            </span>
          </label>
          <div>
            <button
              className="btn btn--primary"
              disabled={busy || !consent}
              onClick={() => go("/api/server/billing/checkout", { childId, consent }, redirectTo)}
            >
              {busy ? "Opening..." : `Subscribe for ${PRICE_LABEL}/month`}
            </button>
          </div>
        </>
      )}
      {action === "manage" && (
        <div className="row-between" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn--ghost" disabled={busy} onClick={() => go("/api/server/billing/portal", {}, redirectTo)}>
            Change card
          </button>
          {canCancel && !confirmCancel && (
            <button className="linkish" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Cancel subscription
            </button>
          )}
        </div>
      )}
      {confirmCancel && (
        <div className="alert alert--error" role="group" aria-label="Confirm cancellation">
          <p style={{ margin: "0 0 12px" }}>
            {nickname} loses access right away, and we refund the unused days of this month. Only changing cards? Use
            Change card instead.
          </p>
          <div className="row-between" style={{ justifyContent: "flex-start" }}>
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                go("/api/server/billing/cancel", { childId, confirm: true }, (data) => {
                  const cents = typeof data.refundedCents === "number" ? data.refundedCents : 0;
                  setConfirmCancel(false);
                  setNotice(
                    data.refundFailed
                      ? "Cancelled. We'll refund the unused days by hand within a few days."
                      : cents > 0
                        ? `Cancelled. $${(cents / 100).toFixed(2)} is on its way back to your card.`
                        : "Cancelled."
                  );
                  router.refresh();
                })
              }
            >
              {busy ? "Cancelling..." : "Yes, cancel"}
            </button>
            <button className="linkish" onClick={() => setConfirmCancel(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {notice && <div className="alert alert--ok" role="status">{notice}</div>}
      {error && <div className="alert alert--error" role="alert">{error}</div>}
    </div>
  );
}
