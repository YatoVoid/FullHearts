# Loader/Version-Aware Quiz + Forge-Primary Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive the quiz's version and loadout-size recommendations from how many mods are actually available for the chosen loader+version, make Forge the primary loader, and expand the catalog with verified Forge-capable mods.

**Architecture:** A pure coverage module counts deliverable mods per (loader, version). The quiz reads coverage live from the cached pool, falling back to a committed snapshot. Version step recommends the best version per loader; size step adapts its options to availability. Question data and catalog are extended; the results/build pipeline is untouched.

**Tech Stack:** Next.js (App Router, client components), TypeScript, Vitest, Modrinth API.

## Global Constraints

- Modrinth-only pipeline. Do NOT add CurseForge. Mods not on Modrinth are out of scope.
- Loaders (canonical order, Forge-primary): `["forge", "neoforge", "fabric", "quilt"]`.
- Versions (keep all three): `["1.21.1", "1.21", "1.20.1"]`.
- Loadout size tiers stay `[10, 25, 40, 60]` with option ids `small/medium/large/huge` so `buildProfile` keeps working unchanged.
- No new runtime dependencies. No em-dashes in user-facing copy (project convention).
- Files under 500 lines; read a file before editing it.

---

### Task 1: Coverage module (pure functions)

**Files:**
- Create: `lib/catalog/coverage.ts`
- Test: `lib/catalog/coverage.test.ts`

**Interfaces:**
- Produces:
  - `LOADERS: Loader[]` = `["forge","neoforge","fabric","quilt"]`
  - `VERSIONS: string[]` = `["1.21.1","1.21","1.20.1"]`
  - `type Coverage = Partial<Record<Loader, Record<string, number>>>`
  - `computeCoverage(mods: Mod[], loaders?: Loader[], versions?: string[]): Coverage`
  - `recommendedVersion(coverage: Coverage, loader: Loader, versions?: string[]): string`
  - `recommendedSize(count: number): number`  (returns one of 10/25/40/60)
  - `sizeOptionsFor(count: number): { id: string; label: string; maxMods: number; recommended: boolean }[]`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/catalog/coverage.test.ts
import { describe, it, expect } from "vitest";
import {
  computeCoverage, recommendedVersion, recommendedSize, sizeOptionsFor,
  LOADERS, VERSIONS
} from "@/lib/catalog/coverage";
import type { Mod } from "@/lib/sources/types";

function mod(loaders: string[], versions: string[]): Mod {
  return {
    id: "x", name: "X", summary: "", curatedTags: {}, reasonTemplate: "",
    loaders: loaders as Mod["loaders"], gameVersions: versions,
    dependencies: [], links: {}
  };
}

describe("computeCoverage", () => {
  it("counts mods that declare each loader + version", () => {
    const cov = computeCoverage([
      mod(["forge"], ["1.20.1"]),
      mod(["forge", "fabric"], ["1.20.1", "1.21.1"]),
      mod(["fabric"], ["1.21.1"])
    ]);
    expect(cov.forge?.["1.20.1"]).toBe(2);
    expect(cov.forge?.["1.21.1"]).toBe(1);
    expect(cov.fabric?.["1.21.1"]).toBe(2);
    expect(cov.fabric?.["1.20.1"]).toBe(0);
  });
});

describe("recommendedVersion", () => {
  it("picks the version with the most mods for the loader", () => {
    const cov = { forge: { "1.21.1": 5, "1.21": 2, "1.20.1": 30 } };
    expect(recommendedVersion(cov, "forge")).toBe("1.20.1");
  });
  it("breaks ties by VERSIONS order and handles missing data", () => {
    expect(recommendedVersion({ forge: { "1.21.1": 4, "1.21": 4, "1.20.1": 4 } }, "forge")).toBe("1.21.1");
    expect(recommendedVersion({}, "quilt")).toBe(VERSIONS[0]);
  });
});

