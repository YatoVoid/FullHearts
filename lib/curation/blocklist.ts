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

/**
 * Broken LIBRARY projects pulled in as dependencies, keyed by Modrinth PROJECT
 * ID (the dependency closure resolves deps by id, not slug). When one of these is
 * required on a blocked loader/version, the .mrpack builder drops it — and any mod
 * that requires it — instead of shipping a pack that crashes at startup.
 */
const BLOCKED_DEPS: Record<string, BlockRule> = {
  // Factory API 2.2.8 — its bundled MixinExtras jar-in-jar makes Forge's
  // JarInJarDependencyLocator throw an NPE on 1.21.1, crashing at launch. Pulled
  // in by Better Furnaces Reforged and others.
  nkTZHOLD: { loaders: ["forge", "neoforge"], versions: ["1.21.1"] }
};

function matches(rule: BlockRule | undefined, loader: Loader, version?: string): boolean {
  if (!rule || !rule.loaders.includes(loader)) return false;
  if (rule.versions && version && !rule.versions.includes(version)) return false;
  return true;
}

/** True if this mod is known to crash on the given loader + (optional) version. */
export function isBlocked(mod: Mod, loader: Loader, version?: string): boolean {
  const slug = (mod.modrinthSlug ?? mod.id).toLowerCase();
  return matches(BLOCKED[slug], loader, version);
}

/** True if a dependency PROJECT (by Modrinth id) is known-broken here. */
export function isBlockedDep(projectId: string, loader: Loader, version?: string): boolean {
  return matches(BLOCKED_DEPS[projectId], loader, version);
}
