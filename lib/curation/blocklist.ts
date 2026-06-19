import type { Loader, Mod } from "@/lib/sources/types";

/**
 * Known-bad mods that ship a build for a loader but crash on launch there. The
 * recommender can't see runtime bugs (Modrinth only tells us a build *exists*),
 * so a hand-maintained denylist is the escape hatch for ones we've hit.
 *
 * Keyed by Modrinth slug -> loaders it's broken on. tr7zw's GUI mods bundle
 * TRender/TRansition, whose Forge/NeoForge SNAPSHOT ports throw on config-screen
 * registration (AIOOBE in ConfigScreenManager) — fine on Fabric/Quilt.
 *
 * ponytail: manual denylist, whack-a-mole by design. The systemic guards
 * (fail-closed loader filter + Forge release-only resolution) do the heavy
 * lifting; this only catches mods that slip past those. Add slugs as found.
 */
const BLOCKED: Record<string, Loader[]> = {
  "3dskinlayers": ["forge", "neoforge"],
  "first-person-model": ["forge", "neoforge"],
  "trender": ["forge", "neoforge"],
  "transition": ["forge", "neoforge"]
};

/** True if this mod is known to crash on the given loader. */
export function isBlocked(mod: Mod, loader: Loader): boolean {
  const slug = (mod.modrinthSlug ?? mod.id).toLowerCase();
  return BLOCKED[slug]?.includes(loader) ?? false;
}
