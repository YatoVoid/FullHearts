"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HEART_SRC } from "@/lib/asset";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/login/challenge", { method: "POST" })
      .then((res) => res.json())
      .then((data: { token?: string }) => setChallenge(data.token ?? ""))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, challenge, website })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
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
        </div>
      </header>

      <main className="prose">
        <h1>Admin login</h1>
        <form className="form-card" onSubmit={onSubmit} noValidate>
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
          />
          {error && <div className="form-error">{error}</div>}
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <button className="btn-primary form-submit" type="submit" disabled={submitting}>
            {submitting ? "Checking..." : "Log in"}
          </button>
        </form>
      </main>
    </>
  );
}
