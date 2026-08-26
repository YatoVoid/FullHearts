"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChildWithContext, ChildStatus } from "@/lib/children";
import type { Realm } from "@/lib/realms";
import type { NoticeResult } from "@/lib/notify";

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function noticeLabel(result: NoticeResult): string {
  return result.sent ? "sent" : `not sent (${result.reason})`;
}

export default function AdminChildRow({ child, realms }: { child: ChildWithContext; realms: Realm[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState(child.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ sms: NoticeResult; email: NoticeResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: { status?: ChildStatus; paid?: boolean; priceCents?: number; notes?: string; realmId?: number }) {
    setPending(true);
    setNotifyResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/children/${child.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": readCookie("admin_csrf")
        },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as { error?: string; notify?: { sms: NoticeResult; email: NoticeResult } };
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (data.notify) setNotifyResult(data.notify);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <tr>
      <td>
        {child.nickname} <span className="hint">({child.age})</span>
        <br />
        <span className="hint">{child.mc_username}</span>
      </td>
      <td>
        <span className={`status-badge ${child.status}`}>{child.status}</span>
      </td>
      <td>
        <select
          className="realm-select"
          value={child.realm_id ?? ""}
          disabled={pending}
          onChange={(e) => e.target.value && patch({ realmId: Number(e.target.value) })}
        >
          <option value="" disabled>
            Choose a realm
          </option>
          {realms.map((r) => (
            <option key={r.id} value={r.id} disabled={r.id !== child.realm_id && r.assignedCount >= r.capacity}>
              {r.name} ({r.assignedCount}/{r.capacity})
            </option>
          ))}
        </select>
        {child.realm_name && <div className="hint">{child.realm_address}</div>}
      </td>
      <td>
        <label className="paid-toggle">
          <input
            type="checkbox"
            checked={child.paid}
            disabled={pending}
            onChange={(e) => patch({ paid: e.target.checked })}
          />
          {child.paid ? "Paid" : "Unpaid"}
        </label>
        <input
          type="number"
          className="price-input"
          min={0}
          defaultValue={child.price_cents / 100}
          disabled={pending}
          onBlur={(e) => patch({ priceCents: Math.round(Number(e.target.value) * 100) })}
        />
      </td>
      <td>
        <textarea
          className="admin-notes"
          value={notes}
          disabled={pending}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesDirty(true);
          }}
          placeholder="Anything else this family told you"
        />
        {notesDirty && (
          <button
            disabled={pending}
            onClick={() => {
              patch({ notes });
              setNotesDirty(false);
            }}
          >
            Save note
          </button>
        )}
      </td>
      <td>
        <div className="admin-actions">
          {child.status !== "whitelisted" && (
            <button onClick={() => patch({ status: "whitelisted" })} disabled={pending}>
              Whitelist &amp; notify
            </button>
          )}
          {child.status !== "rejected" && (
            <button onClick={() => patch({ status: "rejected" })} disabled={pending}>
              Reject
            </button>
          )}
          {child.status !== "pending" && (
            <button onClick={() => patch({ status: "pending" })} disabled={pending}>
              Set pending
            </button>
          )}
        </div>
        {error && (
          <div className="hint" style={{ marginTop: 6, color: "#ff9fb1" }}>
            {error}
          </div>
        )}
        {notifyResult && (
          <div className="hint" style={{ marginTop: 6 }}>
            SMS: {noticeLabel(notifyResult.sms)}
            <br />
            Email: {noticeLabel(notifyResult.email)}
          </div>
        )}
      </td>
    </tr>
  );
}
