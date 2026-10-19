import { getDb } from "@/lib/db";
import { createChild, usernameTaken } from "@/lib/children";
import { updateParentContact, type Parent } from "@/lib/parents";
import { recordConsents } from "@/lib/consents";
import { lookupProfile, type ProfileLookup } from "@/lib/minecraft";
import { validateSubmission, type RegistrationSubmission } from "@/lib/registerValidation";
import { alertNewRequest } from "@/lib/alerts";
import { registrationPaused } from "@/lib/educraft";

export type RegistrationResult =
  | { ok: true; childIds: number[]; unverified: string[] }
  | { ok: false; status: number; error: string };

type Lookup = (name: string) => Promise<ProfileLookup>;

// The parent always comes from the session, so nobody can attach kids to another family.
export async function registerChildren(
  parent: Parent,
  input: RegistrationSubmission,
  ctx: { ip: string; userAgent: string | null },
  lookup: Lookup = lookupProfile
): Promise<RegistrationResult> {
  if (registrationPaused()) return { ok: false, status: 503, error: "Registration isn't open yet." };
  const error = validateSubmission(input);
  if (error) return { ok: false, status: 400, error };

  // Mojang is the source of truth for the name. If Mojang can't answer, the
  // request is still saved, just unverified; an admin can't approve it until
  // the check passes.
  const checked: { nickname: string; age: number; name: string; uuid: string | null }[] = [];
  const unverified: string[] = [];
  for (const child of input.children) {
    const typed = child.childMcUsername!.trim();
    const result = await lookup(typed);
    if (result.status === "not_found" || result.status === "invalid") {
      return {
        ok: false,
        status: 400,
        error: `Mojang has no Minecraft Java account named "${typed}". Check the spelling, or make sure it's a Java Edition account.`
      };
    }
    const name = result.status === "found" ? result.name : typed;
    const uuid = result.status === "found" ? result.uuid : null;
    if (result.status === "unavailable") unverified.push(typed);
    if (usernameTaken(name, uuid)) {
      return { ok: false, status: 409, error: `"${name}" already has a request. Email us if that's a mistake.` };
    }
    checked.push({ nickname: child.childNickname!.trim(), age: child.childAge!, name, uuid });
  }

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  let childIds: number[];
  try {
    updateParentContact(parent.id, input.parent.parentName!.trim(), input.parent.parentPhone?.trim() || null);
    childIds = checked.map((c) => createChild(parent.id, { nickname: c.nickname, age: c.age, mcUsername: c.name, mcUuid: c.uuid }).id);
    recordConsents(parent.id, ["guardian", "billing", "terms"], { ip: ctx.ip, userAgent: ctx.userAgent, childIds });
    alertNewRequest(childIds[0], childIds.length);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { ok: true, childIds, unverified };
}
