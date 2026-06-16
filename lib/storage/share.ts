/** The shareable subset of a collection (no ids/timestamps — those are local). */
export interface SharePayload {
  name: string;
  modIds: string[];
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s); // UTF-8 safe (handles unicode)
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(s, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf-8");
}

/** Encode a collection payload into a URL-safe string for the share hash. */
export function encodeCollection(payload: SharePayload): string {
  return toBase64Url(JSON.stringify({ n: payload.name, m: payload.modIds }));
}

// Bounds so a hostile share link can't bloat storage or the UI. (Names/ids are
// rendered as text — React escapes them — so this is DoS hardening, not XSS.)
const MAX_NAME = 80;
const MAX_MODS = 250;
const MAX_ID = 128;

/** Decode a share string back into a payload, or null if it's malformed. */
export function decodeCollection(encoded: string): SharePayload | null {
  try {
    const obj = JSON.parse(fromBase64Url(encoded));
    if (!obj || typeof obj.n !== "string" || !Array.isArray(obj.m)) return null;
    const modIds = obj.m
      .filter((x: unknown): x is string => typeof x === "string" && x.length <= MAX_ID)
      .slice(0, MAX_MODS);
    return { name: obj.n.slice(0, MAX_NAME), modIds };
  } catch {
    return null;
  }
}
