# Discovery & Scale Implementation Plan (Plan 5)

**Spec:** `docs/superpowers/specs/2026-06-16-discovery-and-scale-design.md`. TDD on pure modules; commit per task.

## Tasks
- **T1 — Tags** (`lib/curation/tags.ts`): add `structures, biome, mobs, food, qol`; add `TAG_LABELS: Record<Tag,string>` (display names). Update test for new tags + label coverage.
- **T2 — Category map** (`lib/catalog/categoryMap.ts`): `tagsFromCategories(categories): Partial<Record<Tag,number>>` (maps Modrinth categories, excludes loaders/library/cursed); `reasonForTag(tag): string`; `dominantTag(tags): Tag|undefined`. Test mapping + reason.
- **T3 — searchMods** (`lib/sources/modrinth.ts`): `normalizeSearchHit(hit): Mod` (split loaders from categories, auto-tag, synth reason) + `searchMods(): Promise<Mod[]>` (parallel facet searches, dedupe by slug, graceful []). Fixture `__fixtures__/modrinth-search.json`. Test normalization.
- **T4 — Pool builder** (`lib/catalog/pool.ts`): `mergePool(dynamic: Mod[], curated: Mod[]): Mod[]` (curated overrides by modrinthSlug, curated id canonical, union, dedupe) — pure, tested. `buildPool(): Promise<Mod[]>` = searchMods() + enrichCatalog(CATALOG) then mergePool; graceful to curated-only.
- **T5 — Wire route** (`app/api/mods/route.ts`): serve `buildPool()` (revalidate 3600, degraded fallback). Build + smoke pool size > 20.
- **T6 — Quiz** (`lib/curation/questions.ts`): size options 10/25/40/60; add questions — "world content" (structures/biome/mobs), "food & farming" (food), "quality of life" (qol). Update questions test.
- **T7 — Lucky** (`lib/recommend/lucky.ts`): `THEMES` (tag combos), `luckyAnswers(): QuizAnswers`, `LUCKY_THEME_LABELS`. Test: each theme → engine returns results over a fixture pool.
- **T8 — Explore** (`app/explore/page.tsx`): fetch `/api/mods`, group by tag, render a section per tag ≥ threshold (sorted by count) using TAG_LABELS + rarity cards. Add nav link.
- **T9 — Lucky UI**: results `?lucky=1` mode (synthesize via luckyAnswers); "I'm Feeling Lucky" buttons on landing + explore.
- **T10 — Close**: `npm test` + `npm run build` green; smoke all routes; update `PROJECT_PROGRESS.md`; merge.

## Notes
- Keep `recommend()` pure & unchanged — it just sees more mods. `maxMods` up to 60.
- Reason for dynamic mods comes from `reasonForTag(dominantTag)`.
- Watch route latency: parallelize search calls; cache via Next revalidate.
