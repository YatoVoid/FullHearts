# Project Progress

A running log of milestones. Newest at top.

## 2026-06-16 — Plan 4 complete: Live dependency display (post-MVP)
- Modrinth adapter now fetches latest-version dependencies and resolves their project ids to display names (3 batched calls, fully graceful).
- `/api/mods` surfaces real `dependencies`; results "Requires:" line populates (e.g. "Fabric API"). Verified live: 10/20 seed mods show resolved required deps.
- Tests: 42 passing (added pickLatestVersionId + resolveDependencyNames). Build green.

## 2026-06-16 — Plan 3 complete: Collections, Export/Share & Polish (MVP slice done)
- Storage layer (`lib/storage/`): safe localStorage w/ in-memory fallback, collections CRUD, URL-encoded share, JSON/text export, returning-user state — unit-tested.
- Results: "+ Add" per card + "Save all to collection"; Collections nav link on landing.
- Collections page (`app/collections/page.tsx`): list, rename, duplicate, delete, remove mod, export JSON download, copy text, copy/import share link via URL hash.
- Tests: 40 passing (added storage suites). Build green; all routes (/, /quiz, /results, /collections, /api/mods) smoke-tested 200.
- **MVP "Core journey + collections" slice complete**: quiz → ranked reasons → collections → export/share.

Next: post-MVP — wire per-version dependency display, catalog scale-up, richer CurseForge, deploy.

## 2026-06-15 — Plan 2 complete: Engine, Quiz & Results
- Pure rule-based recommendation engine (`lib/recommend/`: profile, score, reason, index) — fully unit-tested.
- Data-driven quiz (`lib/curation/questions.ts` + `app/quiz/page.tsx`): one question per screen, XP progress, Back, keyboard.
- Results page (`app/results/page.tsx`): fetches `/api/mods`, ranks via engine, shows reasons + required deps + install links, with loading/empty/error/degraded states.
- Tests: 28 passing (added questions + engine suites). Build green; quiz→results journey smoke-tested (200s, live data).

Next: Plan 3 — Collections, Export/Share & Polish.

## 2026-06-15 — Plan 1 complete: Foundation & Data Layer
- Next.js + TS + Vitest scaffolded; Full Hearts landing ported and reframed to the quiz.
- Curation taxonomy (`lib/curation/tags.ts`) + seed catalog (`lib/curation/catalog.ts`, ~20 mods).
- Pluggable source layer: Modrinth adapter + CurseForge stub, merged with graceful fallback.
- Serverless `/api/mods` proxy returns live-enriched, cached catalog.
- Tests: tags, catalog integrity, Modrinth normalization, source merge — 14 passing.

Next: Plan 2 — Engine, Quiz & Results.

## 2026-06-14 — Project kickoff
- Brainstormed & approved MVP design (`docs/superpowers/specs/2026-06-14-mod-recommender-mvp-design.md`).
- Decisions: serverless data, Next.js, optional CurseForge key, curated candidate pool, rule-based engine.
- Plan 1 (Foundation & Data Layer) written.

## Status
- [x] Plan 1 — Foundation & Data Layer
- [x] Plan 2 — Engine, Quiz & Results
- [x] Plan 3 — Collections, Export/Share & Polish
