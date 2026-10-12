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

// Server-only. One Node process on one droplet, so a plain file-backed DB is fine.
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
  instance.exec("PRAGMA busy_timeout = 5000");
  runMigrations(instance, target);
  return instance;
}

export type Migration = { version: number; name: string; up: (db: DatabaseSync) => void };

// Append only. Never edit a migration that has shipped; add a new one.
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "base schema",
    up: (db) => {
      db.exec(`
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
      migrateOldRegistrations(db);
    }
  },
  {
    version: 2,
    name: "audit log",
    up: (db) => {
      db.exec(`
        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          actor TEXT NOT NULL,
          event TEXT NOT NULL,
          parent_id INTEGER,
          child_id INTEGER,
          ip TEXT,
          detail TEXT
        );
        CREATE INDEX audit_log_at ON audit_log (at);
      `);
    }
  },
  {
    version: 3,
    name: "email outbox",
    up: (db) => {
      db.exec(`
        CREATE TABLE email_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          idempotency_key TEXT NOT NULL UNIQUE,
          to_addr TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at TEXT NOT NULL,
          last_error TEXT,
          created_at TEXT NOT NULL,
          sent_at TEXT
        );
        CREATE INDEX email_outbox_due ON email_outbox (status, next_attempt_at);
      `);
    }
  },
  {
    version: 4,
    name: "review states and parent email",
    up: (db) => {
      // Phone becomes optional and email becomes the account key, so parents
      // is rebuilt. Rows keep their ids, so children.parent_id still points right.
      db.exec(`
        CREATE TABLE parents_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          created_at TEXT NOT NULL,
          stripe_customer_id TEXT,
          deleted_at TEXT
        );
        INSERT INTO parents_new (id, name, phone, email, created_at)
          SELECT id, name, phone, NULLIF(TRIM(email), ''), created_at FROM parents;
        DROP TABLE parents;
        ALTER TABLE parents_new RENAME TO parents;
        CREATE UNIQUE INDEX parents_email ON parents (lower(email)) WHERE email IS NOT NULL;

        ALTER TABLE children ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending';
        ALTER TABLE children ADD COLUMN reviewed_at TEXT;
        ALTER TABLE children ADD COLUMN access_source TEXT NOT NULL DEFAULT 'fullhearts';
        ALTER TABLE children ADD COLUMN mc_uuid TEXT;
        ALTER TABLE children ADD COLUMN mc_verified_at TEXT;
        ALTER TABLE children ADD COLUMN suspended_at TEXT;
        ALTER TABLE children ADD COLUMN grace_until TEXT;
        ALTER TABLE children ADD COLUMN server_state TEXT;
        ALTER TABLE children ADD COLUMN server_state_at TEXT;
        ALTER TABLE children ADD COLUMN approval_sent_at TEXT;
        ALTER TABLE children ADD COLUMN approval_expires_at TEXT;

        UPDATE children SET review_status = 'rejected' WHERE status = 'rejected';
        -- Anyone already whitelisted was added to the server by hand. They stay
        -- the server owner's to manage; the website never bills or removes them.
        UPDATE children SET review_status = 'approved', access_source = 'external',
          reviewed_at = created_at WHERE status = 'whitelisted';
      `);
    }
  },
  {
    version: 5,
    name: "parent sign-in",
    up: (db) => {
      db.exec(`
        CREATE TABLE login_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          ip TEXT
        );
        CREATE INDEX login_codes_email ON login_codes (email, created_at);
        CREATE INDEX login_codes_ip ON login_codes (ip, created_at);

        CREATE TABLE parent_sessions (
          token_hash TEXT PRIMARY KEY,
          parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        );
        CREATE INDEX parent_sessions_parent ON parent_sessions (parent_id);
      `);
    }
  },
  {
    version: 6,
    name: "consents",
    up: (db) => {
      // Proof of what a parent agreed to, which version, and when. Kept even
      // after the children it covered are deleted.
      db.exec(`
        CREATE TABLE consents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          terms_version TEXT NOT NULL,
          accepted_at TEXT NOT NULL,
          ip TEXT,
          user_agent TEXT,
          child_ids TEXT
        );
        CREATE INDEX consents_parent ON consents (parent_id);
      `);
    }
  },
  {
    version: 7,
    name: "subscriptions",
    up: (db) => {
      db.exec(`
        CREATE TABLE subscriptions (
          id TEXT PRIMARY KEY,
          parent_id INTEGER NOT NULL,
          child_id INTEGER NOT NULL,
          customer_id TEXT NOT NULL,
          status TEXT NOT NULL,
          current_period_end TEXT,
          ended_at TEXT,
          canceled_by TEXT,
          refunded_cents INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX subscriptions_child ON subscriptions (child_id);

        CREATE TABLE stripe_events (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          received_at TEXT NOT NULL
        );
      `);
    }
  },
  {
    version: 8,
    name: "whitelist sync",
    up: (db) => {
      db.exec(`
        ALTER TABLE realms ADD COLUMN sync_token_hash TEXT;
        ALTER TABLE realms ADD COLUMN sync_paused INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE realms ADD COLUMN sync_last_seen_at TEXT;
        ALTER TABLE realms ADD COLUMN sync_last_mode TEXT;

        CREATE TABLE sync_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          realm_id INTEGER NOT NULL,
          at TEXT NOT NULL,
          dry_run INTEGER NOT NULL,
          report TEXT NOT NULL
        );
        CREATE INDEX sync_runs_realm ON sync_runs (realm_id, id);
      `);
    }
  }
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function runMigrations(db: DatabaseSync, target: string, migrations: Migration[] = MIGRATIONS): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version)
  );
  const pending = migrations.filter((m) => !applied.has(m.version));
  if (pending.length === 0) return;

  // A database that already holds data gets a full copy before anything
  // changes, so a bad migration can be undone by swapping the file back.
  const hasData = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'children'").get();
  if (target !== ":memory:" && hasData) backupBeforeMigrating(db, target);

  // Table rebuilds (the only way SQLite can drop a NOT NULL) would trip
  // foreign keys mid-copy. The pragma can't change inside a transaction, so
  // it's switched off around them and every reference is re-checked before
  // each commit instead.
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    for (const m of pending) {
      db.exec("BEGIN IMMEDIATE");
      try {
        m.up(db);
        const broken = db.prepare("PRAGMA foreign_key_check").all();
        if (broken.length > 0) throw new Error(`migration ${m.version} left ${broken.length} broken references`);
        db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
          m.version,
          m.name,
          new Date().toISOString()
        );
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

function backupBeforeMigrating(db: DatabaseSync, target: string): void {
  const dir = path.join(path.dirname(target), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `pre-migrate-${stamp}.db`);
  db.prepare("VACUUM INTO ?").run(file);
}

export function resetDbForTests(): void {
  instance?.close();
  instance = null;
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
