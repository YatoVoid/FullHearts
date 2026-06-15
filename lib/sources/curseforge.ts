import type { CuratedMod, Enrichment, ModSource } from "@/lib/sources/types";

/**
 * CurseForge adapter. Only meaningful when CURSEFORGE_API_KEY is set.
 * Full normalization lands in a later plan; for now it returns no enrichment
 * (Modrinth covers the seed catalog), but the source is wired so enabling the
 * key flips it on without touching callers.
 */
export function curseforgeSource(apiKey: string): ModSource {
  return {
    name: "curseforge",
    async enrich(_mods: CuratedMod[]): Promise<Map<string, Enrichment>> {
      // Placeholder: real CurseForge fetch added in a later plan.
      // apiKey is captured here and used then.
      void apiKey;
      return new Map();
    }
  };
}
