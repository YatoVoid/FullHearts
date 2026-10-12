"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PRICE_LABEL } from "@/lib/educraft";

type Info = { state: string; nickname?: string };

const DEAD: Record<string, string> = {
  expired: "This payment link has expired or isn't valid.",
  already_subscribed: "This child already has an active subscription. Nothing more to do.",
  not_approved: "This request isn't approved right now.",
  billing_off: "Payments aren't open yet. We'll email you when they are.",
  not_yours: "This payment link isn't valid."
};

export default function PayLink() {
  // The token sits after the # so it never reaches server logs or a Referer header.
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.location.hash.slice(1);
    setToken(t);
    if (!t) {
      setInfo({ state: "expired" });
      return;
    }
    fetch("/api/server/pay/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) })
      .then((r) => r.json() as Promise<Info>)
      .then(setInfo)
      .catch(() => setError("Couldn't reach the server. Reload to try again."));
  }, []);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/server/pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, consent })
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't open the payment page. Try again.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !info) return <div className="alert alert--error" role="alert">{error}</div>;
  if (!info) return <p>Checking your link...</p>;
  if (info.state !== "ok") {
    return (
      <>
        <div className="alert alert--info" role="status">{DEAD[info.state] ?? DEAD.expired}</div>
        <p>
          You can always pay from <Link href="/server/account/">your account</Link>. Sign in with the email you
          registered with.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="price-box">
        <strong>{PRICE_LABEL}</strong>
        <span>a month for {info.nickname}. Renews monthly until you cancel.</span>
      </div>
      <label className="checkline">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I agree to {PRICE_LABEL} a month for {info.nickname}, renewing automatically until I cancel from my account.
          Cancelling ends access right away and refunds the unused days. <Link href="/server/terms/" target="_blank">Terms</Link>
        </span>
      </label>
      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <button className="btn btn--primary btn--block" disabled={busy || !consent} onClick={pay}>
        {busy ? "Opening Stripe..." : "Continue to secure payment"}
      </button>
      <p className="hint" style={{ marginTop: 12 }}>Payment is handled by Stripe. We never see your card number.</p>
    </>
  );
}
