import type { Loader, Mod } from "@/lib/sources/types";

/**
 * Known-bad mods that ship a build for a loader/version but CRASH on launch
 * there. The recommender can't see runtime bugs (Modrinth only tells us a build
 * *exists*, not that it works), so a hand-maintained denylist is the escape hatch
 * for ones we've actually hit.
 *
 * Keyed by Modrinth slug. `loaders` = the loaders it's broken on; optional
 * `versions` narrows it to specific Minecraft versions (omit = all versions on
 * those loaders). tr7zw's GUI mods bundle TRender/TRansition, whose Forge/NeoForge
 * SNAPSHOT ports throw on config-screen registration. Runelic 21.1.x + Bookshelf
 * crash during item registration (DataComponents NPE) on early 1.21 / 1.21.1
 * builds — they're the latest available, with no upstream fix.
 *
 * ponytail: manual denylist, whack-a-mole BY DESIGN. There is no metadata signal
 * for a Java NullPointerException inside a mod's own code; the systemic guards
 * (fail-closed loader/version filters, manifest dep + loader-version checks) do
 * the heavy lifting, and this only catches mods that crash despite being assembled
 * correctly. Add slugs as found.
 */
interface BlockRule {
  loaders: Loader[];
  /** If set, only these Minecraft versions are blocked (others are fine). */
  versions?: string[];
}

const BLOCKED: Record<string, BlockRule> = {
  "3dskinlayers": { loaders: ["forge", "neoforge"] },
  "first-person-model": { loaders: ["forge", "neoforge"] },
  "trender": { loaders: ["forge", "neoforge"] },
  "transition": { loaders: ["forge", "neoforge"] },
  "runelic": { loaders: ["forge", "neoforge"], versions: ["1.21.1", "1.21"] }
};

/** True if this mod is known to crash on the given loader + (optional) version. */
export function isBlocked(mod: Mod, loader: Loader, version?: string): boolean {
  const slug = (mod.modrinthSlug ?? mod.id).toLowerCase();
  const rule = BLOCKED[slug];
  if (!rule || !rule.loaders.includes(loader)) return false;
  if (rule.versions && version && !rule.versions.includes(version)) return false;
  return true;
}
