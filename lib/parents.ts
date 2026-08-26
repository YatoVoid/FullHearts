import { getDb } from "@/lib/db";

export type Parent = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
};

function toPlain(row: unknown): Parent {
  return { ...(row as Parent) };
}

export function getParent(id: number): Parent | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM parents WHERE id = ?").get(id);
  return row ? toPlain(row) : undefined;
}

export function getParentByPhone(phone: string): Parent | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM parents WHERE phone = ?").get(phone);
  return row ? toPlain(row) : undefined;
}

export function listParents(): Parent[] {
  const db = getDb();
  return db.prepare("SELECT * FROM parents ORDER BY created_at DESC").all().map(toPlain);
}

/** Looks up a parent by phone (the natural key); creates one if none exists. */
export function findOrCreateParent(name: string, phone: string, email: string | null): Parent {
  const existing = getParentByPhone(phone);
  if (existing) return existing;

  const db = getDb();
  const created_at = new Date().toISOString();
  const info = db
    .prepare("INSERT INTO parents (name, phone, email, created_at) VALUES (?, ?, ?, ?)")
    .run(name, phone, email, created_at);
  return getParent(Number(info.lastInsertRowid))!;
}
