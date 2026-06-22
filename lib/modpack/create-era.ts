/**
 * Create's Fabric port ships TWO incompatible major lines on the same Minecraft
 * version (legacy 0.5.1 and the 6.0.x backport). Addons built for 0.5 declare
 * open Create ranges ("*", ">=0.5.1") that NUMERICALLY accept 6.0.8 but crash on
 * it (moved/removed classes like BlockStressDefaults, ponder/Selection) — so
 * plain version-range satisfies() can't see the break. The signal that actually
 * separates the two lines is the MAJOR version: a build/range on the 6.x line vs
 * the 0.5 line. We pick the line that keeps the most selected addons and drop the
 * rest. ponytail: major-bucket heuristic; only 0.5 and 6.x exist on the affected
 * versions, so "modern = major >= 6" is enough. Revisit if a Create 7 lands.
 */

/** Leading "X.Y" major of a version string ("6.0.8.1+build" -> 6, "0.5.1-j" -> 0). */
export function verMajor(v: string): number {
  const m = (v || "").match(/(\d+)\.\d+/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Major a dependency range was built against. "*"/empty = the 0.5 era (it predates
 *  Create 6); otherwise the first "X.Y" token's major (">=6.0.7" -> 6). */
export function rangeMajor(range: string): number {
  if (!range || range.trim() === "*") return 0;
  const m = range.match(/(\d+)\.\d+/);
  return m ? parseInt(m[1], 10) : 0;
}

export const isModernVersion = (v: string): boolean => verMajor(v) >= 6;
export const isModernRange = (range: string): boolean => rangeMajor(range) >= 6;

/** Which Create line to standardize on: the one MORE selected addons target.
 *  Ties go to the modern (6.x) line — it's where the ecosystem is heading. */
export function preferModern(addonRanges: string[]): boolean {
  let modern = 0;
  let legacy = 0;
  for (const r of addonRanges) isModernRange(r) ? modern++ : legacy++;
  return modern >= legacy;
}
