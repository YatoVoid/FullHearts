# Loader/Version-Aware Quiz Recommendations + Forge-Primary Expansion

Date: 2026-06-19
Status: Approved (design)

## Problem

The quiz asks loader, version, and loadout size as independent static choices.
Users pick Forge + a fixed "~60 mods", but most catalog mods are Fabric-first, so
the pack silently collapses to ~17 deliverable mods. The quiz gives no signal about
which version actually has mods for the chosen loader, and the size options ignore
real availability.

Goals:
1. Make **Forge the primary** loader (default + most prominent).
2. During the quiz, show a **recommended version per loader**, driven by how many
   mods are actually available for that loader+version.
3. Make the **loadout size recommendation depend on availability** for the picked
   loader+version, instead of fixed ~10/25/40/60.
4. **Expand the library** with Forge-strong mods so Forge coverage is real.

Non-goals: per-mod compatibility flags at collection time; any change to the
results/pack-build pipeline (existing guardrails already handle delivery).

## Approach

A small pure **coverage module** computes, for each (loader, version), how many
mods the recommender can deliver (same rule as `passesHardFilters`: the mod
declares support for that loader AND version). Both the version recommendation
(argmax version per loader) and the adaptive size recommendation read from it.

Data source is **hybrid**: live count preferred, snapshot fallback.
- On quiz mount, kick off `loadPool()` (already cached in sessionStorage). When it
  resolves, compute live coverage. Until then, use a committed snapshot.
- If the snapshot is missing too, fall back to static defaults (current fixed size
  options + a hand-authored recommended-version-per-loader map).
- Counts are advisory: they never block advancing through the quiz.

## Components

### `lib/catalog/coverage.ts` (pure, no I/O)
- `type Coverage = Partial<Record<Loader, Record<string, number>>>` — version string → count.
- `computeCoverage(mods: Mod[], loaders: Loader[], versions: string[]): Coverage`
  Counts mods where `mod.loaders.includes(L) && mod.gameVersions.includes(V)`.
- `recommendedVersion(coverage, loader, versions): string` — version with the
  highest count for that loader; ties broken by the `versions` order given.
- `recommendedSize(count: number): number` — maps available count to a sensible
  default loadout (e.g. ~40% of available, clamped to [8, 60], snapped to a tier).
- `sizeOptionsFor(count: number): { id: string; label: string; maxMods: number; recommended: boolean }[]`
  — the tiered size options (essentials/solid/big/huge) filtered so none exceeds
  `count`, with the `recommendedSize` tier flagged. Always returns at least one option.

### `lib/catalog/coverage.snapshot.json` + `scripts/gen-coverage.ts`
- Script builds the pool (`enrichCatalog(CATALOG)` + `searchMods()`), runs
  `computeCoverage` over the known loaders/versions, and writes the JSON.
- Re-run manually when the catalog changes (`npm run gen:coverage`). Snapshot is
  committed so the quiz has instant, offline defaults.

### `app/quiz/page.tsx`
- On mount, start `loadPool()` (best-effort, non-blocking). Hold `coverage` state,
  initialized from the imported snapshot, replaced with live coverage when the pool
  resolves.
- **Loader step:** Forge first and labeled "most popular".
- **Version step:** under each version option, show `coverage[loader][version]`
  ("84 mods"); badge the `recommendedVersion` for the chosen loader and show a help
  line ("Recommended for Forge: 1.20.1 — biggest mod selection").
- **Size step:** render `sizeOptionsFor(coverage[loader][version])` instead of the
  static size options; highlight the recommended one. Selecting a size sets
  `maxMods` exactly as today (answers shape unchanged).

### `lib/curation/questions.ts` + `lib/recommend/profile.ts`
- Loader options reordered: forge, neoforge, fabric, quilt. Forge label notes it's
  the most popular; help copy updated.
- `PROFILE_DEFAULTS.loader = "forge"`.
- The static `version` and `size` options remain as the no-coverage fallback; the
  quiz overlays live recommendations on top of them.

### `lib/curation/catalog.ts`
- Add ~30–40 Forge-strong / multi-loader mods (Modrinth-verified slugs) with
  curated tags and reason templates, skewed to strong 1.20.1 + 1.21.1 Forge support.
- **User-requested seed list** (each slug verified on Modrinth during implementation;
  CurseForge-only mods cannot be delivered by the Modrinth pipeline and will be
  reported back, not silently dropped):
  JEI, FTB Quests, FTB Chunks, Create, CC: Tweaked, Advanced Peripherals,
  Farmer's Delight, Let's Do: Bakery, Let's Do: Vinery, Waystones, Comforts,
  Patchouli, Xaero's Minimap, Xaero's World Map, Lightman's Currency, Bountiful,
  LearnPlay, Simple Playtime Tracker, ChatGuard, Ledger, WatchDog Anti-Cheat.
- Constraint: the recommender/exporter is **Modrinth-only**. A CurseForge-exclusive
  mod is out of scope for this plan; adding CurseForge as a source is a separate
  future feature.

## Data Flow

```
quiz mount
  → import snapshot  (instant default coverage)
  → loadPool() async → computeCoverage(pool) → live coverage (replaces snapshot)
loader step  → pick L (default forge)
version step → show coverage[L][V] per option; recommend argmax_V coverage[L][V]
size step    → sizeOptionsFor(coverage[L][chosenV]); recommend a tier
finish       → answers (unchanged shape) → /results
```

## Error Handling
- `loadPool()` fails or is slow → snapshot coverage stands.
- Snapshot import fails → static question options (current behavior) + hand map.
- A (loader, version) absent from coverage → treat count as 0; size step still
  offers at least the "essentials" tier; version step shows no badge.
- All counts are advisory; the quiz is always completable.

## Testing
- `coverage.test.ts`: `computeCoverage` counts correctly; `recommendedVersion`
  picks argmax and respects tie order; `recommendedSize` clamps to [8,60] and snaps
  to a tier; `sizeOptionsFor` never exceeds availability and always returns ≥1
  option with exactly one recommended.
- Snapshot smoke test: `coverage.snapshot.json` parses and every recommended
  version for every loader exists in the version list.
- Quiz UI kept thin — recommendation logic lives in the pure helpers and is tested
  there, not through the component.

## Deliberately Skipped (YAGNI)
- Collection-time per-mod compatibility flags (separate feature).
- Any results/pack-build change (guardrails already cover delivery).
- Auto-running the coverage script in CI (manual regen is enough for now).
