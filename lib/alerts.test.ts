// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
  process.env.ADMIN_ALERT_EMAILS = "one@example.com, two@example.com";
});

const { alertNewRequest } = await import("@/lib/alerts");
const { getDb } = await import("@/lib/db");

describe("new request alert", () => {
  it("emails every admin once, with no child details", () => {
    alertNewRequest(41, 2);
    alertNewRequest(41, 2);
    const rows = getDb().prepare("SELECT to_addr, subject, body FROM email_outbox").all() as {
      to_addr: string;
      subject: string;
      body: string;
    }[];
    expect(rows.map((r) => r.to_addr).sort()).toEqual(["one@example.com", "two@example.com"]);
    for (const r of rows) {
      expect(r.subject).toContain("2 children");
      expect(r.body).not.toMatch(/username|nickname|age/i);
    }
  });
});
