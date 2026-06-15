# Project Progress

A running log of milestones. Newest at top.

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
- [ ] Plan 2 — Engine, Quiz & Results
- [ ] Plan 3 — Collections, Export/Share & Polish
