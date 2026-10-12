import { getDb } from "@/lib/db";

export type Parent = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  stripe_customer_id: string | null;
  deleted_at: string | null;
};

function toPlain(row: unknown): Parent {
  return { ...(row as Parent) };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getParent(id: number): Parent | undefined {
  const row = getDb().prepare("SELECT * FROM parents WHERE id = ?").get(id);
  return row ? toPlain(row) : undefined;
}

export function getParentByEmail(email: string): Parent | undefined {
  const row = getDb().prepare("SELECT * FROM parents WHERE lower(email) = ?").get(normalizeEmail(email));
  return row ? toPlain(row) : undefined;
}

export function getParentByPhone(phone: string): Parent | undefined {
  const row = getDb().prepare("SELECT * FROM parents WHERE phone = ? ORDER BY id LIMIT 1").get(phone);
  return row ? toPlain(row) : undefined;
}

export function listParents(): Parent[] {
  return getDb().prepare("SELECT * FROM parents ORDER BY created_at DESC").all().map(toPlain);
}

export function findOrCreateParentByEmail(email: string): Parent {
  const existing = getParentByEmail(email);
  if (existing) return existing;
  const info = getDb()
    .prepare("INSERT INTO parents (name, email, created_at) VALUES ('', ?, ?)")
    .run(normalizeEmail(email), new Date().toISOString());
  return getParent(Number(info.lastInsertRowid))!;
}

export function updateParentContact(id: number, name: string, phone: string | null): Parent | undefined {
  getDb().prepare("UPDATE parents SET name = ?, phone = ? WHERE id = ?").run(name, phone, id);
  return getParent(id);
}

export function setStripeCustomer(id: number, customerId: string): void {
  getDb().prepare("UPDATE parents SET stripe_customer_id = ? WHERE id = ?").run(customerId, id);
}

export function findOrCreateParent(name: string, phone: string, email: string | null): Parent {
  const existing = (email ? getParentByEmail(email) : undefined) ?? getParentByPhone(phone);
  if (existing) return existing;
  const info = getDb()
    .prepare("INSERT INTO parents (name, phone, email, created_at) VALUES (?, ?, ?, ?)")
    .run(name, phone, email ? normalizeEmail(email) : null, new Date().toISOString());
  return getParent(Number(info.lastInsertRowid))!;
}
