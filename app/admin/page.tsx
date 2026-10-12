import { redirect } from "next/navigation";
import Link from "next/link";
import { hasAdminSession } from "@/lib/auth";
import { listChildren, type ChildWithContext } from "@/lib/children";
import { listRealms, type Realm } from "@/lib/realms";
import { HEART_SRC } from "@/lib/asset";
import AdminChildRow from "@/components/AdminChildRow";
import AdminRealmForm from "@/components/AdminRealmForm";
import AdminEmailRetry from "@/components/AdminEmailRetry";
import { outboxSummary } from "@/lib/outbox";
import { mailConfigured } from "@/lib/mail";
import { billingCounts, billingEnabled, subscriptionForChild } from "@/lib/billing";
import { isEntitled } from "@/lib/entitlement";
import { lastSyncRun } from "@/lib/sync";
import AdminRealmSync from "@/components/AdminRealmSync";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

function syncSummary(realm: Realm) {
  const run = lastSyncRun(realm.id);
  return {
    hasToken: realm.sync_token_hash !== null,
    paused: realm.sync_paused === 1,
    lastSeen: realm.sync_last_seen_at,
    lastMode: realm.sync_last_mode,
    lastRun: run && {
      at: run.at,
      dryRun: run.dry_run === 1,
      added: run.report.added.length,
      removed: run.report.removed.length,
      present: run.report.present.length,
      preexisting: run.report.preexisting.length,
      removedByOthers: run.report.removed_by_others.length,
      errors: run.report.errors.map((e) => e.message)
    }
  };
}

function groupByParent(children: ChildWithContext[]): Map<number, ChildWithContext[]> {
  const groups = new Map<number, ChildWithContext[]>();
  for (const child of children) {
    const group = groups.get(child.parent_id);
    if (group) group.push(child);
    else groups.set(child.parent_id, [child]);
  }
  return groups;
}

export default async function AdminDashboard() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  const children = listChildren();
  const realms = listRealms();
  const byParent = groupByParent(children);
  const emails = outboxSummary();
  const billing = billingCounts();
  const subs = new Map(children.map((c) => [c.id, subscriptionForChild(c.id)]));

  const managed = children.filter((c) => c.access_source === "fullhearts");
  const counts = {
    pending: managed.filter((c) => c.review_status === "pending").length,
    approved: managed.filter((c) => c.review_status === "approved").length,
    rejected: managed.filter((c) => c.review_status === "rejected").length,
    manual: children.length - managed.length
  };

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

      <main className="wrap" style={{ padding: "40px 24px 80px" }}>
        <h1 style={{ fontFamily: "var(--pixel)", fontSize: 18, marginBottom: 20 }}>EduCraft business analytics</h1>

        <div className="analytics-grid">
          <div className="analytics-tile">
            <div className="analytics-num">${(billing.monthlyCents / 100).toFixed(2)}</div>
            <div className="analytics-lab">
              a month from {billing.paying} paying {billing.paying === 1 ? "child" : "children"}
              {billing.pastDue > 0 ? `, ${billing.pastDue} with a failed payment` : ""}
              {billingEnabled() ? "" : " (billing is off)"}
            </div>
          </div>
          <div className="analytics-tile">
            <div className="analytics-num">{counts.pending}</div>
            <div className="analytics-lab">waiting for review</div>
          </div>
          <div className="analytics-tile">
            <div className="analytics-num">{counts.approved}</div>
            <div className="analytics-lab">approved</div>
          </div>
          <div className="analytics-tile">
            <div className="analytics-num">{counts.rejected}</div>
            <div className="analytics-lab">rejected</div>
          </div>
          <div className="analytics-tile">
            <div className="analytics-num">{counts.manual}</div>
            <div className="analytics-lab">added on the server by hand</div>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 32 }}>
          Players added on the server by hand show as &ldquo;manual&rdquo;. The website never bills them or removes them
          from the whitelist.
        </p>

        <div className="admin-bar">
          <h2 style={{ fontFamily: "var(--pixel)", fontSize: 14 }}>Realms</h2>
        </div>
        <div className="realms-grid">
          {realms.map((r) => (
            <div className="realm-card" key={r.id}>
              <div className="realm-card-name">{r.name}</div>
              <div className="hint">{r.address}</div>
              <div className={`realm-card-fill ${r.assignedCount >= r.capacity ? "full" : ""}`}>
                {r.assignedCount}/{r.capacity}
              </div>
              <AdminRealmSync realmId={r.id} summary={syncSummary(r)} />
            </div>
          ))}
          <AdminRealmForm />
        </div>

        <div className="admin-bar" style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: "var(--pixel)", fontSize: 14 }}>Email</h2>
        </div>
        <p className="hint">
          {mailConfigured() ? "Sending through Resend." : "Not sending: RESEND_API_KEY or MAIL_FROM isn't set, so emails wait in the queue."}{" "}
          {emails.queued} waiting to send.
        </p>
        {emails.failed.length > 0 && (
          <div className="server-table-wrap" style={{ marginTop: 12 }}>
            <table className="server-table">
              <thead>
                <tr>
                  <th scope="col">Failed email</th>
                  <th scope="col">To</th>
                  <th scope="col">Last error</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {emails.failed.map((e) => (
                  <tr key={e.id}>
                    <td>{e.subject}</td>
                    <td className="hint">{e.to_addr}</td>
                    <td className="hint">{e.last_error}</td>
                    <td>
                      <AdminEmailRetry id={e.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-bar" style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: "var(--pixel)", fontSize: 14 }}>Families</h2>
        </div>

        {byParent.size === 0 ? (
          <div className="admin-empty">No registrations yet.</div>
        ) : (
          Array.from(byParent.entries()).map(([parentId, kids]) => (
            <div className="parent-card" key={parentId}>
              <div className="parent-card-head">
                <strong>{kids[0].parent_name}</strong>
                {kids[0].parent_phone && <span className="hint">{kids[0].parent_phone}</span>}
                {kids[0].parent_email && <span className="hint">{kids[0].parent_email}</span>}
              </div>
              <div className="server-table-wrap">
                <table className="server-table">
                  <thead>
                    <tr>
                      <th scope="col">Child</th>
                      <th scope="col">Review</th>
                      <th scope="col">Realm</th>
                      <th scope="col">Billing</th>
                      <th scope="col">Notes</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kids.map((child) => (
                      <AdminChildRow
                        key={child.id}
                        child={child}
                        realms={realms}
                        sub={subs.get(child.id) ?? null}
                        entitled={isEntitled(child, subs.get(child.id) ?? null)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </main>
    </>
  );
}
