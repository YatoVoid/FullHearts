import { redirect } from "next/navigation";
import Link from "next/link";
import { hasAdminSession } from "@/lib/auth";
import { listRegistrations } from "@/lib/registrations";
import { HEART_SRC } from "@/lib/asset";
import AdminRegistrationRow from "@/components/AdminRegistrationRow";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

export default async function AdminDashboard() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  const registrations = listRegistrations();
  const serverAddress = process.env.SERVER_ADDRESS || "not set (SERVER_ADDRESS env var)";
  const paidCount = registrations.filter((r) => r.paid).length;

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
        <div className="admin-bar">
          <h1 style={{ fontFamily: "var(--pixel)", fontSize: 18 }}>EduCraft registrations</h1>
          <div className="admin-server-ip">
            {paidCount} of {registrations.length} paid &middot; Server address to relay manually:{" "}
            <code>{serverAddress}</code>
          </div>
        </div>

        {registrations.length === 0 ? (
          <div className="admin-empty">No registrations yet.</div>
        ) : (
          <div className="server-table-wrap">
            <table className="server-table">
              <thead>
                <tr>
                  <th scope="col">Child</th>
                  <th scope="col">Parent</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                  <th scope="col">Billing</th>
                  <th scope="col">Notes</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <AdminRegistrationRow key={r.id} registration={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
