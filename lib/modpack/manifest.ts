import { unzipSync } from "fflate";

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
  return { version: String(j.version ?? ""), provides, requires };
}

export function parseQuilt(text: string): ManifestInfo | null {
  let j: { quilt_loader?: Record<string, unknown> };
  try { j = JSON.parse(text); } catch { return null; }
  const ql = j.quilt_loader;
  if (!ql) return null;
  const provides = [ql.id, ...(Array.isArray(ql.provides) ? ql.provides.map((p) => (typeof p === "object" && p ? (p as { id?: string }).id : p)) : [])]
    .filter(Boolean).map(norm);
  const requires: { id: string; range: string }[] = [];
  for (const d of Array.isArray(ql.depends) ? ql.depends : []) {
    const dep = typeof d === "string" ? { id: d, versions: "*" } : (d as { id?: string; versions?: unknown; optional?: boolean });
    if (dep.optional) continue;
    if (!dep.id || NON_MOD.has(norm(dep.id))) continue;
    requires.push({ id: norm(dep.id), range: typeof dep.versions === "string" ? dep.versions : "*" });
  }
  return { version: String(ql.version ?? ""), provides, requires };
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

  const flush = () => {
    if (section === "deps" && cur?.modId && cur.mandatory !== false && !NON_MOD.has(norm(cur.modId))) {
      requires.push({ id: norm(cur.modId), range: cur.versionRange ?? "*" });
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
  return { version, provides, requires };
}

/** Inflate just the manifest entries from a jar's bytes and parse them. */
export function extractManifestDeps(bytes: Uint8Array): ManifestInfo | null {
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
  const fab = text(/(^|\/)fabric\.mod\.json$/i);
  if (fab) return parseFabric(fab);
  const quilt = text(/(^|\/)quilt\.mod\.json$/i);
  if (quilt) { const q = parseQuilt(quilt); if (q) return q; }
  const toml = text(/META-INF\/(neoforge\.)?mods\.toml$/i);
  if (toml) return parseForge(toml, text(/META-INF\/MANIFEST\.MF$/i));
  return null;
}
