import { describe, it, expect } from "vitest";
import { kidStatus } from "@/lib/kid-status";
import type { ChildWithContext } from "@/lib/children";
import type { SubscriptionRow } from "@/lib/entitlement";

const kid = (over: Partial<ChildWithContext> = {}): ChildWithContext =>
  ({
    id: 1, parent_id: 1, realm_id: 1, created_at: "", review_status: "approved", reviewed_at: "", access_source: "fullhearts",
    nickname: "Robin", age: 9, mc_username: "Robin", mc_uuid: "x", mc_verified_at: "", suspended_at: null, grace_until: null,
    server_state: null, server_state_at: null, approval_sent_at: null, approval_expires_at: null, notes: null,
    parent_name: "", parent_phone: null, parent_email: null, realm_name: "Realm", realm_address: "203.0.113.1", ...over
  }) as ChildWithContext;

const sub = (status: string): SubscriptionRow => ({
  id: "sub", parent_id: 1, child_id: 1, customer_id: "cus", status, current_period_end: "2026-11-12T00:00:00Z",
  ended_at: null, canceled_by: null, refunded_cents: null, created_at: "", updated_at: ""
});

describe("kidStatus", () => {
  it("asks an approved family to subscribe once billing is on", () => {
    expect(kidStatus(kid(), null, true).action).toBe("subscribe");
    expect(kidStatus(kid(), null, false).action).toBe("none");
  });

  it("shows 'being added' until the server confirms, then active", () => {
    expect(kidStatus(kid(), sub("active"), true).label).toBe("Being added");
    expect(kidStatus(kid({ server_state: "present" }), sub("active"), true).label).toBe("Active");
  });

  it("warns during the 24 hour grace and shows paused after it", () => {
    const now = new Date("2026-10-12T12:00:00Z");
    const graceKid = kid({ grace_until: "2026-10-13T00:00:00Z" });
    expect(kidStatus(graceKid, sub("past_due"), true, now).label).toBe("Payment failed");
    expect(kidStatus(graceKid, sub("past_due"), true, new Date("2026-10-13T01:00:00Z")).label).toBe("Paused");
  });

  it("never offers billing for players added by hand", () => {
    const s = kidStatus(kid({ access_source: "external" }), null, true);
    expect(s.label).toBe("Active");
    expect(s.action).toBe("none");
  });
});
