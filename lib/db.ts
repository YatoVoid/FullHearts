import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

// Loaded via createRequire (not a static `import`) because Vite's SSR
// transform (used by our Vitest setup) doesn't recognize node:sqlite as a
// builtin and mis-rewrites it to a bare "sqlite" specifier, which doesn't
// exist as an npm package. require() bypasses that transform entirely, and
// behaves identically under Next.js's Node runtime.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = DatabaseSyncType;

// Server-only. A dev/admin feature, not part of the static-exported site, so
// a plain file-backed DB is fine. See next.config.mjs's NEXT_NODE_SERVER
// path for how this runs in a real (non-static-export) deployment.
// Read lazily (not at module load) so tests can point FULLHEARTS_DB_PATH at
// ":memory:" before the first call, regardless of import order.
function dbPath(): string {
  return process.env.FULLHEARTS_DB_PATH || path.join(process.cwd(), "data", "fullhearts.db");
}

let instance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (instance) return instance;
  const target = dbPath();
  if (target !== ":memory:") mkdirSync(path.dirname(target), { recursive: true });
  instance = new DatabaseSync(target);
  instance.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS realms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL REFERENCES parents(id),
      realm_id INTEGER REFERENCES realms(id),
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      nickname TEXT NOT NULL,
      age INTEGER NOT NULL,
      mc_username TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );
  `);
  migrateOldRegistrations(instance);
  return instance;
}

// The original schema (single "registrations" table: one row = one child
// with a full copy of the parent's contact info) predates parents/children/
// realms as separate tables. Split any leftover rows from that shape into
// the new tables, deduping parents by phone, then rename the old table
// instead of dropping it. Guarded by the old table's existence, so this
// only ever runs once per database.
function migrateOldRegistrations(db: DatabaseSync): void {
  const oldTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'registrations'")
    .get();
  if (!oldTable) return;

  const columns = db.prepare("PRAGMA table_info(registrations)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "parent_name")) return;

  type OldRow = {
    created_at: string;
    status: string;
    child_nickname: string;
    child_age: number;
    child_mc_username: string;
    parent_name: string;
    parent_phone: string;
    parent_email: string | null;
    price_cents: number;
    paid: number;
    notes: string | null;
  };
  const rows = db.prepare("SELECT * FROM registrations").all() as OldRow[];

  const insertParent = db.prepare(
    "INSERT OR IGNORE INTO parents (name, phone, email, created_at) VALUES (?, ?, ?, ?)"
  );
  const findParent = db.prepare("SELECT id FROM parents WHERE phone = ?");
  const insertChild = db.prepare(`
    INSERT INTO children
      (parent_id, created_at, status, nickname, age, mc_username, price_cents, paid, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    insertParent.run(row.parent_name, row.parent_phone, row.parent_email, row.created_at);
    const parent = findParent.get(row.parent_phone) as { id: number };
    insertChild.run(
      parent.id,
      row.created_at,
      row.status,
      row.child_nickname,
      row.child_age,
      row.child_mc_username,
      row.price_cents,
      row.paid,
      row.notes
    );
  }

  db.exec("ALTER TABLE registrations RENAME TO registrations_migrated_backup");
}
