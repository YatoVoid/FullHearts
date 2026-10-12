/** Only same-site paths under /server, so a crafted ?next= can't send someone off-site after sign-in. */
export function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/server/") || next.startsWith("//") || next.includes("\\")) return "/server/account/";
  return next;
}
