"use client";

import Link from "next/link";
import { useState } from "react";
import Footer from "@/components/Footer";
import { HEART_SRC } from "@/lib/asset";
import { sameName } from "@/lib/registerValidation";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

const FORMSPREE_FORM_ID = process.env.NEXT_PUBLIC_FORMSPREE_FORM_ID;

type FormState = {
  childNickname: string;
  childAge: string;
  childMcUsername: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  consent: boolean;
  // Honeypot: stays empty for real visitors. A bot that fills every field
  // on the page trips this, so the API accepts the request but drops it.
  company: string;
};

const EMPTY: FormState = {
  childNickname: "",
  childAge: "",
  childMcUsername: "",
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  consent: false,
  company: ""
};

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (sameName(form.childNickname, form.parentName) || sameName(form.childMcUsername, form.parentName)) {
      setError("Parent name can't be the same as the child's nickname or Minecraft username.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childNickname: form.childNickname,
          childAge: Number(form.childAge),
          childMcUsername: form.childMcUsername,
          parentName: form.parentName,
          parentPhone: form.parentPhone,
          parentEmail: form.parentEmail || undefined,
          consent: form.consent,
          company: form.company
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }

      // Best-effort notification copy via Formspree. Failure here never
      // blocks the registration, which is already saved above.
      if (FORMSPREE_FORM_ID) {
        fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            childNickname: form.childNickname,
            childAge: form.childAge,
            childMcUsername: form.childMcUsername,
            parentName: form.parentName,
            parentPhone: form.parentPhone,
            parentEmail: form.parentEmail
          })
        }).catch(() => {});
      }

      // Billing goes here once it exists: this request only ever records a
      // $0 pending registration, so a payment step slots in between the
      // /api/register call above and setDone(true) below without touching
      // anything else in this handler.
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <nav className="links">
            <Link href="/server">Our server</Link>
          </nav>
        </div>
      </header>

      <main className="prose">
        <h1>Request EduCraft access</h1>
        <p>
          This form is for a parent or guardian to request whitelist access for their child. There is no instant
          activation, every request is reviewed by hand before an account goes live. See{" "}
          <Link href="/server">how EduCraft works</Link> first if you haven&apos;t already.
        </p>

        {done ? (
          <div className="form-success">
            <strong>Request received.</strong> We&apos;ll review it and reach out at the phone number you gave us.
            This is never instant, so please don&apos;t worry if it takes a little while.
          </div>
        ) : (
          <form className="form-card" onSubmit={onSubmit} noValidate>
            <input
              type="text"
              name="company"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
            />

            <div className="form-note">EduCraft is $0/month during our founding beta. Pricing may apply later.</div>

            {error && <div className="form-error">{error}</div>}

            <div className="form-field">
              <label htmlFor="childNickname">Child&apos;s nickname</label>
              <input
                id="childNickname"
                className="form-input"
                value={form.childNickname}
                onChange={(e) => set("childNickname", e.target.value)}
                maxLength={40}
                required
              />
              <span className="hint">Just a first name or nickname, never their full legal name.</span>
            </div>

            <div className="form-field">
              <label htmlFor="childAge">Child&apos;s age</label>
              <input
                id="childAge"
                type="number"
                min={4}
                max={17}
                className="form-input"
                value={form.childAge}
                onChange={(e) => set("childAge", e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="childMcUsername">Child&apos;s Minecraft Java username</label>
              <input
                id="childMcUsername"
                className="form-input"
                value={form.childMcUsername}
                onChange={(e) => set("childMcUsername", e.target.value)}
                maxLength={16}
                required
              />
              <span className="hint">The exact Java Edition username, since that&apos;s what gets whitelisted.</span>
            </div>

            <div className="form-field">
              <label htmlFor="parentName">Your name (parent/guardian)</label>
              <input
                id="parentName"
                className="form-input"
                value={form.parentName}
                onChange={(e) => set("parentName", e.target.value)}
                maxLength={80}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="parentPhone">Your phone number</label>
              <input
                id="parentPhone"
                type="tel"
                className="form-input"
                value={form.parentPhone}
                onChange={(e) => set("parentPhone", e.target.value)}
                required
              />
              <span className="hint">Required, so we can confirm the request with you.</span>
            </div>

            <div className="form-field">
              <label htmlFor="parentEmail">Your email (optional)</label>
              <input
                id="parentEmail"
                type="email"
                className="form-input"
                value={form.parentEmail}
                onChange={(e) => set("parentEmail", e.target.value)}
              />
            </div>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
                required
              />
              <span>
                I am this child&apos;s parent or legal guardian, and I&apos;m requesting access on their behalf. I&apos;ve
                read the <Link href="/privacy">Privacy</Link> page.
              </span>
            </label>

            <button className="btn-primary form-submit" type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Request access"}
            </button>

            {!FORMSPREE_FORM_ID && (
              <p className="hint" style={{ marginTop: 14 }}>
                Formspree isn&apos;t configured yet in this environment, so requests are only saved locally.
              </p>
            )}
          </form>
        )}
      </main>

      <Footer />
    </>
  );
}
