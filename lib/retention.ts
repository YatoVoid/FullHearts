import { getDb } from "@/lib/db";
import { deleteChild } from "@/lib/children";
import { audit } from "@/lib/audit";

const DAY = 24 * 60 * 60_000;
export const REJECTED_RETENTION_DAYS = 30;

// Enforces what the EduCraft privacy notice promises about retention.
export function applyRetention(now: Date = new Date()): { rejected: number } {
  const cutoff = new Date(now.getTime() - REJECTED_RETENTION_DAYS * DAY).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT id FROM children
       WHERE review_status = 'rejected' AND access_source = 'fullhearts' AND reviewed_at IS NOT NULL AND reviewed_at < ?`
    )
    .all(cutoff) as { id: number }[];
  for (const { id } of rows) {
    deleteChild(id);
    audit("child_deleted_retention", { actor: "system", childId: id, detail: { reason: "rejected" } });
  }
  return { rejected: rows.length };
}
