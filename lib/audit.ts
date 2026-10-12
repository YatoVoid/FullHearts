import { getDb } from "@/lib/db";

export type AuditEntry = {
  actor: string;
  parentId?: number | null;
  childId?: number | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
};

export type AuditRow = {
  id: number;
  at: string;
  actor: string;
  event: string;
  parent_id: number | null;
  child_id: number | null;
  ip: string | null;
  detail: string | null;
};

// Kept apart from stdout logs so scanner noise can't bury it.
export function audit(event: string, entry: AuditEntry): void {
  getDb()
    .prepare(
      "INSERT INTO audit_log (at, actor, event, parent_id, child_id, ip, detail) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      new Date().toISOString(),
      entry.actor,
      event,
      entry.parentId ?? null,
      entry.childId ?? null,
      entry.ip ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null
    );
}

export function recentAudit(limit = 50): AuditRow[] {
  return getDb()
    .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?")
    .all(limit)
    .map((r) => ({ ...(r as AuditRow) }));
}
