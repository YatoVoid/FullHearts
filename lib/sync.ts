import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { getRealm, listRealms, type Realm } from "@/lib/realms";
import { subscriptionForChild } from "@/lib/billing";
import { isEntitled } from "@/lib/entitlement";
import { alertAdmins } from "@/lib/alerts";
import type { Child } from "@/lib/children";

export const SYNC_SCHEMA = 1;
const UUID_RE = /^[0-9a-f]{32}$/;
const DASHED_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function dashed(uuid: string): string {
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

function undashed(uuid: unknown): string | null {
  if (typeof uuid !== "string" || !DASHED_RE.test(uuid.toLowerCase())) return null;
  return uuid.toLowerCase().replace(/-/g, "");
}

// Only the hash is stored, so this is the one time the token can be shown.
export function rotateSyncToken(realmId: number): string {
  const token = `edusync_${randomBytes(32).toString("base64url")}`;
  getDb().prepare("UPDATE realms SET sync_token_hash = ? WHERE id = ?").run(hash(token), realmId);
  return token;
}

export function setSyncPaused(realmId: number, paused: boolean): void {
  getDb().prepare("UPDATE realms SET sync_paused = ? WHERE id = ?").run(paused ? 1 : 0, realmId);
}

export function realmForToken(authorization: string | null): Realm | null {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token.startsWith("edusync_") || token.length > 200) return null;
  // A lookup by hash of a high-entropy token: nothing to time, no compare needed.
  const row = getDb().prepare("SELECT id FROM realms WHERE sync_token_hash = ?").get(hash(token)) as { id: number } | undefined;
  return row ? (getRealm(row.id) ?? null) : null;
}

export type WhitelistEntry = { uuid: string; name: string };
export type WhitelistResponse = {
  schema: number;
  realm_id: number;
  generated_at: string;
  mode: "apply" | "paused";
  entries: WhitelistEntry[];
};

// Hand-added players never appear here, so the server script never has a reason to touch them.
// Paused means "change nothing", never "remove everyone".
export function desiredWhitelist(realm: Realm, now: Date = new Date()): WhitelistResponse {
  const kids = getDb()
    .prepare(
      `SELECT * FROM children WHERE realm_id = ? AND access_source = 'fullhearts' AND review_status = 'approved' AND mc_uuid IS NOT NULL`
    )
    .all(realm.id) as unknown as Child[];
  const entries = kids
    .filter((k) => UUID_RE.test(k.mc_uuid!) && isEntitled(k, subscriptionForChild(k.id), now))
    .map((k) => ({ uuid: dashed(k.mc_uuid!), name: k.mc_username }));
  getDb().prepare("UPDATE realms SET sync_last_seen_at = ? WHERE id = ?").run(now.toISOString(), realm.id);
  return {
    schema: SYNC_SCHEMA,
    realm_id: realm.id,
    generated_at: now.toISOString(),
    mode: realm.sync_paused ? "paused" : "apply",
    entries: realm.sync_paused ? [] : entries
  };
}

export type SyncReport = {
  dry_run: boolean;
  present: string[];
  added: string[];
  removed: string[];
  preexisting: string[];
  removed_by_others: string[];
  errors: { uuid?: string; message: string }[];
};

const MAX_LIST = 500;

export function parseReport(body: unknown): SyncReport | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.schema !== SYNC_SCHEMA || typeof b.dry_run !== "boolean") return null;
  const list = (v: unknown): string[] | null => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > MAX_LIST) return null;
    const out = v.map(undashed);
    return out.every((u): u is string => u !== null) ? out : null;
  };
  const present = list(b.present);
  const added = list(b.added);
  const removed = list(b.removed);
  const preexisting = list(b.preexisting);
  const removedByOthers = list(b.removed_by_others);
  if (!present || !added || !removed || !preexisting || !removedByOthers) return null;
  const errors = Array.isArray(b.errors)
    ? b.errors.slice(0, 50).map((e) => {
        const err = (e ?? {}) as Record<string, unknown>;
        return { uuid: undashed(err.uuid) ?? undefined, message: String(err.message ?? "").slice(0, 300) };
      })
    : [];
  return { dry_run: b.dry_run, present, added, removed, preexisting, removed_by_others: removedByOthers, errors };
}

