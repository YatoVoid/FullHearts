import { unzipSync } from "fflate";
import type { Loader } from "@/lib/sources/types";

/**
 * Reads a mod jar's manifest to get the TRUE dependency picture Modrinth's API
 * leaves out: the full list of required mods AND their version ranges. Authors
 * routinely ship jars with dependencies that aren't registered on Modrinth
 * (so our closure never sees them) or with version ranges Modrinth simply can't
 * express. The jar manifest is the ground truth the launcher itself reads.
 *
 *   Fabric:  fabric.mod.json  -> `id`, `provides`, `depends`
 *   Quilt:   quilt.mod.json   -> quilt_loader.{id,provides,depends}
 *   Forge:   META-INF/(neoforge.)mods.toml -> [[mods]] + [[dependencies.*]]
 */

export interface ManifestInfo {
  /** Declared mod version (best-effort; "" if a build placeholder we can't resolve). */
  version: string;
  /** Mod ids this jar provides — used to map a dependency's modid to a project. */
  provides: string[];
  /** Mandatory dependencies, minus the platform (minecraft/loader/java). */
  requires: { id: string; range: string }[];
  /** The Minecraft version range the jar declares it supports (the ground truth
   *  Modrinth's game-version tags often disagree with). Empty/undefined = unstated. */
  mcRange?: string;
  /** The loader (forge/neoforge) version range the jar requires — catches jars
   *  that need a newer loader than the MC version actually ships (e.g. a "1.21.1"
   *  jar that needs Forge 53, which only exists on 1.21.3). */
  loaderRange?: string;
}

/** Pull a "minecraft" dependency range out of a Fabric/Quilt depends map. */
function mcFromDepends(depends: Record<string, unknown>): string | undefined {
  const r = depends.minecraft;
  if (Array.isArray(r)) return r.join(" || ");
  return typeof r === "string" ? r : undefined;
}

// Not mods — ignore as dependencies (they're the runtime, not something to ship).
const NON_MOD = new Set([
  "minecraft", "java", "forge", "neoforge",
  "fabricloader", "fabric_loader", "quilt_loader", "quiltloader", "mixinextras"
]);

const norm = (s: unknown) => String(s ?? "").toLowerCase().trim();

export function parseFabric(text: string): ManifestInfo | null {
  let j: Record<string, unknown>;
  try { j = JSON.parse(text); } catch { return null; }
  const provides = [j.id, ...(Array.isArray(j.provides) ? j.provides : [])]
    .filter(Boolean).map(norm);
  const requires: { id: string; range: string }[] = [];
  const depends = (j.depends && typeof j.depends === "object" ? j.depends : {}) as Record<string, unknown>;
  for (const [id, range] of Object.entries(depends)) {
    if (NON_MOD.has(norm(id))) continue;
    requires.push({ id: norm(id), range: Array.isArray(range) ? range.join(" || ") : String(range ?? "*") });
  }
  return { version: String(j.version ?? ""), provides, requires, mcRange: mcFromDepends(depends) };
}

export function parseQuilt(text: string): ManifestInfo | null {
  let j: { quilt_loader?: Record<string, unknown> };
  try { j = JSON.parse(text); } catch { return null; }
  const ql = j.quilt_loader;
  if (!ql) return null;
  const provides = [ql.id, ...(Array.isArray(ql.provides) ? ql.provides.map((p) => (typeof p === "object" && p ? (p as { id?: string }).id : p)) : [])]
    .filter(Boolean).map(norm);
  const requires: { id: string; range: string }[] = [];
  let mcRange: string | undefined;
  for (const d of Array.isArray(ql.depends) ? ql.depends : []) {
    const dep = typeof d === "string" ? { id: d, versions: "*" } : (d as { id?: string; versions?: unknown; optional?: boolean });
    if (dep.optional) continue;
    if (!dep.id) continue;
    const range = typeof dep.versions === "string" ? dep.versions : "*";
    if (norm(dep.id) === "minecraft") { mcRange = range; continue; }
    if (NON_MOD.has(norm(dep.id))) continue;
    requires.push({ id: norm(dep.id), range });
  }
  return { version: String(ql.version ?? ""), provides, requires, mcRange };
}

