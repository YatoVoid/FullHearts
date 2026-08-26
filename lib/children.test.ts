// @vitest-environment node
// node:sqlite needs the real Node environment, not vitest's default jsdom.
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { createChild, listChildren, updateStatus, updatePaid, updateNotes, updatePriceCents, assignRealm, hasRecentSubmission } =
  await import("@/lib/children");
const { findOrCreateParent } = await import("@/lib/parents");
const { createRealm } = await import("@/lib/realms");

function makeChild(overrides: Partial<Parameters<typeof createChild>[1]> = {}, phone = "+1 555 010 1234") {
  const parent = findOrCreateParent("Jamie Doe", phone, "jamie@example.com");
  return createChild(parent.id, { nickname: "Robin", age: 10, mcUsername: "RobinCrafts", ...overrides });
}

describe("children", () => {
  it("creates a pending child under a parent", () => {
    const child = makeChild({ mcUsername: "CreateTest1" });
    expect(child.status).toBe("pending");
    expect(child.paid).toBe(false);
    expect(child.realm_id).toBeNull();
  });

  it("attaches a second child to the same parent by phone, instead of duplicating the parent", () => {
    const a = makeChild({ mcUsername: "SiblingA" }, "+1 555 020 0000");
    const b = makeChild({ mcUsername: "SiblingB" }, "+1 555 020 0000");
    expect(a.parent_id).toBe(b.parent_id);
  });

  it("lists children joined with parent and realm fields", () => {
    makeChild({ mcUsername: "ListTest1" }, "+1 555 030 0000");
    const found = listChildren().find((c) => c.mc_username === "ListTest1");
    expect(found?.parent_name).toBe("Jamie Doe");
    expect(found?.parent_phone).toBe("+1 555 030 0000");
    expect(found?.realm_name).toBeNull();
  });

  it("updates status, paid, price, and notes", () => {
    const child = makeChild({ mcUsername: "UpdateTest1" }, "+1 555 040 0000");
    expect(updateStatus(child.id, "whitelisted")?.status).toBe("whitelisted");
    expect(updatePaid(child.id, true)?.paid).toBe(true);
    expect(updatePriceCents(child.id, 500)?.price_cents).toBe(500);
    expect(updateNotes(child.id, "Allergic to peanuts")?.notes).toBe("Allergic to peanuts");
    expect(updateNotes(child.id, "  ")?.notes).toBeNull();
  });

  it("assigns a realm while it has room", () => {
    const realm = createRealm("Realm A", "play-a.example.com:25565", 1);
    const child = makeChild({ mcUsername: "RealmTest1" }, "+1 555 050 0000");
    const result = assignRealm(child.id, realm.id);
    expect(result.ok).toBe(true);
  });

  it("refuses to assign a realm that's already full", () => {
    const realm = createRealm("Realm B", "play-b.example.com:25565", 1);
    const first = makeChild({ mcUsername: "FullTestA" }, "+1 555 060 0000");
    const second = makeChild({ mcUsername: "FullTestB" }, "+1 555 060 0001");
    expect(assignRealm(first.id, realm.id).ok).toBe(true);
    const result = assignRealm(second.id, realm.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/full/);
  });

  it("allows re-assigning a child already in a full realm to itself", () => {
    const realm = createRealm("Realm C", "play-c.example.com:25565", 1);
    const child = makeChild({ mcUsername: "ReassignTest1" }, "+1 555 070 0000");
    expect(assignRealm(child.id, realm.id).ok).toBe(true);
    expect(assignRealm(child.id, realm.id).ok).toBe(true);
  });

  it("flags a duplicate phone re-submitting the same Minecraft username", () => {
    makeChild({ mcUsername: "DupTest1" }, "+1 555 080 0000");
    expect(hasRecentSubmission("+1 555 080 0000", "DupTest1")).toBe(true);
  });

  it("does not flag a different child under the same phone", () => {
    makeChild({ mcUsername: "DupTest2" }, "+1 555 090 0000");
    expect(hasRecentSubmission("+1 555 090 0000", "SomeoneElsesUsername")).toBe(false);
  });

  it("returns plain objects, not node:sqlite's null-prototype rows", () => {
    const child = makeChild({ mcUsername: "PlainObjTest1" }, "+1 555 100 0000");
    expect(Object.getPrototypeOf(child)).toBe(Object.prototype);
    const [listed] = listChildren();
    expect(Object.getPrototypeOf(listed)).toBe(Object.prototype);
  });
});
