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
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      child_nickname TEXT NOT NULL,
      child_age INTEGER NOT NULL,
      child_mc_username TEXT NOT NULL,
      parent_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      parent_email TEXT,
      price_cents INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    )
  `);
  migrate(instance);
  return instance;
}

// SQLite has no "ADD COLUMN IF NOT EXISTS", and CREATE TABLE IF NOT EXISTS
// above is a no-op against a table that already existed before a column was
// added here. Check pragma table_info and backfill by hand instead.
function migrate(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(registrations)").all() as { name: string }[];
  const names = new Set(columns.map((c) => c.name));
  if (!names.has("paid")) {
    db.exec("ALTER TABLE registrations ADD COLUMN paid INTEGER NOT NULL DEFAULT 0");
  }
}
