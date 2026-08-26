import { getDb } from "@/lib/db";
import { getRealm } from "@/lib/realms";

export type ChildStatus = "pending" | "whitelisted" | "rejected";

export type Child = {
  id: number;
  parent_id: number;
  realm_id: number | null;
  created_at: string;
  status: ChildStatus;
  nickname: string;
  age: number;
  mc_username: string;
  price_cents: number;
  paid: boolean;
  notes: string | null;
};

/** A child joined with the parent/realm fields the admin dashboard displays. */
export type ChildWithContext = Child & {
  parent_name: string;
  parent_phone: string;
  parent_email: string | null;
  realm_name: string | null;
  realm_address: string | null;
};

export type NewChild = {
  nickname: string;
  age: number;
  mcUsername: string;
};

const CONTEXT_SELECT = `
  SELECT
    children.*,
    parents.name AS parent_name,
    parents.phone AS parent_phone,
    parents.email AS parent_email,
    realms.name AS realm_name,
    realms.address AS realm_address
  FROM children
  JOIN parents ON parents.id = children.parent_id
  LEFT JOIN realms ON realms.id = children.realm_id
`;

// A parent phone that already has a pending/whitelisted child with a
// *different* Minecraft username, submitted within this window, is flagged.
// The admin can still see and override from the dashboard. This only guards
// against an accidental double-submit of the same request, not a parent
// legitimately registering a second, different child under the same phone.
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function hasRecentSubmission(parentPhone: string, mcUsername: string): boolean {
  const db = getDb();
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const row = db
    .prepare(
      `SELECT children.id FROM children
       JOIN parents ON parents.id = children.parent_id
       WHERE parents.phone = ? AND children.mc_username = ?
         AND children.status != 'rejected' AND children.created_at >= ?
       LIMIT 1`
    )
    .get(parentPhone, mcUsername, cutoff);
  return row !== undefined;
}

function toPlain<T extends object>(row: unknown): T {
  const r = row as T & { paid: number | boolean };
  return { ...r, paid: Boolean(r.paid) };
}

export function createChild(parentId: number, input: NewChild): Child {
  const db = getDb();
  const created_at = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO children (parent_id, created_at, status, nickname, age, mc_username, price_cents, paid, notes)
       VALUES (?, ?, 'pending', ?, ?, ?, 0, 0, NULL)`
    )
    .run(parentId, created_at, input.nickname, input.age, input.mcUsername);
  return getChild(Number(info.lastInsertRowid))!;
}

export function getChild(id: number): Child | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM children WHERE id = ?").get(id);
  return row ? toPlain<Child>(row) : undefined;
}

export function listChildren(): ChildWithContext[] {
  const db = getDb();
  // Break same-millisecond ties by id (insertion order) so ordering is deterministic.
  const rows = db.prepare(`${CONTEXT_SELECT} ORDER BY children.created_at DESC, children.id DESC`).all();
  return rows.map((r) => toPlain<ChildWithContext>(r));
}

export function updateStatus(id: number, status: ChildStatus): Child | undefined {
  const db = getDb();
  db.prepare("UPDATE children SET status = ? WHERE id = ?").run(status, id);
  return getChild(id);
}

export function updatePaid(id: number, paid: boolean): Child | undefined {
  const db = getDb();
  db.prepare("UPDATE children SET paid = ? WHERE id = ?").run(paid ? 1 : 0, id);
  return getChild(id);
}

export function updatePriceCents(id: number, priceCents: number): Child | undefined {
  const db = getDb();
  db.prepare("UPDATE children SET price_cents = ? WHERE id = ?").run(priceCents, id);
  return getChild(id);
}

export function updateNotes(id: number, notes: string): Child | undefined {
  const db = getDb();
  db.prepare("UPDATE children SET notes = ? WHERE id = ?").run(notes.trim() || null, id);
  return getChild(id);
}

/** Assigns a realm to a child, refusing if the realm is already at capacity. */
export function assignRealm(childId: number, realmId: number): { ok: true; child: Child } | { ok: false; error: string } {
  const realm = getRealm(realmId);
  if (!realm) return { ok: false, error: "Realm not found." };

  const child = getChild(childId);
  if (!child) return { ok: false, error: "Child not found." };

  // Moving a child already in this realm doesn't count against its own slot.
  const alreadyHere = child.realm_id === realmId;
  if (!alreadyHere && realm.assignedCount >= realm.capacity) {
    return { ok: false, error: `${realm.name} is full (${realm.assignedCount}/${realm.capacity}).` };
  }

  const db = getDb();
  db.prepare("UPDATE children SET realm_id = ? WHERE id = ?").run(realmId, childId);
  return { ok: true, child: getChild(childId)! };
}
