# Live Dependency Display Implementation Plan (Plan 4, post-MVP)

**Goal:** Populate each mod's required dependencies from live Modrinth data so the results "Requires:" line shows real, named prerequisites (spec §1 criterion 5, §7). Dependencies are *shown*, not auto-resolved.

**Context:** `normalizeDependencies` exists since Plan 1 but is unwired; `/api/mods` returns `dependencies: []`. This closes that gap.

## Approach (3 batched network calls, no per-mod fan-out)
1. `/v2/projects?ids=[slugs]` — metadata (already done) + each project's `versions[]`.
2. Pick the latest version id per project; batch `/v2/versions?ids=[versionIds]`.
3. `normalizeDependencies(version)` → required/optional dep project ids.
4. Collect unique dep project ids; batch `/v2/projects?ids=[depIds]` → id→title map.
5. Resolve names and attach to each mod's `Enrichment.dependencies`.

All graceful: any failed step leaves `dependencies: []` rather than breaking enrichment.

## Tasks
- **Task 1 — Adapter helpers** (`lib/sources/modrinth.ts`): add `versions` to `MrProject`; add `pickLatestVersionId(project)` and `resolveDependencyNames(deps, nameById)` pure functions. Extend `enrich()` to do the 3-call version→deps→names flow. Tests (fixtures): pickLatestVersionId; normalizeDependencies + resolveDependencyNames name resolution.
- **Task 2 — Verify wiring**: `/api/mods` already passes `Enrichment.dependencies` through `mergeEnrichment`; confirm a curated mod with deps surfaces them. Build + smoke `/api/mods` shows a non-empty `dependencies` for at least one mod.
- **Task 3 — Close**: `npm test` + `npm run build` green; update `PROJECT_PROGRESS.md`; merge.

## Notes
- Latest-version deps are a reasonable proxy; per-loader/version dep accuracy is a later refinement.
- Results UI already renders `required` deps by name — no UI change needed.
