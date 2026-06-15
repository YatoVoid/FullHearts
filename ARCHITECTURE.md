# Architecture

Living document. See `docs/superpowers/specs/2026-06-14-mod-recommender-mvp-design.md` for full rationale.

## Layers
- `app/` — routes (landing, quiz, results, collections) + `app/api/mods` serverless proxy.
- `lib/sources/` — adapters that normalize Modrinth/CurseForge JSON into one `Mod` shape; merge with graceful fallback when no CurseForge key.
- `lib/curation/` — human-authored taxonomy: tags, seed catalog (tags + reason templates).
- `lib/recommend/` — pure scoring engine (added in Plan 2).
- `lib/storage/` — localStorage collections + URL share (added in Plan 3).

## Data flow
quiz answers → preference profile → engine ranks curated candidate pool → serverless proxy enriches with live fields → results with reasons + dependencies → saved collections.

## Key rules
- The proxy (`app/api/mods`) is the ONLY module that performs network I/O.
- `lib/recommend` is pure (no I/O, no React) and fully unit-tested.
- Mods always render from curated fields even if live enrichment fails.
