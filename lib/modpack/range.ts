/**
 * Version-range matching for mod dependencies. Mods declare required-dependency
 * ranges in two dialects we have to honor:
 *   - Maven (Forge/NeoForge mods.toml `versionRange`): "[0.5.1,6.0.0)", "[15,)"
 *   - Comparators (Fabric/Quilt `depends`): ">=0.5.1 <6.0.0", "*", "~1.2"
 * Modrinth's dependency API exposes NEITHER of these — only a bare project id —
 * so this is the piece that lets us pick a dependency version the dependent mod
 * will actually accept instead of blindly grabbing the newest.
 */

/** Numeric components of a clean version string, e.g. "6.0.8" -> [6,0,8]. */
export function parseVersion(s: string): number[] {
  const m = String(s).match(/\d+(?:\.\d+)*/);
  return m ? m[0].split(".").map(Number) : [];
}

/** Component-wise numeric compare; shorter is zero-padded. */
function cmp(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

function matchInterval(v: number[], p: string): boolean {
  const open = p[0];
  const close = p[p.length - 1];
  const inner = p.slice(1, -1);
  if (!inner.includes(",")) return cmp(v, parseVersion(inner)) === 0; // exact "[1.0]"
  const [loS, hiS] = inner.split(",").map((s) => s.trim());
  if (loS) {
    const c = cmp(v, parseVersion(loS));
    if (open === "[" ? c < 0 : c <= 0) return false;
  }
  if (hiS) {
    const c = cmp(v, parseVersion(hiS));
    if (close === "]" ? c > 0 : c >= 0) return false;
  }
  return true;
}

function matchComparator(v: number[], tok: string): boolean {
  const m = tok.match(/^(>=|<=|>|<|=|\^|~)?\s*v?(.+)$/);
  if (!m) return true;
  const op = m[1] || "=";
  const target = parseVersion(m[2]);
  if (target.length === 0) return true;
  // Trailing wildcard (1.2.x / 1.2.*) => prefix match on provided components.
  if (/[x*]/i.test(m[2])) return cmp(v.slice(0, target.length), target) === 0;
  const c = cmp(v, target);
  switch (op) {
    case ">=": return c >= 0;
    case ">": return c > 0;
    case "<=": return c <= 0;
    case "<": return c < 0;
    case "^": return c >= 0 && v[0] === target[0]; // caret: same major, >=
    case "~": return c >= 0 && v[0] === target[0] && (v[1] ?? 0) === (target[1] ?? 0); // tilde: same minor, >=
    default: return c === 0;
  }
}

/**
 * Does `version` satisfy `range`? Empty / "*" / "any" is unconstrained (true).
 * Unparseable versions return true (lenient) — we never block on a string we
 * can't read, since the alternative is dropping a mod that might be fine.
 */
export function satisfies(version: string, range: string): boolean {
  const r = (range ?? "").trim();
  if (!r || r === "*" || r.toLowerCase() === "any") return true;
  const v = parseVersion(version);
  if (v.length === 0) return true;
  // Maven: one or more intervals OR'd together, e.g. "[1.0,2.0),[3.0,)".
  if (r.startsWith("[") || r.startsWith("(")) {
    return r
      .split(/(?<=[\])])\s*,\s*(?=[[(])/)
      .some((p) => matchInterval(v, p.trim()));
  }
  // Comparators: "||"-separated OR groups; within a group, space/&&-separated AND.
  return r.split("||").some((g) =>
    g.trim().split(/\s+|&&/).filter(Boolean).every((tok) => matchComparator(v, tok.trim()))
  );
}
