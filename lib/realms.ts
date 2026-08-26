import { getDb } from "@/lib/db";

export type Realm = {
  id: number;
  name: string;
  address: string;
  capacity: number;
  created_at: string;
  assignedCount: number;
};

function toPlain(row: unknown): Realm {
  return { ...(row as Realm) };
}

const SELECT_WITH_COUNT = `
  SELECT realms.*, (
    SELECT COUNT(*) FROM children WHERE children.realm_id = realms.id
  ) AS assignedCount
  FROM realms
`;

export function listRealms(): Realm[] {
  const db = getDb();
  return db.prepare(`${SELECT_WITH_COUNT} ORDER BY realms.created_at ASC`).all().map(toPlain);
}

export function getRealm(id: number): Realm | undefined {
  const db = getDb();
  const row = db.prepare(`${SELECT_WITH_COUNT} WHERE realms.id = ?`).get(id);
  return row ? toPlain(row) : undefined;
}

export function createRealm(name: string, address: string, capacity: number): Realm {
  const db = getDb();
  const created_at = new Date().toISOString();
  const info = db
    .prepare("INSERT INTO realms (name, address, capacity, created_at) VALUES (?, ?, ?, ?)")
    .run(name, address, capacity, created_at);
  return getRealm(Number(info.lastInsertRowid))!;
}
