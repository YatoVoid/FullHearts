import { getDb } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/educraft";

export type ConsentKind = "guardian" | "billing" | "terms";

export function recordConsents(
  parentId: number,
  kinds: ConsentKind[],
  ctx: { ip: string | null; userAgent: string | null; childIds: number[] }
): void {
  const stmt = getDb().prepare(
    "INSERT INTO consents (parent_id, kind, terms_version, accepted_at, ip, user_agent, child_ids) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const at = new Date().toISOString();
  for (const kind of kinds) {
    stmt.run(parentId, kind, TERMS_VERSION, at, ctx.ip, ctx.userAgent?.slice(0, 300) ?? null, JSON.stringify(ctx.childIds));
  }
}

export type ConsentRow = {
  id: number;
  parent_id: number;
  kind: ConsentKind;
  terms_version: string;
  accepted_at: string;
  ip: string | null;
  user_agent: string | null;
  child_ids: string | null;
};

export function consentsForParent(parentId: number): ConsentRow[] {
  return getDb()
    .prepare("SELECT * FROM consents WHERE parent_id = ? ORDER BY id")
    .all(parentId)
    .map((r) => ({ ...(r as ConsentRow) }));
}
