// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { findOrCreateParent, getParentByPhone, listParents } = await import("@/lib/parents");

describe("parents", () => {
  it("creates a parent", () => {
    const parent = findOrCreateParent("Jamie Doe", "+1 555 200 0000", "jamie@example.com");
    expect(parent.name).toBe("Jamie Doe");
    expect(parent.phone).toBe("+1 555 200 0000");
  });

  it("reuses the existing parent for the same phone instead of creating a duplicate", () => {
    const first = findOrCreateParent("Jamie Doe", "+1 555 210 0000", "jamie@example.com");
    const second = findOrCreateParent("Jamie Doe", "+1 555 210 0000", "jamie@example.com");
    expect(second.id).toBe(first.id);
  });

  it("finds a parent by phone", () => {
    findOrCreateParent("Sam Lee", "+1 555 220 0000", null);
    expect(getParentByPhone("+1 555 220 0000")?.name).toBe("Sam Lee");
    expect(getParentByPhone("+1 555 999 9999")).toBeUndefined();
  });

  it("lists parents", () => {
    findOrCreateParent("Alex Kim", "+1 555 230 0000", null);
    expect(listParents().some((p) => p.phone === "+1 555 230 0000")).toBe(true);
  });
});
