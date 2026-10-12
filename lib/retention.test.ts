// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { applyRetention } = await import("@/lib/retention");
const { createChild, setReviewStatus, getChild } = await import("@/lib/children");
const { findOrCreateParentByEmail } = await import("@/lib/parents");

describe("retention", () => {
  it("deletes rejected requests after 30 days and keeps newer ones", () => {
    const parent = findOrCreateParentByEmail("ret@example.com");
    const old = createChild(parent.id, { nickname: "Old", age: 9, mcUsername: "OldReject" });
    const recent = createChild(parent.id, { nickname: "New", age: 9, mcUsername: "NewReject" });
    setReviewStatus(old.id, "rejected");
    setReviewStatus(recent.id, "rejected");

    const in20Days = new Date(Date.now() + 20 * 24 * 60 * 60_000);
    expect(applyRetention(in20Days).rejected).toBe(0);

    const in31Days = new Date(Date.now() + 31 * 24 * 60 * 60_000);
    expect(applyRetention(in31Days).rejected).toBe(2);
    expect(getChild(old.id)).toBeUndefined();
  });

  it("leaves pending and approved requests alone", () => {
    const parent = findOrCreateParentByEmail("ret2@example.com");
    const kid = createChild(parent.id, { nickname: "Wait", age: 9, mcUsername: "StillWaiting" });
    applyRetention(new Date(Date.now() + 365 * 24 * 60 * 60_000));
    expect(getChild(kid.id)).toBeDefined();
  });
});
