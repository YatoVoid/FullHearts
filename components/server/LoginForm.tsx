"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function post(url: string, body: object): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, error: data.error };
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await post("/api/server/auth/request-code", { email, website });
      if (!result.ok) {
        setError(result.error || "Couldn't send a code. Try again.");
        return;
      }
      if (step === "code") setResent(true);
      setStep("code");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await post("/api/server/auth/verify-code", { email, code });
      if (!result.ok) {
        setError(result.error || "That code didn't work.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} noValidate>
        {error && <div className="alert alert--error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="login-email">Your email</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
        />
        <button className="btn btn--primary btn--block" type="submit" disabled={busy || !email.trim()}>
          {busy ? "Sending..." : "Email me a code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} noValidate>
      <div className="alert alert--info" role="status">
        If <strong>{email}</strong> can receive mail, a code is on its way. It can take a minute, and it may land in
        spam.
      </div>
      {resent && <p className="hint" role="status">Sent a new code. Only the newest one works.</p>}
      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="login-code">6-digit code</label>
        <input
          id="login-code"
          className="input input--code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <button className="btn btn--primary btn--block" type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Checking..." : "Sign in"}
      </button>
      <div className="row-between" style={{ marginTop: 16 }}>
        <button type="button" className="linkish" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
          Use a different email
        </button>
        <button type="button" className="linkish" onClick={() => sendCode()} disabled={busy}>
          Send a new code
        </button>
      </div>
    </form>
  );
}
