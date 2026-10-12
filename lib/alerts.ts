import { enqueueEmail } from "@/lib/outbox";

export function adminAlertAddresses(): string[] {
  return (process.env.ADMIN_ALERT_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.app";
}

/**
 * Tells the admins a request is waiting. Deliberately carries no child names
 * or usernames: email is the least protected place this data could end up.
 */
export function alertNewRequest(firstChildId: number, childCount: number): void {
  const noun = childCount === 1 ? "child" : "children";
  for (const to of adminAlertAddresses()) {
    enqueueEmail(
      `signup-alert:${firstChildId}:${to}`,
      to,
      `EduCraft: new access request (${childCount} ${noun})`,
      `A family asked for EduCraft access for ${childCount} ${noun}.\n\nReview it at ${siteUrl()}/admin/\n`
    );
  }
}

export function alertAdmins(key: string, subject: string, text: string): void {
  for (const to of adminAlertAddresses()) enqueueEmail(`${key}:${to}`, to, subject, text);
}
