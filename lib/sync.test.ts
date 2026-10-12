// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const sync = await import("@/lib/sync");
const { createChild, setReviewStatus, assignRealm, getChild } = await import("@/lib/children");
const { findOrCreateParentByEmail } = await import("@/lib/parents");
const { createRealm, getRealm } = await import("@/lib/realms");
const { getDb } = await import("@/lib/db");

let n = 0;
function kid(realmId: number, opts: { paid?: boolean; external?: boolean; graceUntil?: string } = {}) {
  n++;
  const parent = findOrCreateParentByEmail(`sync${n}@example.com`);
  const uuid = n.toString(16).padStart(32, "0");
  const child = createChild(parent.id, { nickname: `K${n}`, age: 9, mcUsername: `SyncKid${n}`, mcUuid: uuid });
  assignRealm(child.id, realmId);
  setReviewStatus(child.id, "approved");
  const db = getDb();
  if (opts.external) db.prepare("UPDATE children SET access_source = 'external' WHERE id = ?").run(child.id);
  if (opts.graceUntil) db.prepare("UPDATE children SET grace_until = ? WHERE id = ?").run(opts.graceUntil, child.id);
  if (opts.paid) {
    db.prepare(
      `INSERT INTO subscriptions (id, parent_id, child_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, 'cus', 'active', ?, ?)`
    ).run(`sub_${n}`, parent.id, child.id, new Date().toISOString(), new Date().toISOString());
  }
  return { child, uuid: sync.dashed(uuid) };
}

describe("whitelist sync", () => {
  it("accepts only the realm's current token", () => {
    const realm = createRealm("Sync A", "203.0.113.1", 20);
    const token = sync.rotateSyncToken(realm.id);
    expect(sync.realmForToken(`Bearer ${token}`)?.id).toBe(realm.id);
    expect(sync.realmForToken(null)).toBeNull();
    expect(sync.realmForToken(`Bearer ${token}x`)).toBeNull();
    sync.rotateSyncToken(realm.id);
    expect(sync.realmForToken(`Bearer ${token}`)).toBeNull();
  });

  it("lists paid and in-grace kids, never hand-added or unpaid ones", () => {
    const realm = createRealm("Sync B", "203.0.113.2", 20);
    const paid = kid(realm.id, { paid: true });
    const grace = kid(realm.id, { graceUntil: new Date(Date.now() + 3600_000).toISOString() });
    const graceOver = kid(realm.id, { graceUntil: new Date(Date.now() - 3600_000).toISOString() });
    const unpaid = kid(realm.id);
    const manual = kid(realm.id, { paid: true, external: true });

    const list = sync.desiredWhitelist(getRealm(realm.id)!);
    const uuids = list.entries.map((e) => e.uuid);
    expect(uuids).toContain(paid.uuid);
    expect(uuids).toContain(grace.uuid);
    expect(uuids).not.toContain(graceOver.uuid);
    expect(uuids).not.toContain(unpaid.uuid);
    expect(uuids).not.toContain(manual.uuid);
    expect(list.mode).toBe("apply");
  });

  it("says paused instead of sending an empty list that would mean 'remove everyone'", () => {
    const realm = createRealm("Sync C", "203.0.113.3", 20);
    kid(realm.id, { paid: true });
    sync.setSyncPaused(realm.id, true);
    const list = sync.desiredWhitelist(getRealm(realm.id)!);
    expect(list.mode).toBe("paused");
  });

  it("records the server's report and marks kids present", () => {
    const realm = createRealm("Sync D", "203.0.113.4", 20);
    const a = kid(realm.id, { paid: true });
    const report = sync.parseReport({ schema: 1, dry_run: false, added: [a.uuid], present: [], removed: [], preexisting: [], removed_by_others: [], errors: [] });
    expect(report).not.toBeNull();
    sync.applyReport(getRealm(realm.id)!, report!);
    expect(getChild(a.child.id)?.server_state).toBe("present");
    expect(sync.lastSyncRun(realm.id)?.report.added).toEqual([a.uuid.replace(/-/g, "")]);
  });

  it("doesn't change kid states on a dry run", () => {
    const realm = createRealm("Sync E", "203.0.113.5", 20);
    const a = kid(realm.id, { paid: true });
    sync.applyReport(getRealm(realm.id)!, sync.parseReport({ schema: 1, dry_run: true, added: [a.uuid] })!);
    expect(getChild(a.child.id)?.server_state).toBeNull();
  });

  it("rejects reports with junk in them", () => {
    expect(sync.parseReport({ schema: 2, dry_run: false })).toBeNull();
    expect(sync.parseReport({ schema: 1, dry_run: false, added: ["'; DROP TABLE children; --"] })).toBeNull();
    expect(sync.parseReport({ schema: 1, dry_run: "no" })).toBeNull();
  });
});
