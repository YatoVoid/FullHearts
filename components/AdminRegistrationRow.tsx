"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Registration, RegistrationStatus } from "@/lib/registrations";

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

const STATUS_ACTIONS: { label: string; status: RegistrationStatus }[] = [
  { label: "Whitelist", status: "whitelisted" },
  { label: "Reject", status: "rejected" },
  { label: "Set pending", status: "pending" }
];

export default function AdminRegistrationRow({ registration }: { registration: Registration }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState(registration.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);

  async function patch(body: { status?: RegistrationStatus; paid?: boolean; notes?: string }) {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": readCookie("admin_csrf")
        },
        body: JSON.stringify(body)
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <tr>
      <td>
        {registration.child_nickname} <span className="hint">({registration.child_age})</span>
        <br />
        <span className="hint">{registration.child_mc_username}</span>
      </td>
      <td>
        {registration.parent_name}
        <br />
        <span className="hint">{registration.parent_phone}</span>
        {registration.parent_email && (
          <>
            <br />
            <span className="hint">{registration.parent_email}</span>
          </>
        )}
      </td>
      <td>
        <span className="hint">{new Date(registration.created_at).toLocaleString()}</span>
      </td>
      <td>
        <span className={`status-badge ${registration.status}`}>{registration.status}</span>
      </td>
      <td>
        <label className="paid-toggle">
          <input
            type="checkbox"
            checked={registration.paid}
            disabled={pending}
            onChange={(e) => patch({ paid: e.target.checked })}
          />
          {registration.paid ? "Paid" : "Unpaid"}
        </label>
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
          {STATUS_ACTIONS.filter((a) => a.status !== registration.status).map((a) => (
            <button key={a.status} onClick={() => patch({ status: a.status })} disabled={pending}>
              {a.label}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}
