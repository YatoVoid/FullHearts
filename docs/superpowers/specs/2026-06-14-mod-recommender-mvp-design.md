# Full Hearts — Mod Recommender MVP — Design Spec

**Date:** 2026-06-14
**Status:** Approved (design) — pending spec review
**Slice:** MVP / "Core journey + collections" (first of several build cycles)

---

## 1. Purpose & success criteria

Help a Minecraft player who has never installed a mod discover a personalized,
compatible set of mods through a short guided quiz — with no account, no jargon,
and a clear reason for every recommendation.

This first build satisfies success criteria **1–4, 6, 7, 8** and **partially 5**
(required dependencies are *shown*, read from live API data; automatic
*resolution* of prerequisites is a later slice).

A user can:

1. Visit the site with no account.
2. Take a guided quiz about their play style.
3. Receive a ranked, curated mod list that fits their answers.
4. Read a plain-English reason for each recommendation.
5. See each mod's required dependencies (shown, not auto-resolved).
6. Save / rename / duplicate / edit / delete collections in the browser.
7. Open install links to Modrinth / CurseForge.
8. Export (JSON + text) and share (URL-encoded) a collection.

### Out of scope for this slice (own later cycles)

- Automatic dependency **resolution** (auto-adding prereqs, cross-set conflict detection).
- Large-scale catalog curation beyond a solid seed set.
- CurseForge-specific polish (works behind the optional-key fallback, but Modrinth is primary).
- Short-link sharing service (URL-encoded sharing only).
- Vector/ML recommendation.

---

## 2. Architectural decisions (with trade-offs)

These were chosen collaboratively; rationale recorded here and in `DECISIONS.md`.

### 2.1 Data & hosting — serverless backend
Browser → Next.js serverless API routes → CurseForge + Modrinth, with caching.
Live data and real dependency graphs; needs a CurseForge key + hosting.
**Rejected:** pure-static curated-only (loses live freshness/full catalog);
Modrinth-only client-side (smaller catalog).

### 2.2 Stack — Next.js (App Router, TypeScript)
Frontend and the serverless proxy live in one project; API routes *are* the proxy
and cache layer. Most documented / launchable; easy to port the Full Hearts design.
**Rejected:** SvelteKit (smaller ecosystem), Astro islands (app-like quiz/collections
less natural).

### 2.3 CurseForge key — optional, graceful fallback
Modrinth works with **no key**; CurseForge activates automatically when
`CURSEFORGE_API_KEY` is present. Development is never blocked on key approval.

### 2.4 Candidate pool — curated-and-enriched (the pivotal decision)
The engine ranks over a **curated candidate pool** (our seed catalog, each mod
hand-tagged and reasoned). The serverless proxy **enriches** each candidate with
volatile live fields (current versions, loaders, dependencies, downloads, links).
**Rejected:** ranking the entire live catalog — it is noisy and cannot produce
honest, specific "reasons," which would break trust and criterion 4.

### 2.5 Recommendation engine — rule-based weighted tag scoring
Deterministic, explainable, unit-testable, no training data.
**Rejected:** ML / vector similarity — overkill, needs data/infra, hard to explain.
(Noted as a possible later enhancement once the catalog is large.)

### 2.6 Sharing — URL-encoded payload
The collection is encoded into a URL hash; no backend state, stays accountless.
**Rejected (for now):** short-link service — needs backend storage.

---

## 3. Architecture & components

```
app/
  page.tsx                 Landing — ported Full Hearts identity
  quiz/page.tsx            Guided questionnaire (one question per screen)
  results/page.tsx         Ranked recommendations with reasons
  collections/page.tsx     Saved loadouts (CRUD)
  api/mods/route.ts        Serverless: normalize Modrinth (+CF if keyed), cache
lib/
  sources/
    types.ts               ModSource interface; unified Mod / Dependency types
    modrinth.ts            Modrinth adapter (no key)
    curseforge.ts          CurseForge adapter (used only when key present)
    index.ts               source selection + merge (graceful fallback)
  recommend/
    profile.ts             quiz answers → weighted preference profile
    score.ts               scoring + hard filters (pure functions)
    reason.ts              profile + mod → plain-English reason
    index.ts               recommend(answers, candidates) → ranked results
  curation/
    tags.ts                tag vocabulary (the taxonomy)
    questions.ts           quiz question + answer→tag mapping
    catalog.ts             curated seed mods (existing 54 → tagged/reasoned)
  storage/
    collections.ts         localStorage CRUD + schema/versioning
    user.ts                returning-user cookie / resume-last
    share.ts               encode/decode collection ↔ URL
components/                design-system pieces (cards, XP bar, buttons, quiz UI)
data/                      static seed data if separated from curation
```

### Unit responsibilities (each independently testable)

