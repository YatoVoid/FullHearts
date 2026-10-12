// @vitest-environment node
// node:sqlite needs the real Node environment, not vitest's default jsdom.
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { createChild, listChildren, setReviewStatus, updateNotes, assignRealm, usernameTaken, deleteChild, getChild } =
  await import("@/lib/children");
const { findOrCreateParent, getParent } = await import("@/lib/parents");
const { createRealm, getRealm } = await import("@/lib/realms");
const { getDb } = await import("@/lib/db");

function makeChild(overrides: Partial<Parameters<typeof createChild>[1]> = {}, phone = "+1 555 010 1234") {
  const parent = findOrCreateParent("Jamie Doe", phone, null);
  return createChild(parent.id, { nickname: "Robin", age: 10, mcUsername: "RobinCrafts", ...overrides });
}

describe("children", () => {
  it("creates a pending, website-managed child under a parent", () => {
    const child = makeChild({ mcUsername: "CreateTest1" });
    expect(child.review_status).toBe("pending");
    expect(child.access_source).toBe("fullhearts");
    expect(child.realm_id).toBeNull();
  });

  it("marks the username verified when a Mojang UUID comes with it", () => {
    const child = makeChild({ mcUsername: "UuidTest1", mcUuid: "0123456789abcdef0123456789abcdef" }, "+1 555 011 0000");
    expect(child.mc_uuid).toBe("0123456789abcdef0123456789abcdef");
    expect(child.mc_verified_at).not.toBeNull();
  });

  it("lists children joined with parent and realm fields", () => {
    makeChild({ mcUsername: "ListTest1" }, "+1 555 030 0000");
    const found = listChildren().find((c) => c.mc_username === "ListTest1");
    expect(found?.parent_name).toBe("Jamie Doe");
    expect(found?.realm_name).toBeNull();
  });

  it("records review decisions and notes", () => {
    const child = makeChild({ mcUsername: "ReviewTest1" }, "+1 555 040 0000");
    const approved = setReviewStatus(child.id, "approved");
    expect(approved?.review_status).toBe("approved");
    expect(approved?.reviewed_at).not.toBeNull();
    expect(setReviewStatus(child.id, "pending")?.reviewed_at).toBeNull();
    expect(updateNotes(child.id, "Allergic to peanuts")?.notes).toBe("Allergic to peanuts");
    expect(updateNotes(child.id, "  ")?.notes).toBeNull();
  });

  it("refuses to assign a realm that's already full", () => {
    const realm = createRealm("Realm B", "play-b.example.com:25565", 1);
    const first = makeChild({ mcUsername: "FullTestA" }, "+1 555 060 0000");
    const second = makeChild({ mcUsername: "FullTestB" }, "+1 555 060 0001");
    expect(assignRealm(first.id, realm.id).ok).toBe(true);
    const result = assignRealm(second.id, realm.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/full/);
    expect(assignRealm(first.id, realm.id).ok).toBe(true);
  });

  it("doesn't count rejected or hand-added players against realm capacity", () => {
    const realm = createRealm("Realm C", "play-c.example.com:25565", 5);
    const rejected = makeChild({ mcUsername: "CapRejected" }, "+1 555 070 0000");
    const manual = makeChild({ mcUsername: "CapManual" }, "+1 555 070 0001");
    const kept = makeChild({ mcUsername: "CapKept" }, "+1 555 070 0002");
    for (const c of [rejected, manual, kept]) assignRealm(c.id, realm.id);
    setReviewStatus(rejected.id, "rejected");
    getDb().prepare("UPDATE children SET access_source = 'external' WHERE id = ?").run(manual.id);
    expect(getRealm(realm.id)?.assignedCount).toBe(1);
  });

  it("treats a username as taken case-insensitively until it's rejected", () => {
    const child = makeChild({ mcUsername: "TakenTest" }, "+1 555 080 0000");
    expect(usernameTaken("takentest")).toBe(true);
    setReviewStatus(child.id, "rejected");
    expect(usernameTaken("takentest")).toBe(false);
  });

  it("deletes the parent along with their last child", () => {
    const a = makeChild({ mcUsername: "DelSibA" }, "+1 555 090 0000");
    const b = makeChild({ mcUsername: "DelSibB" }, "+1 555 090 0000");
    expect(deleteChild(a.id).deletedParent).toBe(false);
    expect(getParent(b.parent_id)).toBeDefined();
    expect(deleteChild(b.id).deletedParent).toBe(true);
    expect(getChild(b.id)).toBeUndefined();
    expect(getParent(b.parent_id)).toBeUndefined();
  });

  it("returns plain objects, not node:sqlite's null-prototype rows", () => {
    const child = makeChild({ mcUsername: "PlainObjTest1" }, "+1 555 100 0000");
    expect(Object.getPrototypeOf(child)).toBe(Object.prototype);
    const [listed] = listChildren();
    expect(Object.getPrototypeOf(listed)).toBe(Object.prototype);
  });
});
