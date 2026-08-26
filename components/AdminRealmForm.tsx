"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export default function AdminRealmForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/realms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": readCookie("admin_csrf")
        },
        body: JSON.stringify({ name, address, capacity: Number(capacity) })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setName("");
      setAddress("");
      setCapacity("20");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="realm-form" onSubmit={onSubmit}>
      {error && <div className="form-error">{error}</div>}
      <input
        className="form-input"
        placeholder="Realm name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        required
      />
      <input
        className="form-input"
        placeholder="Address (host:port)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={200}
        required
      />
      <input
        className="form-input"
        type="number"
        min={1}
        max={1000}
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        required
      />
      <button className="btn-ghost" type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add realm"}
      </button>
    </form>
  );
}
