# Full Hearts — Discovery & Scale — Design Spec

**Date:** 2026-06-16
**Status:** Approved
**Builds on:** MVP (Plans 1–4). Extends the data layer, quiz, and adds browse + lucky.

## 1. Purpose
The MVP felt limited: a 20-mod curated pool and a 12-mod cap. This expansion makes Full Hearts feel like a real, shippable discovery tool — a large, dynamically-sourced catalog; richer quiz; a browsable Explore page; and an "I'm Feeling Lucky" discovery button — without losing the "a reason for every pick" promise.

## 2. Decisions
- **D7 — Dynamic pool with curated overlay.** A pool builder fetches a large set of real mods from Modrinth `/v2/search` (cached ~1h, "refreshes once in a while"), auto-tagged from Modrinth categories. The curated 20 remain an overlay: on overlap (matched by `modrinthSlug`) the curated entry's hand-authored tags/reason/dependencies win and its internal id is canonical. Dynamic-only and curated-only mods both included. Rejected: hand-expanding to 60 (doesn't scale); fully dynamic with no curation (loses crafted reasons).
- **D8 — Auto-tagging via category map.** `lib/catalog/categoryMap.ts` maps Modrinth categories → our `Tag` weights, and synthesizes a friendly `reasonTemplate` from a mod's dominant tag. Keeps explainability for non-curated mods.
- **D9 — Graceful, cached, resilient.** If search fails, fall back to the curated pool (today's behavior). The proxy stays the only network module.
- **D10 — Lucky = coherent theme, not noise.** A random theme (1–3 related tags) is run through the real engine, guaranteeing sensible results.

## 3. New taxonomy
Add `structures`, `biome`, `mobs`, `food`, `qol` to the existing 13 (→ 18). Each gets a human display label for Explore section headers.

## 4. Components
```
lib/catalog/categoryMap.ts   Modrinth category -> Tag weights; reasonForTag(tag)
lib/catalog/pool.ts          buildPool(): dynamic search + curated overlay merge (server)
lib/sources/modrinth.ts      + searchMods(): /v2/search -> normalized Mod[]
lib/recommend/lucky.ts       THEMES + luckyAnswers(): random coherent QuizAnswers
lib/curation/tags.ts         + 5 tags + TAG_LABELS display map
lib/curation/questions.ts    cap 10/25/40/60 + world-content/food/qol questions
app/api/mods/route.ts        serve buildPool() (cached, graceful)
app/explore/page.tsx         dynamic tag sections over the pool
app/results/page.tsx         + ?lucky mode (synthesize answers via luckyAnswers)
app/page.tsx                 + "I'm Feeling Lucky" + Explore links
```

## 5. Data flow
`/v2/search` (broad popular + per-category facets, parallel, cached) → normalize hits (loaders extracted from `categories`, game versions from `versions`) → auto-tag via categoryMap → merge with `enrichCatalog(CATALOG)` overlay → one `Mod[]` pool. Quiz/results/explore/lucky all consume it via `/api/mods`.

## 6. Modrinth search notes
Search hits put loaders *inside* `categories` (intersect with known loaders to split). `versions` = game versions. `library`/`cursed` categories excluded. No version ids in search hits → dynamic-pool dependencies stay empty (curated overlay keeps live deps); full-pool deps are a later refinement.

## 7. Explore
Group the pool by tag; render a section for every tag with ≥ a small threshold of mods, ordered by mod count. Section titles from `TAG_LABELS`. Each card reuses the rarity-card UI. Dynamic: new tags/categories produce new sections automatically.

## 8. Lucky
`THEMES` is a small list of tag combos that make sense together. `luckyAnswers()` picks one at random and returns a `QuizAnswers` selecting the matching quiz options + sensible basics. Results page in `?lucky=1` mode calls it instead of reading sessionStorage. Header reflects the theme.

## 9. Testing
- `categoryMap`: category→tags mapping, loader split, reasonForTag.
- `searchMods`: fixture-based normalization (loaders, versions, tags, links).
- `pool`: overlay precedence + dedupe (pure merge, fixture inputs).
- `questions`: still valid (new tags valid, caps present).
- `lucky`: every theme yields answers that produce non-empty engine results over a fixture pool.

## 10. Out of scope (later)
Full-pool live dependencies; CurseForge enrichment of the dynamic pool; persistent server cache beyond Next revalidate; ML ranking.
