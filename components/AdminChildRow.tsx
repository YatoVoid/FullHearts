"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChildWithContext } from "@/lib/children";
import type { Realm } from "@/lib/realms";
import { readCookie } from "@/lib/cookies";
import type { SubscriptionRow } from "@/lib/entitlement";

type Patch = {
  action?: "approve" | "reject" | "reopen" | "delete" | "verify" | "suspend" | "restore" | "cancel_subscription" | "resend_approval"; notes?: string; realmId?: number; confirm?: string };

export default function AdminChildRow({
  child,
  realms,
  sub,
  entitled
}: {
  child: ChildWithContext;
  realms: Realm[];
  sub: SubscriptionRow | null;
  entitled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState(child.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [confirming, setConfirming] = useState<null | "delete" | "cancel_subscription">(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const external = child.access_source === "external";

  async function patch(body: Patch) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/children/${child.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": readCookie("admin_csrf") },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as { error?: string; warning?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (data.warning) setError(data.warning);
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
        <br />
        <span className="hint">{child.mc_uuid ? "Mojang verified" : "Username not verified"}</span>
      </td>
      <td>
        {external ? (
          <span className="status-badge external" title="Added to the server by hand. The website never bills or removes them.">
            manual
          </span>
        ) : (
          <span className={`status-badge ${child.review_status}`}>{child.review_status}</span>
        )}
      </td>
      <td>
        {external ? (
          <span className="hint">{child.realm_name ?? "None"}</span>
        ) : (
          <select
            className="realm-select"
            aria-label={`Realm for ${child.nickname}`}
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
        )}
        {child.realm_name && <div className="hint">{child.realm_address}</div>}
      </td>
      <td>
        {external ? (
          <span className="hint">Not billed</span>
        ) : sub ? (
          <>
            <span className={`status-badge ${sub.status === "active" ? "active" : sub.status === "canceled" ? "ended" : "pending"}`}>{sub.status}</span>
            {child.grace_until && <div className="hint">grace until {new Date(child.grace_until).toLocaleString()}</div>}
            {sub.refunded_cents ? <div className="hint">refunded ${(sub.refunded_cents / 100).toFixed(2)}</div> : null}
          </>
        ) : (
          <span className="hint">No subscription</span>
        )}
        <div className="hint">{entitled ? "Should be on the server" : "Should be off the server"}</div>
        {child.suspended_at && <div className="hint" style={{ color: "#ff9fb1" }}>Suspended</div>}
      </td>
      <td>
        <textarea
          className="admin-notes"
          aria-label={`Notes for ${child.nickname}`}
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
        {!external && (
          <div className="admin-actions">
            {!child.mc_uuid && (
              <button onClick={() => patch({ action: "verify" })} disabled={pending}>
                Check username
              </button>
            )}
            {child.review_status !== "approved" && (
              <button
                onClick={() => patch({ action: "approve" })}
                disabled={pending || !child.realm_id || !child.mc_uuid}
                title={!child.realm_id ? "Pick a realm first" : !child.mc_uuid ? "Check the username first" : undefined}
              >
                Approve
              </button>
            )}
            {child.review_status !== "rejected" && (
              <button onClick={() => patch({ action: "reject" })} disabled={pending}>
                Reject
              </button>
            )}
            {child.review_status !== "pending" && (
              <button onClick={() => patch({ action: "reopen" })} disabled={pending}>
                Back to pending
              </button>
            )}
          </div>
        )}
        {!external && child.review_status === "approved" && (
          <div className="admin-actions" style={{ marginTop: 8 }}>
            {child.suspended_at ? (
              <button onClick={() => patch({ action: "restore" })} disabled={pending}>
                Restore
              </button>
            ) : (
              <button onClick={() => patch({ action: "suspend" })} disabled={pending} title="Takes them off the server. Billing keeps running.">
                Suspend
              </button>
            )}
            {!sub && (
              <button onClick={() => patch({ action: "resend_approval" })} disabled={pending} title="Sends the join steps and pay link again">
                Resend approval email
              </button>
            )}
            {sub && ["active", "trialing", "past_due", "unpaid"].includes(sub.status) && (
              <button onClick={() => setConfirming("cancel_subscription")} disabled={pending}>
                Cancel + refund
              </button>
            )}
          </div>
        )}
        {confirming ? (
          <div className="admin-delete">
            <input
              aria-label="Type the Minecraft username to confirm"
              placeholder={child.mc_username}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <button
              disabled={pending || confirmText.trim().toLowerCase() !== child.mc_username.toLowerCase()}
              onClick={() => {
                patch({ action: confirming, confirm: confirmText });
                setConfirming(null);
                setConfirmText("");
              }}
            >
              {confirming === "delete" ? "Delete for good" : "Cancel and refund"}
            </button>
            <button onClick={() => setConfirming(null)}>Never mind</button>
          </div>
        ) : (
          <div className="admin-actions" style={{ marginTop: 8 }}>
            <button onClick={() => setConfirming("delete")} disabled={pending}>
              Delete
            </button>
          </div>
        )}
        {error && (
          <div className="hint" style={{ marginTop: 6, color: "#ff9fb1" }}>
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}
