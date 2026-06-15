# Engine, Quiz & Results Implementation Plan (Plan 2)

**Goal:** Turn the data layer into a working journey: a pure rule-based recommendation engine, a data-driven quiz, and a results page that explains every pick and shows required dependencies.

**Spec:** `docs/superpowers/specs/2026-06-14-mod-recommender-mvp-design.md` §5–§7 (build order 4–6). Collections/export/share = Plan 3.

**Tech:** Next.js 15 App Router, React 19, TypeScript, Vitest. `lib/recommend/` is pure (no I/O, no React).

## File structure
```
lib/curation/questions.ts        quiz questions + answer→tag/filter mapping (+ test)
lib/recommend/profile.ts         answers → Profile (weights + hard filters) (+ test)
lib/recommend/score.ts           score() + hard filters (+ test)
lib/recommend/reason.ts          (profile, mod) → plain-English reason (+ test)
lib/recommend/index.ts           recommend(answers, mods) → ranked + deps (+ test)
app/quiz/page.tsx                one-question-per-screen quiz (client)
app/results/page.tsx             ranked cards w/ reasons, deps, install links (client)
```

## Tasks
- **Task 1 — Questions** (`lib/curation/questions.ts`): typed `QUESTIONS` array. Each question: id, prompt, kind (`single`/`multi`/`basics`), options mapping answers→`{tag: weight}` or hard-filter fields (loader, gameVersion, maxMods, lowEnd). Test: every option tag is a valid `isTag`; ids unique; covers all play-style tags.
- **Task 2 — Profile** (`lib/recommend/profile.ts`): `buildProfile(answers): Profile` summing tag weights and reading basics into `{weights, loader, gameVersion, maxMods, lowEnd}`. Test: weights accumulate; basics captured; defaults sane.
- **Task 3 — Score** (`lib/recommend/score.ts`): `score(mod, profile)` = Σ weight×affinity + ε·popularity tiebreak. `passesHardFilters(mod, profile)` (loader+version; empty live arrays pass = graceful). `lowEnd` penalty. Test with fixture mods/profiles.
- **Task 4 — Reason** (`lib/recommend/reason.ts`): `reason(mod, profile)` renders reasonTemplate + top contributing tags into one sentence. Test: mentions template, deterministic.
- **Task 5 — Recommend** (`lib/recommend/index.ts`): `recommend(answers, mods): { results, profileSummary }`. Builds profile, filters, scores, sorts, takes top N=maxMods, appends required deps (flagged prerequisite, deduped). Each result carries its reason. Test: ordering, N cap, deps appended.
- **Task 6 — Quiz UI** (`app/quiz/page.tsx`): client component, one question per screen, XP bar, Back, keyboard. On finish, stash answers (sessionStorage) and route to `/results`.
- **Task 7 — Results UI** (`app/results/page.tsx`): client; reads answers, fetches `/api/mods`, runs `recommend`, renders rarity cards (name, loader/version badges, summary, generated reason, required deps, install links). Header shows profile summary. Graceful empty/loading/degraded states.
- **Task 8 — Wire + verify + docs**: `npm test` + `npm run build` green; smoke the quiz→results flow; update `PROJECT_PROGRESS.md`.

## Notes
- Engine stays pure & fully unit-tested; UI does the I/O (fetch `/api/mods`).
- Dependencies are *shown*, not auto-resolved (per spec §1, §7). Names may equal ids until Plan 2.5/resolution.
- Reuse existing `globals.css` rarity-card classes (`tip`, `r-rare`, etc.).