export function applyReport(realm: Realm, report: SyncReport, now: Date = new Date()): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO sync_runs (realm_id, at, dry_run, report) VALUES (?, ?, ?, ?)").run(
      realm.id,
      now.toISOString(),
      report.dry_run ? 1 : 0,
      JSON.stringify(report)
    );
    db.prepare("UPDATE realms SET sync_last_seen_at = ?, sync_last_mode = ? WHERE id = ?").run(
      now.toISOString(),
      report.dry_run ? "dryrun" : "apply",
      realm.id
    );
    if (!report.dry_run) {
      const mark = db.prepare(
        "UPDATE children SET server_state = ?, server_state_at = ? WHERE realm_id = ? AND mc_uuid = ? AND access_source = 'fullhearts'"
      );
      const at = now.toISOString();
      for (const u of [...report.present, ...report.added]) mark.run("present", at, realm.id, u);
      for (const u of report.removed) mark.run("absent", at, realm.id, u);
      for (const u of report.preexisting) mark.run("preexisting", at, realm.id, u);
      for (const u of report.removed_by_others) mark.run("removed_by_other", at, realm.id, u);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  // Keep a week of runs; enough to investigate, small enough to forget.
  db.prepare("DELETE FROM sync_runs WHERE realm_id = ? AND at < ?").run(realm.id, new Date(now.getTime() - 7 * 86400_000).toISOString());
}

export type SyncRun = { id: number; at: string; dry_run: number; report: SyncReport };

export function lastSyncRun(realmId: number): SyncRun | null {
  const row = getDb()
    .prepare("SELECT id, at, dry_run, report FROM sync_runs WHERE realm_id = ? ORDER BY id DESC LIMIT 1")
    .get(realmId) as { id: number; at: string; dry_run: number; report: string } | undefined;
  return row ? { ...row, report: JSON.parse(row.report) as SyncReport } : null;
}

const SILENT_MS = 15 * 60_000;
const UNCONFIRMED_MS = 30 * 60_000;

export function checkSyncHealth(now: Date = new Date()): void {
  for (const realm of listRealms()) {
    if (!realm.sync_token_hash || !realm.sync_last_seen_at || realm.sync_paused) continue;
    const silentFor = now.getTime() - new Date(realm.sync_last_seen_at).getTime();
    if (silentFor > SILENT_MS) {
      alertAdmins(
        `sync-silent:${realm.id}:${realm.sync_last_seen_at}`,
        `EduCraft: whitelist sync for ${realm.name} stopped checking in`,
        `The sync script on the ${realm.name} server last checked in at ${realm.sync_last_seen_at}. New kids won't be added and ended ones won't be removed until it's back.\n`
      );
    }
  }

  const stuck = getDb()
    .prepare(
      `SELECT children.id, children.realm_id, subscriptions.updated_at FROM children
       JOIN subscriptions ON subscriptions.child_id = children.id AND subscriptions.status IN ('active','trialing')
       WHERE children.access_source = 'fullhearts' AND (children.server_state IS NULL OR children.server_state != 'present')
         AND subscriptions.updated_at < ?`
    )
    .all(new Date(now.getTime() - UNCONFIRMED_MS).toISOString()) as { id: number; realm_id: number; updated_at: string }[];
  for (const row of stuck) {
    alertAdmins(
      `sync-unconfirmed:${row.id}:${row.updated_at}`,
      "EduCraft: a paid child isn't on the server yet",
      `Child ${row.id} has been paid for over 30 minutes but the server hasn't confirmed them on the whitelist. Check the sync panel in /admin.\n`
    );
  }
}
