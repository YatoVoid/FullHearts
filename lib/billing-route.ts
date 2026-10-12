import { currentParent } from "@/lib/parent-session";
import { getChild, type Child } from "@/lib/children";
import { readJsonLimited, isSameOrigin, forbidden } from "@/lib/http";
import type { Parent } from "@/lib/parents";

type Ok<T> = { ok: true; parent: Parent; child: Child; body: T };
type Fail = { ok: false; response: Response };

export async function parentChildRequest<T extends { childId?: unknown }>(req: Request): Promise<Ok<T> | Fail> {
  if (!isSameOrigin(req)) return { ok: false, response: forbidden() };
  const parent = await currentParent();
  if (!parent) return { ok: false, response: Response.json({ error: "Sign in first." }, { status: 401 }) };
  const parsed = await readJsonLimited<T>(req, 1024);
  if (!parsed.ok) return { ok: false, response: parsed.response };
  const childId = Number(parsed.value.childId);
  const child = Number.isInteger(childId) ? getChild(childId) : undefined;
  if (!child || child.parent_id !== parent.id) {
    return { ok: false, response: Response.json({ error: "Not found." }, { status: 404 }) };
  }
  return { ok: true, parent, child, body: parsed.value };
}
