import { redirect } from "next/navigation";
import Link from "next/link";
import { hasAdminSession } from "@/lib/auth";
import { listChildren, type ChildWithContext } from "@/lib/children";
import { listRealms } from "@/lib/realms";
import { HEART_SRC } from "@/lib/asset";
import AdminChildRow from "@/components/AdminChildRow";
import AdminRealmForm from "@/components/AdminRealmForm";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

  const paidChildren = children.filter((c) => c.paid);
  const monthlyRevenueCents = paidChildren.reduce((sum, c) => sum + c.price_cents, 0);
  const statusCounts = {
    pending: children.filter((c) => c.status === "pending").length,
    whitelisted: children.filter((c) => c.status === "whitelisted").length,
    rejected: children.filter((c) => c.status === "rejected").length
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
            <div className="analytics-num">{formatDollars(monthlyRevenueCents)}</div>
            <div className="analytics-lab">
              current paid total / month ({paidChildren.length} of {children.length} paid)
            </div>
          </div>
          <div className="analytics-tile">
            <div className="analytics-num">{statusCounts.whitelisted}</div>
            <div className="analytics-lab">whitelisted</div>
          </div>
          <div className="analytics-tile">
            <div className="analytics-num">{statusCounts.pending}</div>
            <div className="analytics-lab">pending review</div>
          </div>
          <div className="analytics-tile">
            <div className="analytics-num">{statusCounts.rejected}</div>
            <div className="analytics-lab">rejected</div>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 32 }}>
          This is a running total of what's marked paid right now, not invoiced payment history. There's no
          payment processor wired in yet, "paid" is a manual toggle per child.
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
            </div>
          ))}
          <AdminRealmForm />
        </div>

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
                <span className="hint">{kids[0].parent_phone}</span>
                {kids[0].parent_email && <span className="hint">{kids[0].parent_email}</span>}
              </div>
              <div className="server-table-wrap">
                <table className="server-table">
                  <thead>
                    <tr>
                      <th scope="col">Child</th>
                      <th scope="col">Status</th>
                      <th scope="col">Realm</th>
                      <th scope="col">Billing</th>
                      <th scope="col">Notes</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kids.map((child) => (
                      <AdminChildRow key={child.id} child={child} realms={realms} />
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
