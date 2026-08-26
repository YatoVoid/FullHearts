"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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

type ChildForm = {
  key: number;
  nickname: string;
  age: string;
  mcUsername: string;
};

type FormState = {
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  consent: boolean;
  // Honeypot: stays empty for real visitors. A bot that fills every field
  // on the page trips this, so the API accepts the request but drops it.
  company: string;
  children: ChildForm[];
};

function emptyChild(key: number): ChildForm {
  return { key, nickname: "", age: "", mcUsername: "" };
}

const EMPTY: FormState = {
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  consent: false,
  company: "",
  children: [emptyChild(0)]
};

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const nextKey = useRef(1);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setChild<K extends keyof ChildForm>(childKey: number, field: K, value: ChildForm[K]) {
    setForm((f) => ({
      ...f,
      children: f.children.map((c) => (c.key === childKey ? { ...c, [field]: value } : c))
    }));
  }

  function addChild() {
    setForm((f) => ({ ...f, children: [...f.children, emptyChild(nextKey.current++)] }));
  }

  function removeChild(childKey: number) {
    setForm((f) => (f.children.length > 1 ? { ...f, children: f.children.filter((c) => c.key !== childKey) } : f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    for (const child of form.children) {
      if (sameName(child.nickname, form.parentName) || sameName(child.mcUsername, form.parentName)) {
        setError("Parent name can't be the same as a child's nickname or Minecraft username.");
        return;
      }
    }

    const parent = {
      parentName: form.parentName,
      parentPhone: form.parentPhone,
      parentEmail: form.parentEmail || undefined,
      consent: form.consent
    };
    const children = form.children.map((c) => ({
      childNickname: c.nickname,
      childAge: Number(c.age),
      childMcUsername: c.mcUsername
    }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent, children, company: form.company })
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
          body: JSON.stringify({ parent, children })
        }).catch(() => {});
      }

      // Billing goes here once it exists: every child only ever records a
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
          This form is for a parent or guardian to request whitelist access for their children. Add every child
          you&apos;re registering below, one parent covers all of them. There is no instant activation, every
          request is reviewed by hand before an account goes live. See{" "}
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

            {form.children.map((child, i) => (
              <div className="child-block" key={child.key}>
                <div className="child-block-head">
                  <span className="child-block-label">Child {i + 1}</span>
                  {form.children.length > 1 && (
                    <button type="button" className="child-remove" onClick={() => removeChild(child.key)}>
                      Remove
                    </button>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor={`nickname-${child.key}`}>Nickname</label>
                  <input
                    id={`nickname-${child.key}`}
                    className="form-input"
                    value={child.nickname}
                    onChange={(e) => setChild(child.key, "nickname", e.target.value)}
                    maxLength={40}
                    required
                  />
                  <span className="hint">Just a first name or nickname, never their full legal name.</span>
                </div>

                <div className="form-field">
                  <label htmlFor={`age-${child.key}`}>Age</label>
                  <input
                    id={`age-${child.key}`}
                    type="number"
                    min={4}
                    max={17}
                    className="form-input"
                    value={child.age}
                    onChange={(e) => setChild(child.key, "age", e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={`mcUsername-${child.key}`}>Minecraft Java username</label>
                  <input
                    id={`mcUsername-${child.key}`}
                    className="form-input"
                    value={child.mcUsername}
                    onChange={(e) => setChild(child.key, "mcUsername", e.target.value)}
                    maxLength={16}
                    required
                  />
                  <span className="hint">The exact Java Edition username, since that&apos;s what gets whitelisted.</span>
                </div>
              </div>
            ))}

            <button type="button" className="btn-ghost" style={{ width: "100%", marginBottom: 20 }} onClick={addChild}>
              + Add another child
            </button>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
                required
              />
              <span>
                I am each of these children&apos;s parent or legal guardian, and I&apos;m requesting access on their
                behalf. I&apos;ve read the <Link href="/privacy">Privacy</Link> page.
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
