// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

const { getDb, resetDbForTests, runMigrations, LATEST_SCHEMA_VERSION } = await import("@/lib/db");

const dirs: string[] = [];
function tempDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "fh-db-"));
  dirs.push(dir);
  return path.join(dir, "fullhearts.db");
}

// The exact shape prod had before migrations existed, with rows like the real ones.
function seedLegacy(file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE parents (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, email TEXT, created_at TEXT NOT NULL);
    CREATE TABLE realms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT NOT NULL, capacity INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE children (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER NOT NULL REFERENCES parents(id), realm_id INTEGER REFERENCES realms(id), created_at TEXT NOT NULL, status TEXT NOT NULL, nickname TEXT NOT NULL, age INTEGER NOT NULL, mc_username TEXT NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0, notes TEXT);
    INSERT INTO parents VALUES (1, 'Parent One', '5550000001', NULL, '2026-09-23T00:00:00.000Z');
    INSERT INTO parents VALUES (2, 'Developer', '5550000002', 'dev@example.com', '2026-10-11T00:00:00.000Z');
    INSERT INTO realms VALUES (1, 'EducraftFirstRealm', '203.0.113.5', 12, '2026-10-01T00:00:00.000Z');
    INSERT INTO children VALUES (1, 1, NULL, '2026-09-23T00:00:00.000Z', 'pending', 'Kid', 8, 'not_a_real_name', 0, 0, NULL);
    INSERT INTO children VALUES (2, 2, 1, '2026-10-11T00:00:00.000Z', 'whitelisted', 'Dev', 17, 'SihabMaybe', 0, 0, NULL);
  `);
  db.close();
}

afterEach(() => {
  resetDbForTests();
  delete process.env.FULLHEARTS_DB_PATH;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("migrations", () => {
  it("upgrades a pre-migration database without losing rows, and backs it up first", () => {
    const file = tempDbPath();
    seedLegacy(file);
    process.env.FULLHEARTS_DB_PATH = file;

    const db = getDb();
    const kids = db.prepare("SELECT mc_username FROM children ORDER BY id").all() as { mc_username: string }[];
    expect(kids.map((k) => k.mc_username)).toEqual(["not_a_real_name", "SihabMaybe"]);

    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as { version: number }[];
    expect(versions.at(-1)?.version).toBe(LATEST_SCHEMA_VERSION);

    const states = db
      .prepare("SELECT mc_username, review_status, access_source FROM children ORDER BY id")
      .all() as { mc_username: string; review_status: string; access_source: string }[];
    expect(states).toEqual([
      { mc_username: "not_a_real_name", review_status: "pending", access_source: "fullhearts" },
      { mc_username: "SihabMaybe", review_status: "approved", access_source: "external" }
    ]);
    const parents = db.prepare("SELECT id, phone, email FROM parents ORDER BY id").all();
    expect(parents).toEqual([
      { id: 1, phone: "5550000001", email: null },
      { id: 2, phone: "5550000002", email: "dev@example.com" }
    ]);

    const backups = readdirSync(path.join(path.dirname(file), "backups"));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^pre-migrate-.*\.db$/);
  });

  it("does nothing, and makes no new backup, when already up to date", () => {
    const file = tempDbPath();
    seedLegacy(file);
    process.env.FULLHEARTS_DB_PATH = file;
    getDb();
    resetDbForTests();
    getDb();
    expect(readdirSync(path.join(path.dirname(file), "backups"))).toHaveLength(1);
  });

  it("rolls a failing migration back and leaves earlier ones applied", () => {
    const db = new DatabaseSync(":memory:");
    expect(() =>
      runMigrations(db, ":memory:", [
        { version: 1, name: "ok", up: (d) => d.exec("CREATE TABLE a (x INTEGER)") },
        {
          version: 2,
          name: "broken",
          up: (d) => {
            d.exec("CREATE TABLE b (x INTEGER)");
            throw new Error("boom");
          }
        }
      ])
    ).toThrow("boom");

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name
    );
    expect(tables).toContain("a");
    expect(tables).not.toContain("b");
    const versions = db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
    expect(versions.map((v) => v.version)).toEqual([1]);
  });
});
