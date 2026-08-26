// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { createRealm, listRealms, getRealm } = await import("@/lib/realms");
const { findOrCreateParent } = await import("@/lib/parents");
const { createChild, assignRealm } = await import("@/lib/children");

describe("realms", () => {
  it("creates a realm with zero assigned", () => {
    const realm = createRealm("Realm X", "play-x.example.com:25565", 20);
    expect(realm.assignedCount).toBe(0);
    expect(realm.capacity).toBe(20);
  });

  it("counts assigned children", () => {
    const realm = createRealm("Realm Y", "play-y.example.com:25565", 20);
    const parent = findOrCreateParent("Jamie Doe", "+1 555 300 0000", null);
    const child = createChild(parent.id, { nickname: "Robin", age: 10, mcUsername: "RealmCountTest1" });
    assignRealm(child.id, realm.id);
    expect(getRealm(realm.id)?.assignedCount).toBe(1);
  });

  it("lists realms oldest first", () => {
    const first = createRealm("Order A", "a.example.com:1", 5);
    const second = createRealm("Order B", "b.example.com:1", 5);
    const all = listRealms();
    const firstIdx = all.findIndex((r) => r.id === first.id);
    const secondIdx = all.findIndex((r) => r.id === second.id);
    expect(firstIdx).toBeLessThan(secondIdx);
  });
});
