import type { Mod } from "@/lib/sources/types";

// The bar for a live Modrinth result to show under the default "high-quality
// only" filter. Tuned so genuinely popular mods (e.g. Ledger ~266k) pass while
// tiny/abandoned ones are hidden until the user turns the filter off.
export const QUALITY_MIN_DOWNLOADS = 100_000;

export function isHighQuality(mod: Mod): boolean {
  return (mod.downloads ?? 0) >= QUALITY_MIN_DOWNLOADS;
}
