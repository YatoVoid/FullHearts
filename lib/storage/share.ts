import { deflateSync, inflateSync, strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import type { Loader } from "@/lib/sources/types";

/** The shareable subset of a collection (no ids/timestamps — those are local).
 *  Carries the pinned loader + Minecraft version so a shared pack imports as a
 *  fully-built loadout (version-locked on Explore), not an unpinned mod list. */
export interface SharePayload {
  name: string;
  modIds: string[];
  loader?: Loader;
  version?: string;
  /** Raw overrides/ files (path -> bytes, e.g. "overrides/config/foo.toml" -
   *  see ImportedPack.overrides in lib/modpack/import.ts), embedded directly
   *  in the link since this site has no backend to store them server-side.
   *  Only present if they fit under MAX_OVERRIDES_ZIPPED_BYTES - see
   *  overridesFitShareLink, which the caller should check before including
   *  them, so the UI can say honestly when something's too big for a link
   *  (a full resource/shader pack, say) rather than silently drop it. */
  overrides?: Record<string, Uint8Array>;
}

// Cap on the ZIPPED overrides payload before it's base64'd into the link. The
// "#share=" fragment is never sent to a server (fragments aren't part of an
// HTTP request), so there's no server-side length limit to worry about - the
// real constraint is the browser's own URL handling (tens of KB is fine
// everywhere modern) and not producing something absurd to paste into chat
// apps. 24KB covers a real guide book (the motivating case here zips to
// ~10.5KB) with room to spare; a resource/shader pack won't fit, and
// shouldn't try to - that's what the .mrpack file download is for.
export const MAX_OVERRIDES_ZIPPED_BYTES = 24_000;

/** Whether these overrides, zipped, fit under the share-link size budget.
 *  Callers should check this BEFORE passing overrides to encodeCollection,
 *  so the UI can tell the user honestly when something's too big for a link
 *  instead of the link silently not carrying them. Empty/absent overrides
 *  always fit. */
export function overridesFitShareLink(overrides: Record<string, Uint8Array> | undefined): boolean {
  if (!overrides || Object.keys(overrides).length === 0) return true;
  return zipSync(overrides).byteLength <= MAX_OVERRIDES_ZIPPED_BYTES;
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
 *  so this shrinks the link a lot while staying fully lossless and offline.
 *  Overrides (if given) are zipped into one blob and base64'd as a third field -
 *  encodeCollection doesn't itself enforce the size cap (see
 *  MAX_OVERRIDES_ZIPPED_BYTES / overridesFitShareLink); the caller decides
 *  whether to include them at all, since that's also where the "too big for a
 *  link" messaging lives. */
export function encodeCollection(payload: SharePayload): string {
  // undefined loader/version/overrides are dropped by JSON.stringify, so
  // old-style links (mod list only) stay just as small.
  const obj: { n: string; m: string[]; l?: Loader; v?: string; o?: string } = {
    n: payload.name,
    m: payload.modIds,
    l: payload.loader,
    v: payload.version
  };
  if (payload.overrides && Object.keys(payload.overrides).length > 0) {
    obj.o = bytesToBase64Url(zipSync(payload.overrides));
  }
  const json = JSON.stringify(obj);
  return DEFLATE_MARK + bytesToBase64Url(deflateSync(strToU8(json)));
}

// Bounds so a hostile share link can't bloat storage or the UI. (Names/ids are
// rendered as text — React escapes them — so this is DoS hardening, not XSS.)
const MAX_NAME = 80;
const MAX_MODS = 250;
const MAX_ID = 128;

// Decode-side guard against a hostile/corrupted "o" field: a share link is
// just base64'd JSON a user pastes in, so nothing about it is trusted. Cap
// the base64 text length before even attempting to decode+unzip it, so a
// malicious link can't trigger an oversized allocation/decompression on
// whoever opens it. ~4/3 expansion from base64, plus slack.
const MAX_OVERRIDES_BASE64_CHARS = Math.ceil((MAX_OVERRIDES_ZIPPED_BYTES * 4) / 3) + 1000;

/** Decode a share string back into a payload, or null if it's malformed.
 *  Accepts both the new compressed links and any legacy uncompressed ones.
 *  A malformed/oversized/tampered "o" (overrides) field degrades to no
 *  overrides rather than failing the whole decode - the mod list still
 *  matters even if the overrides link segment got mangled somewhere. */
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

    let overrides: Record<string, Uint8Array> | undefined;
    if (typeof obj.o === "string" && obj.o.length <= MAX_OVERRIDES_BASE64_CHARS) {
      try {
        const unzipped = unzipSync(base64UrlToBytes(obj.o));
        if (Object.keys(unzipped).length > 0) overrides = unzipped;
      } catch {
        // corrupted/tampered override blob - degrade to no overrides, keep the rest
      }
    }

    return overrides
      ? { name: obj.n.slice(0, MAX_NAME), modIds, loader, version, overrides }
      : { name: obj.n.slice(0, MAX_NAME), modIds, loader, version };
  } catch {
    return null;
  }
}