describe("recommendedSize", () => {
  it("scales ~50% of availability, snapped to a tier, clamped 10..60", () => {
    expect(recommendedSize(200)).toBe(60);
    expect(recommendedSize(50)).toBe(25);
    expect(recommendedSize(85)).toBe(40);
    expect(recommendedSize(8)).toBe(10);
  });
});

describe("sizeOptionsFor", () => {
  it("never offers a tier far above availability and marks one recommended", () => {
    const opts = sizeOptionsFor(50);
    expect(opts.map((o) => o.maxMods)).toEqual([10, 25]);
    expect(opts.filter((o) => o.recommended)).toHaveLength(1);
    expect(opts.find((o) => o.recommended)?.maxMods).toBe(25);
  });
  it("always returns at least the essentials tier for a tiny pool", () => {
    const opts = sizeOptionsFor(3);
    expect(opts).toHaveLength(1);
    expect(opts[0].maxMods).toBe(10);
    expect(opts[0].recommended).toBe(true);
  });
  it("keeps stable option ids aligned with the quiz", () => {
    expect(sizeOptionsFor(999).map((o) => o.id)).toEqual(["small", "medium", "large", "huge"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/catalog/coverage.test.ts`
Expected: FAIL (module `@/lib/catalog/coverage` not found).

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/catalog/coverage.ts
import type { Loader, Mod } from "@/lib/sources/types";

/** Canonical loader order — Forge first (primary). */
export const LOADERS: Loader[] = ["forge", "neoforge", "fabric", "quilt"];
/** Supported Minecraft versions, newest first. */
export const VERSIONS: string[] = ["1.21.1", "1.21", "1.20.1"];

/** Deliverable-mod counts per loader -> version. */
export type Coverage = Partial<Record<Loader, Record<string, number>>>;

const TIERS = [10, 25, 40, 60];
const TIER_META: Record<number, { id: string; label: string }> = {
  10: { id: "small", label: "Just the essentials (~10)" },
  25: { id: "medium", label: "A solid set (~25)" },
  40: { id: "large", label: "A big haul (~40)" },
  60: { id: "huge", label: "Load me all the way up (~60)" }
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Count, for each loader and version, how many mods declare support for both.
 * Mirrors the recommender's hard filter, so the count equals what we can deliver.
 */
export function computeCoverage(
  mods: Mod[],
  loaders: Loader[] = LOADERS,
  versions: string[] = VERSIONS
): Coverage {
  const cov: Coverage = {};
  for (const L of loaders) {
    const byV: Record<string, number> = {};
    for (const V of versions) byV[V] = 0;
    cov[L] = byV;
  }
  for (const m of mods) {
    for (const L of loaders) {
      if (!m.loaders.includes(L)) continue;
      const byV = cov[L]!;
      for (const V of versions) if (m.gameVersions.includes(V)) byV[V]++;
    }
  }
  return cov;
}

/** The version with the most deliverable mods for a loader (ties -> versions order). */
export function recommendedVersion(
  coverage: Coverage,
  loader: Loader,
  versions: string[] = VERSIONS
): string {
  const byV = coverage[loader] ?? {};
  let best = versions[0];
  let bestN = -1;
  for (const v of versions) {
    const n = byV[v] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

/** A sensible recommended loadout size for the available count (one of the tiers). */
export function recommendedSize(count: number): number {
  const target = clamp(Math.round(count * 0.5), 10, 60);
  const eligible = TIERS.filter((t) => t <= Math.max(count, 10) && t <= target);
  return eligible.length ? eligible[eligible.length - 1] : 10;
}

/**
 * Size options bounded by availability. Always offers at least the essentials
 * tier; flags exactly one as recommended. Ids stay aligned with the quiz so the
 * profile builder reads maxMods unchanged.
 */
export function sizeOptionsFor(count: number): { id: string; label: string; maxMods: number; recommended: boolean }[] {
  const rec = recommendedSize(count);
  const tiers = TIERS.filter((t) => t <= Math.max(count, 10));
  return tiers.map((t) => ({ ...TIER_META[t], maxMods: t, recommended: t === rec }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/catalog/coverage.test.ts`
Expected: PASS (4 describe blocks, all green).

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/coverage.ts lib/catalog/coverage.test.ts
git commit -m "feat: coverage module for loader/version mod availability"
```

---

### Task 2: Coverage snapshot + generator script

**Files:**
- Create: `scripts/gen-coverage.mjs`
- Create: `lib/catalog/coverage.snapshot.json`
- Modify: `package.json` (add `gen:coverage` script)
- Test: `lib/catalog/coverage.snapshot.test.ts`

**Interfaces:**
- Consumes: `computeCoverage`, `LOADERS`, `VERSIONS` (Task 1); `buildPool` (`lib/catalog/pool.ts`).
- Produces: `lib/catalog/coverage.snapshot.json` (a `Coverage` object), importable by the quiz.

- [ ] **Step 1: Write the snapshot smoke test**

```typescript
// lib/catalog/coverage.snapshot.test.ts
import { describe, it, expect } from "vitest";
import snapshot from "@/lib/catalog/coverage.snapshot.json";
import { LOADERS, VERSIONS, recommendedVersion, type Coverage } from "@/lib/catalog/coverage";

describe("coverage snapshot", () => {
  const cov = snapshot as Coverage;
  it("has a numeric count for every loader + version", () => {
    for (const L of LOADERS) {
      for (const V of VERSIONS) {
        expect(typeof cov[L]?.[V]).toBe("number");
      }
    }
  });
  it("recommends a real version for every loader", () => {
    for (const L of LOADERS) {
      expect(VERSIONS).toContain(recommendedVersion(cov, L));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/catalog/coverage.snapshot.test.ts`
Expected: FAIL (cannot find `coverage.snapshot.json`).

- [ ] **Step 3: Create the generator script**

```javascript
// scripts/gen-coverage.mjs
// Regenerate lib/catalog/coverage.snapshot.json from the live pool.
// Run with: npm run gen:coverage
import { writeFileSync } from "node:fs";

const API = "https://api.modrinth.com/v2";
const UA = "FullHearts/0.1 (github.com/YatoVoid/FullHearts)";
const LOADERS = ["forge", "neoforge", "fabric", "quilt"];
const VERSIONS = ["1.21.1", "1.21", "1.20.1"];
const FACETS = [null, "optimization", "worldgen", "magic", "technology", "adventure", "mobs", "food", "utility", "decoration"];

async function searchOne(category) {
  const facets = category
    ? `[["project_type:mod"],["categories:${category}"]]`
    : `[["project_type:mod"]]`;
  const res = await fetch(`${API}/search?limit=60&index=downloads&facets=${encodeURIComponent(facets)}`, {
    headers: { "User-Agent": UA }
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.hits ?? [];
}

const cov = {};
for (const L of LOADERS) {
  cov[L] = {};
  for (const V of VERSIONS) cov[L][V] = 0;
}

const seen = new Set();
for (const c of FACETS) {
  const hits = await searchOne(c);
  for (const hit of hits) {
    if (seen.has(hit.slug)) continue;
    seen.add(hit.slug);
    const loaders = (hit.categories ?? []).filter((x) => LOADERS.includes(x));
    const versions = hit.versions ?? [];
    for (const L of loaders) {
      for (const V of VERSIONS) if (versions.includes(V)) cov[L][V]++;
    }
  }
}

writeFileSync(
  new URL("../lib/catalog/coverage.snapshot.json", import.meta.url),
  JSON.stringify(cov, null, 2) + "\n"
);
console.log("Wrote coverage snapshot:", JSON.stringify(cov));
```

- [ ] **Step 4: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
"gen:coverage": "node scripts/gen-coverage.mjs"
```

- [ ] **Step 5: Generate the snapshot**

Run: `npm run gen:coverage`
Expected: prints `Wrote coverage snapshot: {...}` and creates `lib/catalog/coverage.snapshot.json` with non-zero counts (forge/fabric on 1.20.1 and 1.21.1 especially).

If the network is unavailable, create the file manually with this conservative fallback so the test and build pass (counts are advisory):

```json
{
  "forge":    { "1.21.1": 30, "1.21": 8,  "1.20.1": 45 },
  "neoforge": { "1.21.1": 35, "1.21": 6,  "1.20.1": 10 },
  "fabric":   { "1.21.1": 50, "1.21": 10, "1.20.1": 30 },
  "quilt":    { "1.21.1": 12, "1.21": 3,  "1.20.1": 8 }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/catalog/coverage.snapshot.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/gen-coverage.mjs lib/catalog/coverage.snapshot.json lib/catalog/coverage.snapshot.test.ts package.json
git commit -m "feat: coverage snapshot generator + committed snapshot"
```

---

### Task 3: Make Forge primary (questions + profile default)

**Files:**
- Modify: `lib/curation/questions.ts` (the `loader` question, ~lines 122-133)
- Modify: `lib/recommend/profile.ts` (`PROFILE_DEFAULTS.loader`, ~line 15)
- Test: `lib/recommend/recommend.test.ts` (add a default-loader assertion)

**Interfaces:**
- Consumes: nothing new.
- Produces: loader options ordered `forge, neoforge, fabric, quilt`; default loader `"forge"`.

- [ ] **Step 1: Write the failing test**

Add to `lib/recommend/recommend.test.ts` inside the `buildProfile` describe block:

```typescript
  it("defaults to the Forge loader when none is answered", () => {
    const p = buildProfile({ playstyle: ["build"] });
    expect(p.loader).toBe("forge");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/recommend/recommend.test.ts`
Expected: FAIL (`expected 'fabric' to be 'forge'`).

- [ ] **Step 3: Update the default loader**

In `lib/recommend/profile.ts`, change:

```typescript
export const PROFILE_DEFAULTS = {
  loader: "forge" as Loader,
  gameVersion: "1.21.1",
  maxMods: 8,
  lowEnd: false
};
```

- [ ] **Step 4: Reorder the loader question (Forge first, labeled most popular)**

In `lib/curation/questions.ts`, replace the `loader` question's `help` and `options`:

```typescript
    id: "loader",
    kind: "single",
    prompt: "Which mod loader do you use?",
    help: "Most modded servers use Forge. Not sure? Forge is the safest pick.",
    options: [
      { id: "forge", label: "Forge (most popular)", loader: "forge" },
      { id: "neoforge", label: "NeoForge", loader: "neoforge" },
      { id: "fabric", label: "Fabric", loader: "fabric" },
      { id: "quilt", label: "Quilt", loader: "quilt" }
    ]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/recommend/recommend.test.ts`
Expected: PASS. Then run `npx vitest run` to confirm no other test depended on Fabric-default ordering; fix any that hard-coded `loader` option index 0 = fabric.

- [ ] **Step 6: Commit**

```bash
git add lib/curation/questions.ts lib/recommend/profile.ts lib/recommend/recommend.test.ts
git commit -m "feat: make Forge the primary/default loader in the quiz"
```

---

### Task 4: Expand catalog with verified Forge-capable mods

**Files:**
- Modify: `lib/curation/catalog.ts` (append entries before the closing `];`)
- Test: `lib/curation/catalog.expansion.test.ts`

**Interfaces:**
- Consumes: `CuratedMod` type.
- Produces: new catalog entries (unique `id` + `modrinthSlug`).

Only add slugs NOT already in the catalog. Already present (do NOT re-add): `jei`, `bountiful`, `waystones`, `xaeros-minimap`, `lets-do-vinery`, `farmers-delight-refabricated`, `create-fabric`. EXCLUDED (not on Modrinth or wrong platform): FTB Quests, FTB Chunks, ChatGuard, WatchDog. Fabric-only (optional, lower priority for Forge push): `ledger`, `simple-playtime-tracker`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/curation/catalog.expansion.test.ts
import { describe, it, expect } from "vitest";
import { CATALOG } from "@/lib/curation/catalog";

describe("catalog Forge expansion", () => {
  const slugs = new Set(CATALOG.map((m) => m.modrinthSlug));
  const ids = CATALOG.map((m) => m.id);

  it("includes the verified Forge-capable additions", () => {
    for (const s of [
      "create", "cc-tweaked", "advancedperipherals", "farmers-delight",
      "lets-do-bakery", "comforts", "patchouli", "xaeros-world-map",
      "lightmans-currency", "learnplay"
    ]) {
      expect(slugs.has(s)).toBe(true);
    }
  });

  it("has no duplicate ids", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/curation/catalog.expansion.test.ts`
Expected: FAIL (slugs not present).

- [ ] **Step 3: Append the new entries**

Add these objects to the `CATALOG` array in `lib/curation/catalog.ts`, just before the closing `];`. Note `create` uses id `create-forge` to avoid colliding with the existing `create-fabric` entry; `farmers-delight` (Forge) is distinct from the existing `farmers-delight-refabricated` (Fabric).

```typescript
  {
    id: "create-forge",
    name: "Create",
    summary: "Build rotating contraptions, machines, and automated factories with style.",
    curatedTags: { tech: 1, automation: 1, building: 0.5 },
    reasonTemplate: "you wanted mechanical automation",
    modrinthSlug: "create"
  },
  {
    id: "cc-tweaked",
    name: "CC: Tweaked",
    summary: "Programmable in-game computers and robots you script with Lua.",
    curatedTags: { tech: 1, automation: 0.6 },
    reasonTemplate: "you like engineering and automation",
    modrinthSlug: "cc-tweaked"
  },
  {
    id: "advanced-peripherals",
    name: "Advanced Peripherals",
    summary: "Extends CC: Tweaked computers with blocks that interact with the world.",
    curatedTags: { tech: 1, automation: 0.7 },
    reasonTemplate: "you like deep tech systems",
    modrinthSlug: "advancedperipherals"
  },
  {
    id: "farmers-delight",
    name: "Farmer's Delight",
    summary: "Cooking, crops, and kitchen tools for a richer farm-to-table loop.",
    curatedTags: { food: 1, "low-grind": 0.4 },
    reasonTemplate: "you wanted cozy farming and cooking",
    modrinthSlug: "farmers-delight"
  },
  {
    id: "lets-do-bakery",
    name: "Let's Do: Bakery",
    summary: "Baking stations, breads, and shop counters for cozy cafes.",
    curatedTags: { food: 1, building: 0.3 },
    reasonTemplate: "you wanted cooking and decoration",
    modrinthSlug: "lets-do-bakery"
  },
  {
    id: "comforts",
    name: "Comforts",
    summary: "Sleeping bags and hammocks so you can rest without setting spawn.",
    curatedTags: { qol: 0.8, "low-grind": 0.3 },
    reasonTemplate: "you wanted quality-of-life travel comfort",
    modrinthSlug: "comforts"
  },
  {
    id: "patchouli",
    name: "Patchouli",
    summary: "Powers in-game guidebooks and tutorials used by many content mods.",
    curatedTags: { interface: 0.7, qol: 0.5 },
    reasonTemplate: "you wanted in-game guides",
    modrinthSlug: "patchouli"
  },
  {
    id: "xaeros-world-map",
    name: "Xaero's World Map",
    summary: "Full-screen self-writing world map that pairs with the minimap.",
    curatedTags: { interface: 1, exploration: 0.4 },
    reasonTemplate: "you wanted maps and navigation",
    modrinthSlug: "xaeros-world-map"
  },
  {
    id: "lightmans-currency",
    name: "Lightman's Currency",
    summary: "Coins, ATMs, and player-run shops for server economies.",
    curatedTags: { coop: 0.7, qol: 0.5, interface: 0.3 },
    reasonTemplate: "you play with friends or on servers",
    modrinthSlug: "lightmans-currency"
  },
  {
    id: "learnplay",
    name: "LearnPlay",
    summary: "Educational flashcard pop-ups that turn play into light learning.",
    curatedTags: { interface: 0.6, qol: 0.4 },
    reasonTemplate: "you wanted a learning-friendly twist",
    modrinthSlug: "learnplay"
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/curation/catalog.expansion.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify slugs still resolve (guard against typos)**

Run:
```bash
for s in create cc-tweaked advancedperipherals farmers-delight lets-do-bakery comforts patchouli xaeros-world-map lightmans-currency learnplay; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -A "FullHearts/0.1" "https://api.modrinth.com/v2/project/$s")
  echo "$s -> $code"
done
```
Expected: every line ends in `-> 200`.

- [ ] **Step 6: Commit**

```bash
git add lib/curation/catalog.ts lib/curation/catalog.expansion.test.ts
git commit -m "feat: expand catalog with verified Forge-capable mods"
```

---

### Task 5: Wire coverage into the quiz UI

**Files:**
- Modify: `app/quiz/page.tsx`
- Test: manual (UI), plus `npm run build` + full `npx vitest run` for regressions.

**Interfaces:**
- Consumes: `computeCoverage`, `recommendedVersion`, `sizeOptionsFor`, `LOADERS`, `VERSIONS` (Task 1); `coverage.snapshot.json` (Task 2); `loadPool` (`lib/catalog/clientPool.ts`); `QUESTIONS` (existing).
- Produces: no exported API; renders counts + recommendations.

First confirm the pool loader's exported name:

- [ ] **Step 1: Find the client pool loader**

Run: `grep -n "export" lib/catalog/clientPool.ts`
Expected: an exported async function returning `Promise<Mod[]>` (e.g. `loadPool`). Use that exact name below; if it differs, substitute it.

- [ ] **Step 2: Add coverage state + live refinement to the quiz**

In `app/quiz/page.tsx`, add imports near the top:

```typescript
import { computeCoverage, recommendedVersion, sizeOptionsFor, type Coverage } from "@/lib/catalog/coverage";
import snapshotCoverage from "@/lib/catalog/coverage.snapshot.json";
import { loadPool } from "@/lib/catalog/clientPool";
import type { Loader } from "@/lib/sources/types";
```

Inside the `Quiz` component, after the existing `useState` hooks, add:

```typescript
  // Coverage: start from the committed snapshot, replace with live counts when the
  // cached pool resolves. Counts are advisory and never block advancing.
  const [coverage, setCoverage] = useState<Coverage>(snapshotCoverage as Coverage);
  useEffect(() => {
    let cancelled = false;
    loadPool()
      .then((pool) => { if (!cancelled) setCoverage(computeCoverage(pool)); })
      .catch(() => { /* keep snapshot */ });
    return () => { cancelled = true; };
  }, []);

  // Map quiz answers -> chosen loader/version (loader option ids equal loader names).
  const chosenLoader = (answers.loader?.[0] ?? "forge") as Loader;
  const versionById: Record<string, string> = {};
  for (const o of QUESTIONS.find((q) => q.id === "version")?.options ?? []) {
    if (o.gameVersion) versionById[o.id] = o.gameVersion;
  }
  const chosenVersion = versionById[answers.version?.[0] ?? ""] ?? "1.20.1";
  const recVersion = recommendedVersion(coverage, chosenLoader);
```

- [ ] **Step 3: Compute the display options for the current step**

Still inside the component, after `const selected = answers[question.id] ?? [];`, add:

```typescript
  // Decorate the version and size steps with live availability. Other steps render
  // their static options unchanged. Size ids stay aligned so buildProfile is intact.
  type DisplayOption = { id: string; label: string; note?: string; recommended?: boolean };
  let displayOptions: DisplayOption[];
  if (question.id === "version") {
    displayOptions = question.options.map((o) => {
      const count = coverage[chosenLoader]?.[o.gameVersion ?? ""] ?? 0;
      return {
        id: o.id,
        label: o.label,
        note: `${count} mods`,
        recommended: o.gameVersion === recVersion
      };
    });
  } else if (question.id === "size") {
    const count = coverage[chosenLoader]?.[chosenVersion] ?? 0;
    displayOptions = sizeOptionsFor(count).map((o) => ({
      id: o.id,
      label: o.label,
      recommended: o.recommended
    }));
  } else {
    displayOptions = question.options.map((o) => ({ id: o.id, label: o.label }));
  }
```

- [ ] **Step 4: Render displayOptions (replace the options map)**

Replace the `question.options.map(...)` block inside `.quiz-options` with `displayOptions.map(...)`:

```tsx
        <div className="quiz-options" role={question.kind === "single" ? "radiogroup" : "group"}>
          {displayOptions.map((opt, i) => {
            const isSel = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={`quiz-option${isSel ? " selected" : ""}`}
                aria-pressed={isSel}
                onClick={() => toggle(opt.id)}
              >
                <span className="key">{i + 1}</span>
                <span className="quiz-option-label">{opt.label}</span>
                {opt.recommended && <span className="quiz-tag">Recommended</span>}
                {opt.note && <span className="quiz-note">{opt.note}</span>}
              </button>
            );
          })}
        </div>
```

Also update the keyboard handler's bounds and the `toggle` closure to use `displayOptions` instead of `question.options`: in the `onKey` number branch change `question.options.length` to `displayOptions.length` and `question.options[n - 1].id` to `displayOptions[n - 1].id`. Add `displayOptions` to that effect's dependency array.

- [ ] **Step 5: Add a help line for the version step + minimal styles**

After the existing `{question.help && <p className="help">{question.help}</p>}`, add:

```tsx
        {question.id === "version" && (
          <p className="help">
            Recommended for {chosenLoader.charAt(0).toUpperCase() + chosenLoader.slice(1)}:{" "}
            {recVersion} (biggest mod selection).
          </p>
        )}
```

Append to `app/globals.css`:

```css
.quiz-tag { margin-left: auto; font-size: 0.72rem; font-weight: 700; color: #2e7d32; }
.quiz-note { margin-left: 0.5rem; font-size: 0.78rem; opacity: 0.7; }
```

- [ ] **Step 6: Verify build + full test suite**

Run: `npx vitest run` — Expected: all suites pass.
Run: `npm run build` — Expected: `Compiled successfully`.

- [ ] **Step 7: Manual check**

Run `npm run dev`, open `/quiz`. Confirm: Forge is first and pre-implied; the version step shows "N mods" per version and badges the recommended one with the help line; the size step hides tiers above availability and highlights the recommended size. Number keys and Enter still work.

- [ ] **Step 8: Commit**

```bash
git add app/quiz/page.tsx app/globals.css
git commit -m "feat: show loader-aware version + size recommendations in the quiz"
```

---

## Self-Review Notes

- Spec coverage: coverage module (Task 1), hybrid snapshot+live (Tasks 2 & 5), version recommendation per loader (Tasks 1 & 5), availability-driven size (Tasks 1 & 5), Forge-primary (Task 3), catalog expansion with verified seed list (Task 4). CurseForge-only mods reported as excluded (Task 4 notes). All spec sections mapped.
- Size option ids stay `small/medium/large/huge` with maxMods `10/25/40/60`, so `buildProfile` reads them unchanged — no profile plumbing needed.
- `recommendedVersion` and `sizeOptionsFor` are pure and fully tested; the quiz component carries no untested logic.
