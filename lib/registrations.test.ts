// @vitest-environment node
// node:sqlite needs the real Node environment, not vitest's default jsdom.
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { createRegistration, listRegistrations, updateStatus, updatePaid, updateNotes, hasRecentSubmission } =
  await import("@/lib/registrations");

function makeInput(overrides: Partial<Parameters<typeof createRegistration>[0]> = {}) {
  return {
    childNickname: "Robin",
    childAge: 10,
    childMcUsername: "RobinCrafts",
    parentName: "Jamie Doe",
    parentPhone: "+1 555 010 1234",
    parentEmail: "jamie@example.com",
    ...overrides
  };
}

describe("registrations", () => {
  it("creates a pending registration", () => {
    const reg = createRegistration(makeInput());
    expect(reg.status).toBe("pending");
    expect(reg.child_nickname).toBe("Robin");
    expect(reg.price_cents).toBe(0);
    expect(reg.paid).toBe(false);
    expect(reg.notes).toBeNull();
  });

  it("updates paid status", () => {
    const reg = createRegistration(makeInput({ childMcUsername: "PaidTest1" }));
    expect(updatePaid(reg.id, true)?.paid).toBe(true);
    expect(updatePaid(reg.id, false)?.paid).toBe(false);
  });

  it("updates notes, trimming to null when blank", () => {
    const reg = createRegistration(makeInput({ childMcUsername: "NotesTest1" }));
    expect(updateNotes(reg.id, "Allergic to peanuts")?.notes).toBe("Allergic to peanuts");
    expect(updateNotes(reg.id, "   ")?.notes).toBeNull();
  });

  it("lists registrations newest first", () => {
    const first = createRegistration(makeInput({ childMcUsername: "First123" }));
    const second = createRegistration(makeInput({ childMcUsername: "Second456" }));
    const all = listRegistrations();
    const firstIdx = all.findIndex((r) => r.id === first.id);
    const secondIdx = all.findIndex((r) => r.id === second.id);
    expect(secondIdx).toBeLessThan(firstIdx);
  });

  it("updates status", () => {
    const reg = createRegistration(makeInput({ childMcUsername: "StatusTest1" }));
    const updated = updateStatus(reg.id, "whitelisted");
    expect(updated?.status).toBe("whitelisted");
  });

  it("flags a duplicate phone with a different Minecraft username", () => {
    createRegistration(makeInput({ parentPhone: "+1 555 999 0000", childMcUsername: "DupTestA" }));
    expect(hasRecentSubmission("+1 555 999 0000", "DupTestB")).toBe(true);
  });

  it("does not flag the same phone re-submitting the same username", () => {
    createRegistration(makeInput({ parentPhone: "+1 555 888 0000", childMcUsername: "SameKid" }));
    expect(hasRecentSubmission("+1 555 888 0000", "SameKid")).toBe(false);
  });

  it("does not flag an unrelated phone number", () => {
    expect(hasRecentSubmission("+1 555 000 0000", "NoOneRegisteredThis")).toBe(false);
  });

  it("returns plain objects, not node:sqlite's null-prototype rows (Next.js can't pass those to Client Components)", () => {
    const created = createRegistration(makeInput({ childMcUsername: "PlainObjTest" }));
    expect(Object.getPrototypeOf(created)).toBe(Object.prototype);
    const [listed] = listRegistrations();
    expect(Object.getPrototypeOf(listed)).toBe(Object.prototype);
  });
});
