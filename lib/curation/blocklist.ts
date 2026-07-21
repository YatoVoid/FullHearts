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
  "runelic": { loaders: ["forge", "neoforge"], versions: ["1.21.1", "1.21"] },
  // IceAndFire CE 1.1.1 (newest release on 1.21/1.21.1) requires Uranus but only
  // declares "[2,)" — and the ONE Uranus build it actually works with (2.4.0) is
  // indistinguishable from the broken ones (2.3.1 too old, 2.4.1 too new). No
  // metadata signal can resolve it, so excluding it beats shipping a guaranteed crash.
  "iceandfire-ce": { loaders: ["forge", "neoforge"], versions: ["1.21.1", "1.21"] },
  // Spelunkery 0.4.3 (its newest 1.21.1 build) crashes with the current Moonlight
  // Lib (ArrayIndexOOB) — it needs ~Moonlight 3.0.14, but Moonlight is shared by
  // many mods that want it recent, and Spelunkery's loose range gives no way to
  // pick a version that satisfies everyone. Nothing newer to update to.
  "spelunkery": { loaders: ["forge", "neoforge"], versions: ["1.21.1", "1.21"] },
  // Shoulder Surfing Reloaded's legacy FORGE 1.21.x port crashes (mixin/code
  // mismatch) — its primary, tested build for 1.21.x is NeoForge. Block the Forge
  // port only; it's fine on NeoForge and on older Forge.
  "shoulder-surfing-reloaded": { loaders: ["forge"], versions: ["1.21.1", "1.21"] },
  // Let's Do Addon: Photographers has ONE abandoned build (1.0.0, Sep 2024) built
  // against Meadow ~1.3.19. Its manifest range nominally allows newer Meadow, but
  // current Meadow (1.3.25+) changed internals and the addon crashes against it.
  // Downgrading the shared Meadow to match would break every other mod that wants
  // it current, and there's no newer Photographers to update to. Block the addon.
  "lets-do-photographers": { loaders: ["fabric", "quilt"] },
  // Modrinth project slug "ponder" (id 5A34Stj8) is "Ponder for KubeJS" - a
  // completely different addon from Create's own bundled Ponder, which has no
  // standalone Modrinth listing at all (see manifest.ts's NON_MOD set, which
  // stops Create's declared "ponder" dependency from resolving to this project
  // in the first place). This entry is the second line of defense: it also
  // catches the mod if it ends up EXPLICITLY in a mod list some other way (a
  // manual pick, or importing/re-uploading a .mrpack that already has it baked
  // in) - unlike the manifest.ts fix, isBlocked applies no matter how the mod
  // got selected. Its mixins target Ponder internals that don't match what
  // Create actually bundles, crashing at launch (InvalidAccessorException on
  // PonderIndex.plugins) - not version-specific, blocked on every loader.
  "ponder": { loaders: ["forge", "neoforge", "fabric", "quilt"] }
};

/**
 * Mods that BUILD and RUN fine but shouldn't be auto-picked into a "import one
 * file and launch" pack: modpack-author tooling that needs hand configuration to
 * do anything, destructive/niche utilities a new player wouldn't expect. They're
 * still fully browsable in Explore — this only keeps them out of the recommender.
 *
 * item-obliterator is tagged optimization+utility+management on Modrinth, so it
 * lands strong on BOTH performance and qol and (3.2M downloads) wins a slot in
 * almost every generated pack — yet it does nothing until you configure item
 * removals by hand. Keyed by Modrinth slug.
 *
 * ponytail: hand-maintained, one entry so far; add slugs as they surface.
 */
const AUTO_EXCLUDED = new Set<string>(["item-obliterator"]);

/** True if this mod is fit to browse but should never be auto-recommended. */
export function isAutoExcluded(mod: Mod): boolean {
  return AUTO_EXCLUDED.has((mod.modrinthSlug ?? mod.id).toLowerCase());
}

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
  nkTZHOLD: { loaders: ["forge", "neoforge"], versions: ["1.21.1"] },
  // "Ponder for KubeJS", project id 5A34Stj8, Modrinth slug "ponder" - see the
  // matching BLOCKED entry above for the full story. Nothing SHOULD ever create
  // a required-dependency edge onto this project now that manifest.ts stops
  // Create's own "ponder" declaration from resolving here, but this is the
  // third line of defense in case some other path ever does.
  "5A34Stj8": { loaders: ["forge", "neoforge", "fabric", "quilt"] }
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
