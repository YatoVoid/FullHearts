# Collections, Export/Share & Polish Implementation Plan (Plan 3)

**Goal:** Let users save their loadout into named collections (browser-only), edit them, export (JSON + text), and share via a URL — closing the MVP journey. Plus a light accessibility/mobile pass.

**Spec:** `docs/superpowers/specs/2026-06-14-mod-recommender-mvp-design.md` §8 (build order 7–8). Engine/quiz/results = Plan 2 (done).

**Tech:** Next.js 15 App Router, React 19, TypeScript, Vitest. Storage modules are framework-free and tested in jsdom; UI does the wiring.

## File structure
```
lib/storage/safe.ts            safe localStorage access + in-memory fallback
lib/storage/collections.ts     Collection type + CRUD (+ test)
lib/storage/share.ts           encode/decode collection <-> URL hash (+ test)
lib/storage/export.ts          toJSON / toText pure formatters (+ test)
lib/storage/user.ts            returning-user flag + last-collection id
app/results/page.tsx           add "+ Add to collection" per card (modify)
app/collections/page.tsx       CRUD UI + export + share + import-from-hash
```

## Tasks
- **Task 1 — Safe storage** (`lib/storage/safe.ts`): `getStore()` returns localStorage or an in-memory Map shim when unavailable (private mode). All storage modules go through it.
- **Task 2 — Collections CRUD** (`lib/storage/collections.ts`): `Collection { id, name, modIds[], createdAt, updatedAt }`, schema key `fullhearts:collections:v1`. Functions: list, get, create, rename, duplicate, delete, addMod (dedupe), removeMod. Test in jsdom: create/list/rename/duplicate/delete + add/remove dedupe round-trips.
- **Task 3 — Share** (`lib/storage/share.ts`): `encodeCollection({name,modIds})` → base64url JSON; `decodeCollection(str)` → payload or null on garbage. Test: round-trip + bad input.
- **Task 4 — Export** (`lib/storage/export.ts`): `toJSON(collection)` pretty JSON; `toText(collection, nameById)` human list. Test formatting.
- **Task 5 — User** (`lib/storage/user.ts`): `markVisited`/`isReturning`, `setLastCollectionId`/`getLastCollectionId`. (Light; no test needed beyond compile.)
- **Task 6 — Results "Add to collection"**: each card gets a button that adds the mod to a default "My loadout" collection (created on demand), label flips to "Added ✓"; link to /collections.
- **Task 7 — Collections page** (`app/collections/page.tsx`): list collections; rename, duplicate, delete; remove individual mod; export JSON download + copy text; copy share URL; on load, import `#share=` hash into a new collection. Empty state links to /quiz.
- **Task 8 — Polish + close**: nav link to Collections; a11y (labels, focus, reduced-motion already covered); mobile check; `npm test` + `npm run build` green; smoke; update `PROJECT_PROGRESS.md`; mark MVP slice complete.

## Notes
- Browser-only, accountless (spec §2.6). Share = URL-encoded payload, no backend.
- Storage degrades to in-memory with a gentle banner if localStorage is blocked (spec §9).
- Mod display names on the collections page come from `/api/mods` (ids persisted, names resolved at view time).