/**
 * Minimal mods.toml reader — just the fields we need, not a full TOML parser.
 * Forge often sets a mod's `version` to the "${file.jarVersion}" placeholder,
 * resolved at runtime from MANIFEST.MF's Implementation-Version, so we fall back
 * to that when present.
 */
export function parseForge(text: string, manifestMf = ""): ManifestInfo {
  const provides: string[] = [];
  let version = "";
  const requires: { id: string; range: string }[] = [];
  let section: "mods" | "deps" | "other" = "other";
  let cur: { modId?: string; mandatory?: boolean; versionRange?: string } | null = null;
  let mcRange: string | undefined;
  let loaderRange: string | undefined;

  const flush = () => {
    if (section === "deps" && cur?.modId) {
      const id = norm(cur.modId);
      if (id === "minecraft" && cur.versionRange) mcRange = cur.versionRange;
      else if ((id === "forge" || id === "neoforge") && cur.versionRange) loaderRange = cur.versionRange;
      else if (cur.mandatory !== false && !NON_MOD.has(id)) {
        requires.push({ id, range: cur.versionRange ?? "*" });
      }
    }
    cur = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[[mods]]")) { flush(); section = "mods"; continue; }
    if (/^\[\[dependencies\./.test(line)) { flush(); section = "deps"; cur = {}; continue; }
    if (line.startsWith("[")) { flush(); section = "other"; continue; }
    const kv = line.match(/^([\w-]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim().replace(/,$/, "").replace(/^["']|["']$/g, "");
    if (section === "mods") {
      if (key === "modId") provides.push(norm(val));
      else if (key === "version") version = val;
    } else if (section === "deps" && cur) {
      if (key === "modId") cur.modId = val;
      else if (key === "mandatory") cur.mandatory = val === "true";
      else if (key === "versionRange") cur.versionRange = val;
    }
  }
  flush();
  if ((!version || version.includes("${")) && manifestMf) {
    const m = manifestMf.match(/Implementation-Version:\s*(.+)/i);
    if (m) version = m[1].trim();
  }
  return { version, provides, requires, mcRange, loaderRange };
}

/**
 * Inflate the manifest entries from a jar and parse them for the loader we're
 * building. Multi-loader "universal" jars carry fabric.mod.json AND mods.toml
 * (and neoforge.mods.toml) at once, and a mod's dependencies can differ per
 * loader — so we MUST read the manifest matching the target loader, not just the
 * first one found. (Reading a Forge mod's fabric.mod.json missed its Forge-only
 * `chipped` dependency, which then never got installed.)
 */
export function extractManifestDeps(bytes: Uint8Array, loader?: Loader): ManifestInfo | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => /(^|\/)(fabric\.mod\.json|quilt\.mod\.json)$|META-INF\/(neoforge\.)?mods\.toml$|META-INF\/MANIFEST\.MF$/i.test(f.name)
    });
  } catch {
    return null;
  }
  const dec = new TextDecoder();
  const text = (re: RegExp) => {
    const k = Object.keys(files).find((n) => re.test(n));
    return k ? dec.decode(files[k]) : "";
  };
  const fabric = () => { const t = text(/(^|\/)fabric\.mod\.json$/i); return t ? parseFabric(t) : null; };
  const quilt = () => { const t = text(/(^|\/)quilt\.mod\.json$/i); return t ? parseQuilt(t) : null; };
  const forgeToml = () => { const t = text(/META-INF\/mods\.toml$/i); return t ? parseForge(t, text(/META-INF\/MANIFEST\.MF$/i)) : null; };
  const neoToml = () => { const t = text(/META-INF\/neoforge\.mods\.toml$/i); return t ? parseForge(t, text(/META-INF\/MANIFEST\.MF$/i)) : null; };

  // Read the manifest for the target loader first; fall back to the others so a
  // single-manifest jar still parses.
  const order =
    loader === "forge" ? [forgeToml, neoToml, quilt, fabric]
    : loader === "neoforge" ? [neoToml, forgeToml, quilt, fabric]
    : loader === "quilt" ? [quilt, fabric, forgeToml, neoToml]
    : loader === "fabric" ? [fabric, quilt, forgeToml, neoToml]
    : [fabric, quilt, forgeToml, neoToml]; // unspecified: legacy order
  for (const read of order) {
    const r = read();
    if (r) return r;
  }
  return null;
}
