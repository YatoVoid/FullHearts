// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
  process.env.BILLING_ENABLED = "1";
  process.env.EDUCRAFT_CONTACT_EMAIL = "help@example.com";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fullhearts.app";
});

const { queueApprovalEmail, sendPaymentReminders } = await import("@/lib/approval");
const { createChild, setReviewStatus, assignRealm } = await import("@/lib/children");
const { findOrCreateParentByEmail } = await import("@/lib/parents");
const { createRealm } = await import("@/lib/realms");
const { readPayToken } = await import("@/lib/pay-link");
const { getDb } = await import("@/lib/db");

let n = 0;
function approved() {
  n++;
  const parent = findOrCreateParentByEmail(`appr${n}@example.com`);
  const realm = createRealm("EducraftFirstRealm", "203.0.113.25", 12);
  const child = createChild(parent.id, { nickname: "Robin", age: 9, mcUsername: `ApprKid${n}`, mcUuid: "c".repeat(32) });
  assignRealm(child.id, realm.id);
  setReviewStatus(child.id, "approved");
  return { parent, child };
}

const body = (key: string) =>
  (getDb().prepare("SELECT to_addr, subject, body FROM email_outbox WHERE idempotency_key = ?").get(key) as {
    to_addr: string;
    subject: string;
    body: string;
  });

describe("approval email", () => {
  it("has the realm, join steps, a pay link for this child, and contact info", () => {
    const { parent, child } = approved();
    expect(queueApprovalEmail(child.id, "k1")).toBe(true);
    const mail = body("k1");
    expect(mail.to_addr).toBe(parent.email);
    expect(mail.subject).toContain("approved");
    expect(mail.body).toContain("EducraftFirstRealm");
    expect(mail.body).toContain("Add Server, and enter: 203.0.113.25");
    expect(mail.body).toContain("help@example.com");

    const token = mail.body.match(/\/server\/pay\/#(\S+)/)![1];
    expect(readPayToken(token)).toEqual({ childId: child.id, parentId: parent.id });
  });

  it("says payments open soon, with no link, while billing is off", () => {
    process.env.BILLING_ENABLED = "0";
    const { child } = approved();
    queueApprovalEmail(child.id, "k-off");
    expect(body("k-off").body).toContain("Payments open soon");
    expect(body("k-off").body).not.toContain("/server/pay/");
    process.env.BILLING_ENABLED = "1";
  });

  it("reminds on day 3 once, and not before", () => {
    const { child } = approved();
    const sentAt = new Date();
    queueApprovalEmail(child.id, "k-remind", sentAt);
    expect(sendPaymentReminders(new Date(sentAt.getTime() + 2 * 86400_000))).toBe(0);
    const day3 = new Date(sentAt.getTime() + 3 * 86400_000 + 60_000);
    sendPaymentReminders(day3);
    sendPaymentReminders(day3);
    const count = getDb()
      .prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE idempotency_key LIKE ?")
      .get(`pay-reminder:${child.id}:%:3`) as { n: number };
    expect(count.n).toBe(1);
  });
});
