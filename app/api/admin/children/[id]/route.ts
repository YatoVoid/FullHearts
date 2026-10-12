import { requireAdminRequest } from "@/lib/auth";
import { getChild, assignRealm, updateNotes, setReviewStatus, deleteChild, setMinecraftProfile, setSuspended } from "@/lib/children";
import { cancelWithRefund, subscriptionForChild } from "@/lib/billing";
import { isLive } from "@/lib/entitlement";
import { queueApprovalEmail } from "@/lib/approval";
import { lookupProfile } from "@/lib/minecraft";
import { readJsonLimited } from "@/lib/http";
import { clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

type Action =
  | "approve"
  | "reject"
  | "reopen"
  | "delete"
  | "verify"
  | "suspend"
  | "restore"
  | "cancel_subscription"
  | "resend_approval";
const ACTIONS: Action[] = ["approve", "reject", "reopen", "delete", "verify", "suspend", "restore", "cancel_subscription", "resend_approval"];

type Body = {
  action?: string;
  realmId?: number;
  notes?: string;
  // Delete and cancel_subscription: the child's Minecraft username, typed by the admin.
  confirm?: string;
};

// One endpoint for every per-child change the admin dashboard makes. Field
// edits (realm, notes) and one action can come in the same request.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await requireAdminRequest(req))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const childId = Number((await params).id);
  const child = Number.isInteger(childId) ? getChild(childId) : undefined;
  if (!child) return Response.json({ error: "Not found." }, { status: 404 });

  const parsed = await readJsonLimited<Body>(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const ip = clientIp(req);
  const log = (event: string, detail?: Record<string, unknown>) =>
    audit(event, { actor: "admin", childId, parentId: child.parent_id, ip, detail });

  if (body.action !== undefined && !ACTIONS.includes(body.action as Action)) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (child.access_source === "external" && body.action && body.action !== "delete") {
    return Response.json({ error: "This player was added to the server by hand. Manage them on the server." }, { status: 409 });
  }

  const confirmed = typeof body.confirm === "string" && body.confirm.trim().toLowerCase() === child.mc_username.toLowerCase();

  if (body.action === "delete") {
    if (!confirmed) return Response.json({ error: "Type the child's Minecraft username to confirm." }, { status: 400 });
    if (isLive(subscriptionForChild(childId))) {
      return Response.json({ error: "Cancel the subscription before deleting, so the family stops being charged." }, { status: 409 });
    }
    const { deletedParent } = deleteChild(childId);
    log("child_deleted", { deletedParent });
    return Response.json({ ok: true, deleted: true });
  }

  if (body.realmId !== undefined) {
    if (typeof body.realmId !== "number") return Response.json({ error: "Bad request." }, { status: 400 });
    const result = assignRealm(childId, body.realmId);
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
    log("realm_assigned", { realmId: body.realmId });
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string" || body.notes.length > 2000) {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }
    updateNotes(childId, body.notes);
  }

  if (body.action === "cancel_subscription") {
    if (!confirmed) return Response.json({ error: "Type the child's Minecraft username to confirm." }, { status: 400 });
    try {
      const result = await cancelWithRefund(childId, "admin");
      if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
    } catch (err) {
      return Response.json({ error: `Stripe error: ${(err as Error).message}` }, { status: 502 });
    }
  }

  if (body.action === "suspend") {
    setSuspended(childId, true);
    log("child_suspended");
  } else if (body.action === "restore") {
    setSuspended(childId, false);
    log("child_restored");
  }

  if (body.action === "verify") {
    const result = await lookupProfile(child.mc_username);
    if (result.status === "not_found" || result.status === "invalid") {
      return Response.json({ error: `Mojang has no Java account named "${child.mc_username}".` }, { status: 409 });
    }
    if (result.status === "unavailable") {
      return Response.json({ error: "Couldn't reach Mojang. Try again in a minute." }, { status: 503 });
    }
    setMinecraftProfile(childId, result.name, result.uuid);
    log("username_verified");
  }

  if (body.action === "approve") {
    const current = getChild(childId)!;
    if (!current.realm_id) return Response.json({ error: "Assign a realm before approving." }, { status: 409 });
    if (!current.mc_uuid) {
      return Response.json({ error: "Verify the Minecraft username with Mojang before approving." }, { status: 409 });
    }
    const approved = setReviewStatus(childId, "approved")!;
    const emailed = queueApprovalEmail(childId, `approval:${childId}:${approved.reviewed_at}`);
    log("child_approved", { realmId: current.realm_id, emailed });
    if (!emailed) {
      return Response.json({ ok: true, child: getChild(childId), warning: "Approved, but there's no parent email to send the join steps to." });
    }
  } else if (body.action === "resend_approval") {
    const current = getChild(childId)!;
    if (current.review_status !== "approved") return Response.json({ error: "Only approved requests have an approval email." }, { status: 409 });
    if (!queueApprovalEmail(childId, `approval:${childId}:resend:${Date.now()}`)) {
      return Response.json({ error: "There's no parent email to send it to." }, { status: 409 });
    }
    log("approval_resent");
  } else if (body.action === "reject") {
    setReviewStatus(childId, "rejected");
    log("child_rejected");
  } else if (body.action === "reopen") {
    setReviewStatus(childId, "pending");
    log("child_reopened");
  }

  return Response.json({ ok: true, child: getChild(childId) });
}
