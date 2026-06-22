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

/** True if a "X.Y[...]" version token is on Create's MODERN (6.0.x) line rather
 *  than legacy (0.5.x). Create's Fabric port numbers the modern line two ways that
 *  both show up in the wild: Modrinth tags it "6.0.8" while many addons declare the
 *  requirement as "0.6.8" — so BOTH `6.x` and `0.6+` mean modern; `0.5.x` and below
 *  (and open "*") mean legacy. */
function modernToken(token: string | undefined): boolean {
  if (!token) return false;
  const m = token.match(/(\d+)\.(\d+)/);
  if (!m) return false;
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  return major >= 6 || (major === 0 && minor >= 6);
}

/** Is this resolved Create build on the modern line? ("6.0.8.1+build" -> true). */
export const isModernVersion = (v: string): boolean => modernToken(v);

/** Is this addon's declared Create range targeting the modern line? Open ("*"/empty)
 *  predates Create 6, so it's legacy; otherwise the range's lower-bound token decides
 *  (">=0.6.8" and ">=6.0.7" -> modern, ">=0.5.1" -> legacy). */
export const isModernRange = (range: string): boolean =>
  range && range.trim() !== "*" ? modernToken(range) : false;

/** Which Create line to standardize on: the one MORE selected addons target.
 *  Ties go to the modern (6.x) line — it's where the ecosystem is heading. */
export function preferModern(addonRanges: string[]): boolean {
  let modern = 0;
  let legacy = 0;
  for (const r of addonRanges) isModernRange(r) ? modern++ : legacy++;
  return modern >= legacy;
}
