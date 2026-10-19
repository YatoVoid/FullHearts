// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
  process.env.ADMIN_ALERT_EMAILS = "admin@example.com";
});

const { registerChildren } = await import("@/lib/registration");
const { findOrCreateParentByEmail, getParent } = await import("@/lib/parents");
const { listChildrenForParent } = await import("@/lib/children");
const { consentsForParent } = await import("@/lib/consents");
const { TERMS_VERSION } = await import("@/lib/educraft");
const { getDb } = await import("@/lib/db");

const ctx = { ip: "203.0.113.9", userAgent: "test-agent" };
let n = 0;
const parent = () => findOrCreateParentByEmail(`reg${++n}@example.com`);

function submission(username = "RealKid", overrides: Record<string, unknown> = {}) {
  return {
    parent: { parentName: "Kat", parentPhone: "", consentGuardian: true, consentBilling: true, consentTerms: true, ...overrides },
    children: [{ childNickname: "Luigi", childAge: 8, childMcUsername: username }]
  };
}

const found = (name: string) => vi.fn().mockResolvedValue({ status: "found", name, uuid: "a".repeat(32) });

describe("registerChildren", () => {
  it("saves the Mojang spelling and UUID, the parent's name, and every consent", async () => {
    const p = parent();
    const result = await registerChildren(p, submission("realkid"), ctx, found("RealKid"));
    expect(result.ok).toBe(true);

    const [kid] = listChildrenForParent(p.id);
    expect(kid.mc_username).toBe("RealKid");
    expect(kid.mc_uuid).toBe("a".repeat(32));
    expect(getParent(p.id)?.name).toBe("Kat");
    expect(getParent(p.id)?.phone).toBeNull();

    const consents = consentsForParent(p.id);
    expect(consents.map((c) => c.kind).sort()).toEqual(["billing", "guardian", "terms"]);
    for (const c of consents) {
      expect(c.terms_version).toBe(TERMS_VERSION);
      expect(c.ip).toBe(ctx.ip);
      expect(JSON.parse(c.child_ids!)).toEqual([kid.id]);
    }
  });

  it("refuses a username Mojang doesn't know, and saves nothing", async () => {
    const p = parent();
    const result = await registerChildren(p, submission("thatluigikiddo"), ctx, vi.fn().mockResolvedValue({ status: "not_found" }));
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(listChildrenForParent(p.id)).toHaveLength(0);
    expect(consentsForParent(p.id)).toHaveLength(0);
  });

  it("saves as unverified when Mojang can't answer", async () => {
    const p = parent();
    const result = await registerChildren(p, submission("MojangDown"), ctx, vi.fn().mockResolvedValue({ status: "unavailable" }));
    expect(result.ok && result.unverified).toEqual(["MojangDown"]);
    expect(listChildrenForParent(p.id)[0].mc_uuid).toBeNull();
  });

  it("requires every agreement box", async () => {
    const result = await registerChildren(parent(), submission("Boxes", { consentBilling: false }), ctx, found("Boxes"));
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses an account that already has a request, even under another spelling", async () => {
    await registerChildren(parent(), submission("Dupe"), ctx, vi.fn().mockResolvedValue({ status: "found", name: "Dupe", uuid: "b".repeat(32) }));
    const again = await registerChildren(parent(), submission("dupe"), ctx, vi.fn().mockResolvedValue({ status: "found", name: "Dupe", uuid: "b".repeat(32) }));
    expect(again).toMatchObject({ ok: false, status: 409 });
  });

  it("alerts the admins without any child details", async () => {
    await registerChildren(parent(), submission("AlertKid"), ctx, found("AlertKid"));
    const bodies = getDb().prepare("SELECT body FROM email_outbox WHERE to_addr = 'admin@example.com'").all() as { body: string }[];
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((b) => b.body.includes("AlertKid") || b.body.includes("Luigi"))).toBe(false);
  });
});

describe("registerChildren while registration is paused", () => {
  it("refuses with 503 and saves nothing", async () => {
    process.env.REGISTRATION_PAUSED = "1";
    try {
      const p = parent();
      const result = await registerChildren(p, submission("PausedKid"), ctx, found("PausedKid"));
      expect(result).toMatchObject({ ok: false, status: 503 });
      expect(listChildrenForParent(p.id)).toHaveLength(0);
    } finally {
      delete process.env.REGISTRATION_PAUSED;
    }
  });
});
