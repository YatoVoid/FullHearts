import { deflateSync, inflateSync, strToU8, strFromU8 } from "fflate";
import type { Loader } from "@/lib/sources/types";

/** The shareable subset of a collection (no ids/timestamps — those are local).
 *  Carries the pinned loader + Minecraft version so a shared pack imports as a
 *  fully-built loadout (version-locked on Explore), not an unpinned mod list. */
export interface SharePayload {
  name: string;
  modIds: string[];
  loader?: Loader;
  version?: string;
}

const KNOWN_LOADERS = ["forge", "neoforge", "fabric", "quilt"];

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// Legacy decode path: the old format was base64url of the raw JSON (no compression).
function fromBase64Url(s: string): string {
  return strFromU8(base64UrlToBytes(s));
}

// Marker for the compressed format. "~" is a URL-unreserved char that never
// appears in base64url output, so it unambiguously tags new links and can't
// collide with a legacy one (those always begin "eyJ", the base64 of '{"').
const DEFLATE_MARK = "~";

/** Encode a collection payload into a URL-safe string for the share hash.
 *  DEFLATE-compressed: mod-slug lists share long prefixes ("lets-do-", "create-")
 *  so this shrinks the link a lot while staying fully lossless and offline. */
export function encodeCollection(payload: SharePayload): string {
  // undefined loader/version are dropped by JSON.stringify, so old-style links
  // (mod list only) stay just as small.
  const json = JSON.stringify({ n: payload.name, m: payload.modIds, l: payload.loader, v: payload.version });
  return DEFLATE_MARK + bytesToBase64Url(deflateSync(strToU8(json)));
}

// Bounds so a hostile share link can't bloat storage or the UI. (Names/ids are
// rendered as text — React escapes them — so this is DoS hardening, not XSS.)
const MAX_NAME = 80;
const MAX_MODS = 250;
const MAX_ID = 128;

/** Decode a share string back into a payload, or null if it's malformed.
 *  Accepts both the new compressed links and any legacy uncompressed ones. */
export function decodeCollection(encoded: string): SharePayload | null {
  try {
    const json = encoded.startsWith(DEFLATE_MARK)
      ? strFromU8(inflateSync(base64UrlToBytes(encoded.slice(DEFLATE_MARK.length))))
      : fromBase64Url(encoded);
    const obj = JSON.parse(json);
    if (!obj || typeof obj.n !== "string" || !Array.isArray(obj.m)) return null;
    const modIds = obj.m
      .filter((x: unknown): x is string => typeof x === "string" && x.length <= MAX_ID)
      .slice(0, MAX_MODS);
    const loader = typeof obj.l === "string" && KNOWN_LOADERS.includes(obj.l) ? (obj.l as Loader) : undefined;
    const version = typeof obj.v === "string" && /^\d{1,2}(\.\d{1,2}){1,2}$/.test(obj.v) ? obj.v : undefined;
    return { name: obj.n.slice(0, MAX_NAME), modIds, loader, version };
  } catch {
    return null;
  }
}