- **sources/**: turn raw API JSON into the unified `Mod` shape; merge sources;
  degrade gracefully when no CurseForge key. Knows nothing about the quiz.
- **recommend/**: pure functions over `(profile, candidates)`. No I/O, no React.
- **curation/**: human-authored data only — tags, questions, seed catalog.
- **storage/**: localStorage/cookie persistence + share encoding. No engine logic.
- **app/api/mods**: the only place that talks to the network; caches responses.

---

## 4. Data model

```ts
type Loader = 'fabric' | 'forge' | 'neoforge' | 'quilt';

type Tag =
  | 'performance' | 'visual' | 'interface'      // tech quality-of-life
  | 'building' | 'exploration' | 'automation'   // play styles
  | 'tech' | 'magic' | 'combat' | 'rpg' | 'coop'
  | 'low-grind' | 'low-end';                     // preference modifiers

interface Mod {
  id: string;                 // stable internal id (slug)
  name: string;
  summary: string;
  curatedTags: Partial<Record<Tag, number>>;  // affinity 0..1 (curation)
  reasonTemplate: string;                       // curation; drives "why"
  // --- enriched live from API (may be null before fetch) ---
  loaders: Loader[];
  gameVersions: string[];
  dependencies: Dependency[];
  optionalComplements: string[];   // mod ids
  links: { modrinth?: string; curseforge?: string };
  downloads?: number;
}

interface Dependency { id: string; name: string; required: boolean; }
```

`curatedTags` and `reasonTemplate` come from `curation/catalog.ts`. Everything
under "enriched live" is filled by the serverless proxy. A mod renders with
curated data even if the live fetch fails (graceful).

---

## 5. Quiz

- One question per screen; XP-bar progress; Back; full keyboard support; ~8–10 questions.
- Most questions feed a **weighted preference profile** (tag → weight).
- A short "basics" step captures **hard filters**: MC version, loader, desired mod
  count, performance/hardware.
- One optional fun question ("favorite games outside Minecraft") seeds extra tags.

```
Profile = { weights: Partial<Record<Tag, number>>,
            loader: Loader, gameVersion: string,
            maxMods: number, lowEnd: boolean }
```

Answer→tag mappings live in `curation/questions.ts` so the quiz is data-driven and
easy to tune without touching engine code.

---

## 6. Recommendation engine

```
score(mod, profile) =
    Σ_tag  profile.weights[tag] × (mod.curatedTags[tag] ?? 0)
  + ε × normalizedPopularity(mod)              // tiebreak only

hard filters (applied after scoring):
  - drop mods that don't support profile.loader AND profile.gameVersion
  - if profile.lowEnd: subtract penalty from mods tagged heavy / not 'performance'

result = top N by score (N = profile.maxMods),
         plus any required dependencies of chosen mods (flagged as prerequisites,
         may exceed N — they are shown, not auto-added in this slice)

reason(mod, profile) = render(reasonTemplate, topContributingTags, matchedFilters)
```

Deterministic and pure → covered by unit tests with fixture profiles/catalogs.

---

## 7. Results

Reuses the rarity-card design. Per card: name · loader & version badges ·
description · **generated reason** · **required dependencies (auto-listed)** ·
optional complements · install links (Modrinth/CurseForge) · **+ Add to collection**.
Page header shows a plain-English profile summary, e.g.
*"Your loadout: builder · explorer · low-grind · Fabric 1.21."*

---

## 8. Collections, export, share

- `localStorage` store, schema-versioned:
  `Collection { id, name, modIds[], createdAt, updatedAt }`.
- Returning-user cookie; offer to resume the last results/collection.
- CRUD: save · rename · duplicate · edit · remove individual mod · delete.
- **Export:** JSON download + copyable plain-text list.
- **Share:** collection encoded into a URL hash (`share.ts`); opening it
  reconstructs the collection with zero backend.

---

## 9. Error handling & resilience

- Serverless proxy: cache + retry; on upstream failure, serve last-good cache or
  curated-only data so the UI never hard-fails.
- No CurseForge key → Modrinth only, silently (a small "data sources" note in footer).
- localStorage unavailable (private mode) → in-memory fallback + a gentle banner.
- Every recommendation degrades to curated fields if live enrichment fails.

---

## 10. Testing

- **recommend/**: Vitest unit tests — scoring, hard filters, reason text, dep inclusion.
- **sources/**: adapter tests against captured fixture JSON (Modrinth + CurseForge).
- **storage/**: CRUD + share encode/decode round-trip tests.
- Smoke test of the quiz→results→collection happy path.

---

## 11. Project docs maintained

`PROJECT_PROGRESS.md`, `PROJECT_ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`,
updated after each milestone. This spec is the source for the implementation plan.

---

## 12. Build order (for the implementation plan)

1. Scaffold Next.js + TS + Vitest; port Full Hearts design tokens/landing.
2. `sources/` interface + Modrinth adapter + `api/mods` proxy with cache (CF behind key).
3. `curation/` taxonomy + seed catalog (migrate existing 54 mods, add tags/reasons).
4. `recommend/` engine (pure) + unit tests.
5. Quiz UI (data-driven from `curation/questions.ts`).
6. Results page (reasons, deps, install links, add-to-collection).
7. `storage/` collections CRUD + export + URL share + returning-user resume.
8. Wire end-to-end; accessibility & mobile pass; smoke tests; docs update.
