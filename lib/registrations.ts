import { getDb } from "@/lib/db";

export type RegistrationStatus = "pending" | "whitelisted" | "rejected";

export type Registration = {
  id: number;
  created_at: string;
  status: RegistrationStatus;
  child_nickname: string;
  child_age: number;
  child_mc_username: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string | null;
  price_cents: number;
  paid: boolean;
  notes: string | null;
};

export type NewRegistration = {
  childNickname: string;
  childAge: number;
  childMcUsername: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string | null;
};

// A parent phone that already has a pending/whitelisted registration for a
// *different* Minecraft username within this window is flagged. The admin
// can still see and override both from the dashboard. This is a soft abuse
// guard, not a substitute for the manual review the registration issue
// describes; we don't collect any child contact info to cross-check against.
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function hasRecentSubmission(parentPhone: string, childMcUsername: string): boolean {
  const db = getDb();
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const row = db
    .prepare(
      `SELECT id FROM registrations
       WHERE parent_phone = ? AND child_mc_username != ? AND status != 'rejected' AND created_at >= ?
       LIMIT 1`
    )
    .get(parentPhone, childMcUsername, cutoff);
  return row !== undefined;
}

export function createRegistration(input: NewRegistration): Registration {
  const db = getDb();
  const created_at = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO registrations
      (created_at, status, child_nickname, child_age, child_mc_username, parent_name, parent_phone, parent_email, price_cents, notes)
    VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, 0, NULL)
  `);
  const info = stmt.run(
    created_at,
    input.childNickname,
    input.childAge,
    input.childMcUsername,
    input.parentName,
    input.parentPhone,
    input.parentEmail ?? null
  );
  return getRegistration(Number(info.lastInsertRowid))!;
}

// node:sqlite returns null-prototype row objects, which Next.js refuses to
// pass from a Server to a Client Component ("Classes or null prototypes are
// not supported"). Spread into a plain object at the boundary, and convert
// SQLite's 0/1 integer storage for `paid` into a real boolean.
function toPlain(row: unknown): Registration {
  const r = row as Registration & { paid: number | boolean };
  return { ...r, paid: Boolean(r.paid) };
}

export function getRegistration(id: number): Registration | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM registrations WHERE id = ?").get(id);
  return row ? toPlain(row) : undefined;
}

export function listRegistrations(): Registration[] {
  const db = getDb();
  // Break same-millisecond ties by id (insertion order) so ordering is deterministic.
  const rows = db.prepare("SELECT * FROM registrations ORDER BY created_at DESC, id DESC").all();
  return rows.map(toPlain);
}

export function updateStatus(id: number, status: RegistrationStatus): Registration | undefined {
  const db = getDb();
  db.prepare("UPDATE registrations SET status = ? WHERE id = ?").run(status, id);
  return getRegistration(id);
}

export function updatePaid(id: number, paid: boolean): Registration | undefined {
  const db = getDb();
  db.prepare("UPDATE registrations SET paid = ? WHERE id = ?").run(paid ? 1 : 0, id);
  return getRegistration(id);
}

export function updateNotes(id: number, notes: string): Registration | undefined {
  const db = getDb();
  db.prepare("UPDATE registrations SET notes = ? WHERE id = ?").run(notes.trim() || null, id);
  return getRegistration(id);
}
