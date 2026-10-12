import { getDb } from "@/lib/db";
import { getRealm } from "@/lib/realms";

export type ReviewStatus = "pending" | "approved" | "rejected";

// "external" means the server owner whitelisted this player by hand. The
// website shows them but never bills them or touches their whitelist entry.
export type AccessSource = "fullhearts" | "external";

export type Child = {
  id: number;
  parent_id: number;
  realm_id: number | null;
  created_at: string;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  access_source: AccessSource;
  nickname: string;
  age: number;
  mc_username: string;
  mc_uuid: string | null;
  mc_verified_at: string | null;
  suspended_at: string | null;
  grace_until: string | null;
  server_state: string | null;
  server_state_at: string | null;
  approval_sent_at: string | null;
  approval_expires_at: string | null;
  notes: string | null;
};

/** A child joined with the parent/realm fields the admin dashboard displays. */
export type ChildWithContext = Child & {
  parent_name: string;
  parent_phone: string | null;
  parent_email: string | null;
  realm_name: string | null;
  realm_address: string | null;
};

export type NewChild = {
  nickname: string;
  age: number;
  mcUsername: string;
  mcUuid?: string | null;
};

const CHILD_COLUMNS = `
  children.id, children.parent_id, children.realm_id, children.created_at,
  children.review_status, children.reviewed_at, children.access_source,
  children.nickname, children.age, children.mc_username, children.mc_uuid,
  children.mc_verified_at, children.suspended_at, children.grace_until,
  children.server_state, children.server_state_at, children.approval_sent_at,
  children.approval_expires_at, children.notes
`;

const CONTEXT_SELECT = `
  SELECT
    ${CHILD_COLUMNS},
    parents.name AS parent_name,
    parents.phone AS parent_phone,
    parents.email AS parent_email,
    realms.name AS realm_name,
    realms.address AS realm_address
  FROM children
  JOIN parents ON parents.id = children.parent_id
  LEFT JOIN realms ON realms.id = children.realm_id
`;

function toPlain<T extends object>(row: unknown): T {
  return { ...(row as T) };
}

export function usernameTaken(mcUsername: string, mcUuid?: string | null): boolean {
  const row = getDb()
    .prepare(
      `SELECT id FROM children
       WHERE review_status != 'rejected'
         AND (lower(mc_username) = lower(?) OR (? IS NOT NULL AND mc_uuid = ?))
       LIMIT 1`
    )
    .get(mcUsername, mcUuid ?? null, mcUuid ?? null);
  return row !== undefined;
}

export function createChild(parentId: number, input: NewChild): Child {
  const db = getDb();
  const created_at = new Date().toISOString();
  const verified = input.mcUuid ? created_at : null;
  // status/price_cents/paid are the pre-billing columns, kept for history only.
  const info = db
    .prepare(
      `INSERT INTO children
         (parent_id, created_at, status, nickname, age, mc_username, mc_uuid, mc_verified_at, price_cents, paid, notes)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 0, 0, NULL)`
    )
    .run(parentId, created_at, input.nickname, input.age, input.mcUsername, input.mcUuid ?? null, verified);
  return getChild(Number(info.lastInsertRowid))!;
}

export function getChild(id: number): Child | undefined {
  const row = getDb().prepare(`SELECT ${CHILD_COLUMNS} FROM children WHERE id = ?`).get(id);
  return row ? toPlain<Child>(row) : undefined;
}

export function getChildWithContext(id: number): ChildWithContext | undefined {
  const row = getDb().prepare(`${CONTEXT_SELECT} WHERE children.id = ?`).get(id);
  return row ? toPlain<ChildWithContext>(row) : undefined;
}

export function listChildren(): ChildWithContext[] {
  // Break same-millisecond ties by id (insertion order) so ordering is deterministic.
  const rows = getDb().prepare(`${CONTEXT_SELECT} ORDER BY children.created_at DESC, children.id DESC`).all();
  return rows.map((r) => toPlain<ChildWithContext>(r));
}

export function listChildrenForParent(parentId: number): ChildWithContext[] {
  const rows = getDb()
    .prepare(`${CONTEXT_SELECT} WHERE children.parent_id = ? ORDER BY children.id`)
    .all(parentId);
  return rows.map((r) => toPlain<ChildWithContext>(r));
}

export function setReviewStatus(id: number, status: ReviewStatus): Child | undefined {
  getDb()
    .prepare("UPDATE children SET review_status = ?, reviewed_at = ? WHERE id = ?")
    .run(status, status === "pending" ? null : new Date().toISOString(), id);
  return getChild(id);
}

export function updateNotes(id: number, notes: string): Child | undefined {
  getDb().prepare("UPDATE children SET notes = ? WHERE id = ?").run(notes.trim() || null, id);
  return getChild(id);
}

export function setMinecraftProfile(id: number, name: string, uuid: string): Child | undefined {
  getDb()
    .prepare("UPDATE children SET mc_username = ?, mc_uuid = ?, mc_verified_at = ? WHERE id = ?")
    .run(name, uuid, new Date().toISOString(), id);
  return getChild(id);
}

export function setSuspended(id: number, suspended: boolean): Child | undefined {
  getDb()
    .prepare("UPDATE children SET suspended_at = ? WHERE id = ?")
    .run(suspended ? new Date().toISOString() : null, id);
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

  getDb().prepare("UPDATE children SET realm_id = ? WHERE id = ?").run(realmId, childId);
  return { ok: true, child: getChild(childId)! };
}

// The parent goes with their last child, so a removed family leaves no contact details behind.
export function deleteChild(id: number): { deletedParent: boolean } {
  const db = getDb();
  const child = getChild(id);
  if (!child) return { deletedParent: false };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM children WHERE id = ?").run(id);
    const left = db.prepare("SELECT COUNT(*) AS n FROM children WHERE parent_id = ?").get(child.parent_id) as { n: number };
    if (left.n === 0) db.prepare("DELETE FROM parents WHERE id = ?").run(child.parent_id);
    db.exec("COMMIT");
    return { deletedParent: left.n === 0 };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
