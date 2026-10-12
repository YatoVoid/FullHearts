"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MC_USERNAME_RE, validateSubmission } from "@/lib/registerValidation";
import { PRICE_LABEL } from "@/lib/educraft";

type Check = { state: "idle" | "checking" | "found" | "not_found" | "invalid" | "unavailable"; name?: string };

type ChildForm = { key: number; nickname: string; age: string; mcUsername: string; check: Check };

const emptyChild = (key: number): ChildForm => ({ key, nickname: "", age: "", mcUsername: "", check: { state: "idle" } });

function checkMessage(check: Check): { text: string; tone: "ok" | "bad" | "" } {
  switch (check.state) {
    case "checking":
      return { text: "Checking with Mojang...", tone: "" };
    case "found":
      return { text: `Found the Java account ${check.name}.`, tone: "ok" };
    case "not_found":
      return { text: "Mojang has no Java account by that name. Check the spelling.", tone: "bad" };
    case "invalid":
      return { text: "3 to 16 letters, numbers or underscores.", tone: "bad" };
    case "unavailable":
      return { text: "Couldn't reach Mojang right now. You can still send the request.", tone: "" };
    default:
      return { text: "", tone: "" };
  }
}

export default function RegisterForm({ email, defaultName, defaultPhone }: { email: string; defaultName: string; defaultPhone: string }) {
  const [parentName, setParentName] = useState(defaultName);
  const [parentPhone, setParentPhone] = useState(defaultPhone);
  const [children, setChildren] = useState<ChildForm[]>([emptyChild(0)]);
  const [consentGuardian, setConsentGuardian] = useState(false);
  const [consentBilling, setConsentBilling] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const nextKey = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  function updateChild(key: number, patch: Partial<ChildForm>) {
    setChildren((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function onUsername(key: number, value: string) {
    updateChild(key, { mcUsername: value, check: { state: "idle" } });
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    const name = value.trim();
    if (!name) return;
    if (!MC_USERNAME_RE.test(name)) {
      updateChild(key, { mcUsername: value, check: { state: "invalid" } });
      return;
    }
    timers.current.set(
      key,
      setTimeout(async () => {
        updateChild(key, { check: { state: "checking" } });
        try {
          const res = await fetch("/api/server/mc-username", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
          });
          const data = (await res.json()) as { status?: Check["state"]; name?: string };
          setChildren((list) =>
            list.map((c) =>
              c.key === key && c.mcUsername.trim() === name
                ? { ...c, check: { state: res.ok && data.status ? data.status : "unavailable", name: data.name } }
                : c
            )
          );
        } catch {
          updateChild(key, { check: { state: "unavailable" } });
        }
      }, 500)
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const submission = {
      parent: { parentName, parentPhone, consentGuardian, consentBilling, consentTerms },
      children: children.map((c) => ({
        childNickname: c.nickname,
        childAge: Number(c.age),
        childMcUsername: c.check.state === "found" && c.check.name ? c.check.name : c.mcUsername
      }))
    };
    const problem = validateSubmission(submission);
    if (problem) {
      setError(problem);
      return;
    }
    if (children.some((c) => c.check.state === "not_found")) {
      setError("One of the usernames doesn't match a Minecraft Java account. Fix it before sending.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/server/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submission, company })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(res.status === 401 ? "Your sign-in expired. Reload the page and sign in again." : data.error || "Something went wrong. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="alert alert--ok" role="status">
        <strong>Request received.</strong> We&rsquo;ll review it by hand and email {email} when it&rsquo;s done. You can
        check the status any time on <Link href="/server/account/">your account</Link>.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      <h2>About you</h2>
      <p className="hint" style={{ marginBottom: 16 }}>Signed in as {email}. We&rsquo;ll use this address for everything.</p>
      <div className="field">
        <label htmlFor="parentName">Your name</label>
        <input id="parentName" className="input" autoComplete="name" maxLength={80} value={parentName} onChange={(e) => setParentName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="parentPhone">Phone (optional)</label>
        <input id="parentPhone" className="input" type="tel" autoComplete="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
        <span className="hint">Only used if we can&rsquo;t reach you by email.</span>
      </div>

      <h2 style={{ marginTop: 32 }}>Your children</h2>
      {children.map((child, i) => {
        const msg = checkMessage(child.check);
        const statusId = `mc-status-${child.key}`;
        return (
          <fieldset className="child-fieldset" key={child.key}>
            <legend>Child {i + 1}</legend>
            <div className="field">
              <label htmlFor={`nickname-${child.key}`}>Nickname</label>
              <input id={`nickname-${child.key}`} className="input" maxLength={40} value={child.nickname} onChange={(e) => updateChild(child.key, { nickname: e.target.value })} required />
              <span className="hint">A first name or nickname. Never their full legal name.</span>
            </div>
            <div className="field">
              <label htmlFor={`age-${child.key}`}>Age</label>
              <input id={`age-${child.key}`} className="input" type="number" min={4} max={17} inputMode="numeric" value={child.age} onChange={(e) => updateChild(child.key, { age: e.target.value })} required style={{ maxWidth: 120 }} />
            </div>
            <div className="field">
              <label htmlFor={`mc-${child.key}`}>Minecraft Java username</label>
              <input
                id={`mc-${child.key}`}
                className="input"
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
                value={child.mcUsername}
                onChange={(e) => onUsername(child.key, e.target.value)}
                aria-describedby={statusId}
                aria-invalid={child.check.state === "not_found" || child.check.state === "invalid"}
                required
              />
              <span id={statusId} className={`field-status ${msg.tone}`} aria-live="polite">{msg.text}</span>
            </div>
            {children.length > 1 && (
              <button type="button" className="linkish" onClick={() => setChildren((list) => list.filter((c) => c.key !== child.key))}>
                Remove this child
              </button>
            )}
          </fieldset>
        );
      })}
      {children.length < 10 && (
        <button type="button" className="btn btn--ghost" style={{ marginBottom: 32 }} onClick={() => setChildren((list) => [...list, emptyChild(nextKey.current++)])}>
          Add another child
        </button>
      )}

      <h2>Price</h2>
      <div className="price-box">
        <strong>{PRICE_LABEL}</strong>
        <span>per child, per month. Renews monthly until you cancel. You&rsquo;re only charged after we approve a request.</span>
      </div>

      <label className="checkline">
        <input type="checkbox" checked={consentGuardian} onChange={(e) => setConsentGuardian(e.target.checked)} />
        <span>
          I&rsquo;m the parent or legal guardian of each child above, and I agree to EduCraft collecting the details on
          this form as described in the <Link href="/server/privacy/" target="_blank">EduCraft privacy notice</Link>.
        </span>
      </label>
      <label className="checkline">
        <input type="checkbox" checked={consentBilling} onChange={(e) => setConsentBilling(e.target.checked)} />
        <span>
          I understand access is {PRICE_LABEL} per child per month, renews automatically every month, and I can cancel any
          time from my account. Cancelling ends access right away and refunds the unused days.
        </span>
      </label>
      <label className="checkline">
        <input type="checkbox" checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
        <span>
          I agree to the <Link href="/server/terms/" target="_blank">EduCraft terms</Link>, and each child&rsquo;s play
          follows the <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noopener noreferrer">Minecraft EULA</a>.
        </span>
      </label>

      {error && <div className="alert alert--error" role="alert" style={{ marginTop: 16 }}>{error}</div>}

      <button className="btn btn--primary btn--block" type="submit" disabled={submitting} style={{ marginTop: 16 }}>
        {submitting ? "Sending..." : "Send request"}
      </button>
    </form>
  );
}
