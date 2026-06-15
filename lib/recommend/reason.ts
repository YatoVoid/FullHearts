import type { Mod } from "@/lib/sources/types";
import type { Profile } from "@/lib/recommend/profile";

/** Tags the user weighted, ranked by how much this mod serves them. */
function topContributingTags(mod: Mod, profile: Profile, limit = 2): string[] {
  return Object.entries(mod.curatedTags)
    .map(([tag, affinity]) => ({ tag, contribution: (profile.weights[tag as keyof typeof profile.weights] ?? 0) * (affinity ?? 0) }))
    .filter((c) => c.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit)
    .map((c) => c.tag);
}

/**
 * Plain-English "why this mod" line. Always leads with the curated reason
 * template; appends the strongest matching preferences when present.
 */
export function reason(mod: Mod, profile: Profile): string {
  const base = `We picked ${mod.name} because ${mod.reasonTemplate}`;
  const tags = topContributingTags(mod, profile);
  if (tags.length === 0) return `${base}.`;
  return `${base} — a strong match for your ${tags.join(" + ")} picks.`;
}
