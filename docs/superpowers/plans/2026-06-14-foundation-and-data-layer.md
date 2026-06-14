# Foundation & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Full Hearts Next.js app with its ported landing page and a live, cached mod-data layer that enriches a curated seed catalog with Modrinth (and optionally CurseForge) data.

**Architecture:** Next.js App Router (TypeScript). A curated seed catalog (`lib/curation`) holds hand-authored tags + reasons per mod. A pluggable source layer (`lib/sources`) normalizes Modrinth/CurseForge JSON into one `Mod` shape and merges sources with graceful fallback when no CurseForge key is present. A serverless route (`app/api/mods`) is the only place that touches the network and caches upstream responses. Pure modules are unit-tested with Vitest against captured fixtures.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Vitest, native `fetch`.

---

## File structure (created/modified in this plan)

```
PROJECT_PROGRESS.md          milestone log
PROJECT_ROADMAP.md           slices & phases
ARCHITECTURE.md              living architecture doc
DECISIONS.md                 decision log (ADR-style)
package.json                 scripts + deps
tsconfig.json                TS config
next.config.mjs              Next config
vitest.config.ts             test config
app/layout.tsx               root layout + fonts
app/globals.css              ported Full Hearts design tokens + styles
app/page.tsx                 reframed landing (CTA → /quiz)
app/api/mods/route.ts        serverless proxy: enrich catalog, cache
lib/curation/tags.ts         tag vocabulary (the taxonomy)
lib/curation/tags.test.ts
lib/curation/catalog.ts      curated seed mods (migrated from index.html)
lib/curation/catalog.test.ts integrity tests
lib/sources/types.ts         unified Mod / Dependency / source interface
lib/sources/modrinth.ts      Modrinth adapter
lib/sources/modrinth.test.ts fixture-based tests
lib/sources/__fixtures__/modrinth-projects.json
lib/sources/__fixtures__/modrinth-version.json
lib/sources/curseforge.ts    CurseForge adapter (active only with key)
lib/sources/index.ts         source selection + merge + fallback
lib/sources/index.test.ts
```

`index.html` stays in the repo as a reference for the CSS port, then can be removed in a later plan.

---

## Task 0: Project tracking docs

**Files:**
- Create: `PROJECT_PROGRESS.md`, `PROJECT_ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`

- [ ] **Step 1: Create `PROJECT_PROGRESS.md`**

```markdown
# Project Progress

A running log of milestones. Newest at top.

## 2026-06-14 — Project kickoff
- Brainstormed & approved MVP design (`docs/superpowers/specs/2026-06-14-mod-recommender-mvp-design.md`).
- Decisions: serverless data, Next.js, optional CurseForge key, curated candidate pool, rule-based engine.
- Plan 1 (Foundation & Data Layer) written.

## Status
- [ ] Plan 1 — Foundation & Data Layer
- [ ] Plan 2 — Engine, Quiz & Results
- [ ] Plan 3 — Collections, Export/Share & Polish
```

- [ ] **Step 2: Create `PROJECT_ROADMAP.md`**

```markdown
# Project Roadmap

## MVP slice: "Core journey + collections"
Quiz → ranked recommendations with reasons + shown dependencies → local collections → export/share.

### Plan 1 — Foundation & Data Layer (current)
Next.js scaffold, ported landing, Modrinth/CurseForge data layer, serverless proxy, curated seed catalog.

### Plan 2 — Engine, Quiz & Results
Rule-based scoring engine, data-driven quiz, results page with reasons + dependencies + install links.

### Plan 3 — Collections, Export/Share & Polish
localStorage CRUD, JSON/text export, URL-encoded share, returning-user resume, accessibility + mobile pass.

## Later cycles (post-MVP)
- Automatic dependency resolution (auto-add prereqs, conflict detection).
- Catalog scale-up & richer CurseForge integration.
- Optional short-link share service; vector/ML ranking.
```

- [ ] **Step 3: Create `ARCHITECTURE.md`**

```markdown
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
```

- [ ] **Step 4: Create `DECISIONS.md`**

```markdown
# Decisions

ADR-style log. Newest at top.

## D1 — Serverless data backend (2026-06-14)
Browser → Next.js API routes → Modrinth (+CurseForge if keyed), cached.
Chosen for live data + real dependency graphs. Rejected: pure-static curated-only; Modrinth-only client-side.

## D2 — Next.js (App Router, TS) (2026-06-14)
Frontend + serverless proxy in one project. Rejected: SvelteKit, Astro islands.

## D3 — CurseForge key optional with graceful fallback (2026-06-14)
Modrinth works with no key; CurseForge activates when `CURSEFORGE_API_KEY` set. Dev never blocked.

## D4 — Curated candidate pool, live-enriched (2026-06-14)
Engine ranks a hand-curated pool; proxy enriches volatile fields. Rejected: ranking the whole live catalog (kills explainability).

## D5 — Rule-based weighted tag scoring (2026-06-14)
Deterministic, explainable, testable. Rejected: ML/vector similarity (overkill, hard to explain).

## D6 — URL-encoded sharing (2026-06-14)
Collection encoded into a URL hash; no backend state. Rejected for now: short-link service.
```

- [ ] **Step 5: Commit**

```bash
git add PROJECT_PROGRESS.md PROJECT_ROADMAP.md ARCHITECTURE.md DECISIONS.md
git commit -m "docs: add project tracking documents"
```

---

## Task 1: Scaffold Next.js + TypeScript + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

> We scaffold manually (not `create-next-app`) because the directory already contains `index.html`, `docs/`, and `.git`, which `create-next-app` refuses to write into.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "full-hearts",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.1.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.modrinth.com" },
      { protocol: "https", hostname: "media.forgecdn.net" }
    ]
  }
};

export default nextConfig;
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"]
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") }
  }
});
```

- [ ] **Step 5: Create `app/globals.css`** (port the design tokens)

Copy the entire contents of the `<style>` block in `index.html` (lines 11–200) into `app/globals.css`, then make these adjustments:
- Keep every `:root` CSS variable and all class rules as-is (they are the Full Hearts design system).
- Remove the `body{ ... }` rules that set `font-family` via the Google Fonts names and instead rely on the font CSS variables injected by `next/font` in Step 6 (replace `--pixel` and `--body` values with `var(--font-press-start)` and `var(--font-inter)` respectively).

```css
/* at top of globals.css, after the ported :root block, override the two font vars: */
:root {
  --pixel: var(--font-press-start), monospace;
  --body: var(--font-inter), system-ui, sans-serif;
}
```

- [ ] **Step 6: Create `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter"
});

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start"
});

export const metadata: Metadata = {
  title: "Full Hearts — Find your perfect Minecraft mods",
  description:
    "Answer a few questions and get a personalized, compatible set of Minecraft mods — with a clear reason for every pick. No account needed."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${pressStart.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create a placeholder `app/page.tsx`**

```tsx
export default function Home() {
  return <main style={{ padding: 40 }}>Full Hearts — scaffold OK</main>;
}
```

- [ ] **Step 8: Install dependencies and verify the build**

Run: `npm install`
Then run: `npm run build`
Expected: build completes with no type errors and reports the `/` route. (`next-env.d.ts` is generated automatically during build.)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts next-env.d.ts app/
git commit -m "chore: scaffold Next.js app with TypeScript and Vitest"
```

---

## Task 2: Port the Full Hearts landing page (reframed to the quiz)

The old landing showed two static mod grids; those are replaced by the quiz→results flow. The reframed landing keeps the hero, stats, a "How it works" trio, and the footer, with CTAs pointing to `/quiz`.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx` with the reframed landing**

```tsx
import Link from "next/link";

const HEART = (
  <svg viewBox="0 0 9 9" aria-hidden="true">
    <path d="M1 0h2v1h1V0h2v1h1v1h1v3h-1v1h-1v1h-1v1H4v-1H3V6H2V5H1V4H0V1h1z" fill="#b3000c" />
    <path d="M1 1h2v1h1v1h1V2h1V1h2v1H7v1h1v1H7v1H6v1H5v1H4V6H3V5H2V4H1V2H0V1h1z" fill="#fb1f2c" />
    <path d="M1 1h1v1H1zM3 1h1v1H3z" fill="#ff8a90" />
  </svg>
);

export default function Home() {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <div className="brand">
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </div>
          <Link className="nav-cta" href="/quiz">Start the quiz</Link>
        </div>
      </header>

      <main>
        <section className="hero wrap">
          <div className="eyebrow">PERSONALIZED · MINECRAFT JAVA</div>
          <div className="hearts" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ width: 30, height: 30, display: "inline-flex", animationDelay: `${i * 60}ms` }}>{HEART}</span>
            ))}
          </div>
          <h1>Find the <span className="g">perfect mods</span><br />without the guesswork.</h1>
          <p className="lede">Answer a few quick questions about how you like to play. We&apos;ll build you a compatible mod loadout — and tell you exactly why each one made the cut.</p>
          <div className="hero-actions">
            <Link className="btn-primary" href="/quiz">Build my loadout</Link>
            <a className="btn-ghost" href="#how">How it works</a>
          </div>
          <div className="xpbar"><i /></div>
          <div className="xplabel">NO ACCOUNT · SAVED IN YOUR BROWSER</div>
        </section>

        <section className="stats wrap">
          <div className="stat"><div className="num">9</div><div className="lab">Quick questions</div></div>
          <div className="stat"><div className="num">0</div><div className="lab">Accounts required</div></div>
          <div className="stat"><div className="num">100%</div><div className="lab">Reasons explained</div></div>
        </section>

        <section className="wrap" id="how" style={{ padding: "70px 0 90px" }}>
          <div className="section-head">
            <div className="eyebrow">HOW IT WORKS</div>
            <h2>Three steps to your loadout</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            <article className="tip r-uncommon"><div className="row1"><span className="title">1 · Take the quiz</span></div><p className="desc">Tell us how you like to play — building, exploring, automating, fighting — plus your version and mod loader.</p></article>
            <article className="tip r-uncommon"><div className="row1"><span className="title">2 · Get your loadout</span></div><p className="desc">We rank compatible mods to your taste and show a plain-English reason for every pick, with dependencies flagged.</p></article>
            <article className="tip r-uncommon"><div className="row1"><span className="title">3 · Save &amp; install</span></div><p className="desc">Save the collection in your browser, then open install links straight to Modrinth or CurseForge.</p></article>
          </div>
        </section>
      </main>

      <footer>
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
          <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
          <span className="name">FULL<b>HEARTS</b></span>
        </div>
        <p>A fan-made mod recommender. Always download from official sources like Modrinth or CurseForge.</p>
        <p className="note">Not affiliated with or endorsed by Mojang or Microsoft. Minecraft is a trademark of Mojang AB.</p>
      </footer>
    </>
  );
}
```

- [ ] **Step 2: Verify the landing renders**

Run: `npm run dev`
Open `http://localhost:3000`. Expected: the Full Hearts hero, stats, "How it works" cards, and footer render with pixel fonts and the dark theme. The "Build my loadout" / "Start the quiz" links point to `/quiz` (404 for now — that's fine).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: port Full Hearts landing page reframed around the quiz"
```

---

## Task 3: Tag vocabulary

**Files:**
- Create: `lib/curation/tags.ts`
- Test: `lib/curation/tags.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/curation/tags.test.ts
import { describe, it, expect } from "vitest";
import { TAGS, isTag } from "@/lib/curation/tags";

describe("tags", () => {
  it("includes the core taxonomy", () => {
    for (const t of ["performance", "building", "automation", "magic", "low-grind", "low-end"]) {
      expect(TAGS).toContain(t);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(TAGS).size).toBe(TAGS.length);
  });

  it("isTag narrows correctly", () => {
    expect(isTag("magic")).toBe(true);
    expect(isTag("nonsense")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tags`
Expected: FAIL — cannot find module `@/lib/curation/tags`.

- [ ] **Step 3: Implement `lib/curation/tags.ts`**

```ts
export const TAGS = [
  "performance",
  "visual",
  "interface",
  "building",
  "exploration",
  "automation",
  "tech",
  "magic",
  "combat",
  "rpg",
  "coop",
  "low-grind",
  "low-end"
] as const;

export type Tag = (typeof TAGS)[number];

export function isTag(value: string): value is Tag {
  return (TAGS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tags`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/curation/tags.ts lib/curation/tags.test.ts
git commit -m "feat: add curation tag vocabulary"
```

---

## Task 4: Unified types & source interface

**Files:**
- Create: `lib/sources/types.ts`

- [ ] **Step 1: Create `lib/sources/types.ts`**

```ts
import type { Tag } from "@/lib/curation/tags";

export type Loader = "fabric" | "forge" | "neoforge" | "quilt";

/** A curated entry: human-authored, no live data yet. */
export interface CuratedMod {
  id: string;                 // stable internal slug, e.g. "sodium"
  name: string;
  summary: string;
  curatedTags: Partial<Record<Tag, number>>;  // affinity 0..1
  reasonTemplate: string;     // drives the "why" line in Plan 2
  modrinthSlug?: string;      // for enrichment
  curseforgeId?: number;      // for enrichment when keyed
}

export interface Dependency {
  id: string;                 // upstream project id
  name: string;               // resolved display name (may equal id if unresolved)
  required: boolean;
}

/** A curated mod after live enrichment. Live fields may be empty if a fetch failed. */
export interface Mod extends CuratedMod {
  loaders: Loader[];
  gameVersions: string[];
  dependencies: Dependency[];
  links: { modrinth?: string; curseforge?: string };
  downloads?: number;
  iconUrl?: string;
}

/** Live data fetched for a single curated mod. */
export interface Enrichment {
  loaders: Loader[];
  gameVersions: string[];
  dependencies: Dependency[];
  links: { modrinth?: string; curseforge?: string };
  downloads?: number;
  iconUrl?: string;
}

/** A pluggable data source (Modrinth, CurseForge, ...). */
export interface ModSource {
  readonly name: string;
  /** Returns enrichment keyed by CuratedMod.id, only for mods this source knows. */
  enrich(mods: CuratedMod[]): Promise<Map<string, Enrichment>>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/sources/types.ts
git commit -m "feat: add unified Mod types and source interface"
```

---

## Task 5: Curated seed catalog

Migrate a starter set from `index.html`'s `MODS`/`MODS2` arrays into typed `CuratedMod`s with tag affinities + reason templates. Start with ~20 high-confidence mods; the catalog grows in later plans.

**Files:**
- Create: `lib/curation/catalog.ts`
- Test: `lib/curation/catalog.test.ts`

- [ ] **Step 1: Write the failing integrity test**

```ts
// lib/curation/catalog.test.ts
import { describe, it, expect } from "vitest";
import { CATALOG } from "@/lib/curation/catalog";
import { isTag } from "@/lib/curation/tags";

describe("catalog integrity", () => {
  it("is non-empty", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  it("has unique ids", () => {
    const ids = CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every mod has at least one valid tag with affinity in (0,1]", () => {
    for (const m of CATALOG) {
      const entries = Object.entries(m.curatedTags);
      expect(entries.length).toBeGreaterThan(0);
      for (const [tag, weight] of entries) {
        expect(isTag(tag)).toBe(true);
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it("every mod has a non-empty name, summary, and reason template", () => {
    for (const m of CATALOG) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.summary.length).toBeGreaterThan(0);
      expect(m.reasonTemplate.length).toBeGreaterThan(0);
    }
  });

  it("every mod has a modrinth slug for enrichment", () => {
    for (const m of CATALOG) {
      expect(m.modrinthSlug, `${m.id} missing modrinthSlug`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- catalog`
Expected: FAIL — cannot find module `@/lib/curation/catalog`.

- [ ] **Step 3: Implement `lib/curation/catalog.ts`**

```ts
import type { CuratedMod } from "@/lib/sources/types";

/**
 * Curated seed catalog. Tag affinities are 0..1 (how strongly a mod serves a
 * preference). `reasonTemplate` is rendered to the "why" line in Plan 2.
 * `modrinthSlug` is the slug in modrinth.com/mod/<slug>.
 */
export const CATALOG: CuratedMod[] = [
  {
    id: "sodium",
    name: "Sodium",
    summary: "Rebuilds the rendering engine for big FPS gains with no visual downsides.",
    curatedTags: { performance: 1, "low-end": 1 },
    reasonTemplate: "you wanted better performance",
    modrinthSlug: "sodium"
  },
  {
    id: "lithium",
    name: "Lithium",
    summary: "Optimizes tick logic, mob AI, and physics without changing behavior.",
    curatedTags: { performance: 0.9, "low-end": 0.8 },
    reasonTemplate: "you wanted smoother performance",
    modrinthSlug: "lithium"
  },
  {
    id: "ferritecore",
    name: "FerriteCore",
    summary: "Cuts memory usage by storing block and chunk data more efficiently.",
    curatedTags: { performance: 0.7, "low-end": 0.9 },
    reasonTemplate: "you're on limited hardware",
    modrinthSlug: "ferrite-core"
  },
  {
    id: "iris",
    name: "Iris Shaders",
    summary: "Runs shader packs while staying compatible with Sodium.",
    curatedTags: { visual: 1, performance: 0.4 },
    reasonTemplate: "you wanted better visuals",
    modrinthSlug: "iris"
  },
  {
    id: "modmenu",
    name: "Mod Menu",
    summary: "Adds a clean in-game screen to configure every Fabric mod you have.",
    curatedTags: { interface: 0.9 },
    reasonTemplate: "you wanted easy configuration",
    modrinthSlug: "modmenu"
  },
  {
    id: "jade",
    name: "Jade",
    summary: "Shows what you're looking at — block name, mod, mob health — in a tooltip.",
    curatedTags: { interface: 0.8, exploration: 0.3 },
    reasonTemplate: "you wanted clearer in-game info",
    modrinthSlug: "jade"
  },
  {
    id: "jei",
    name: "Just Enough Items (JEI)",
    summary: "Look up the recipe or usage of any item from your inventory.",
    curatedTags: { interface: 1, tech: 0.4, automation: 0.3 },
    reasonTemplate: "you wanted recipe lookups",
    modrinthSlug: "jei"
  },
  {
    id: "appleskin",
    name: "AppleSkin",
    summary: "Reveals exactly how much hunger and saturation food restores.",
    curatedTags: { interface: 0.6 },
    reasonTemplate: "you wanted clearer survival info",
    modrinthSlug: "appleskin"
  },
  {
    id: "xaeros-minimap",
    name: "Xaero's Minimap",
    summary: "A corner minimap with waypoints, cave mode, and mob radar.",
    curatedTags: { exploration: 1, interface: 0.5 },
    reasonTemplate: "you love to explore",
    modrinthSlug: "xaeros-minimap"
  },
  {
    id: "create",
    name: "Create",
    summary: "Build rotating, moving machines — windmills, conveyors, even trains.",
    curatedTags: { tech: 1, automation: 1, building: 0.5, "low-grind": 0.6 },
    reasonTemplate: "you wanted mechanical automation",
    modrinthSlug: "create-fabric"
  },
  {
    id: "botania",
    name: "Botania",
    summary: "Magic generated by living flowers and mana, with deep build-driven systems.",
    curatedTags: { magic: 1, automation: 0.6, building: 0.4, "low-grind": 0.7 },
    reasonTemplate: "you wanted magic without the grind",
    modrinthSlug: "botania"
  },
  {
    id: "ars-nouveau",
    name: "Ars Nouveau",
    summary: "Combine glyphs to design custom spells and automate them.",
    curatedTags: { magic: 1, automation: 0.5, rpg: 0.4 },
    reasonTemplate: "you wanted creative spellcrafting",
    modrinthSlug: "ars-nouveau"
  },
  {
    id: "farmers-delight",
    name: "Farmer's Delight",
    summary: "A cozy cooking system with new crops, tools, and meals.",
    curatedTags: { "low-grind": 0.8, building: 0.3, rpg: 0.3 },
    reasonTemplate: "you wanted cozy, low-pressure content",
    modrinthSlug: "farmers-delight"
  },
  {
    id: "terralith",
    name: "Terralith",
    summary: "Reworks generation into dramatic, believable landscapes using vanilla blocks.",
    curatedTags: { exploration: 1, visual: 0.6 },
    reasonTemplate: "you wanted more to explore",
    modrinthSlug: "terralith"
  },
  {
    id: "supplementaries",
    name: "Supplementaries",
    summary: "Sconces, signs, urns, and dozens of tasteful props that make spaces feel lived-in.",
    curatedTags: { building: 1, "low-grind": 0.5 },
    reasonTemplate: "you love building and decorating",
    modrinthSlug: "supplementaries"
  },
  {
    id: "macaws-furniture",
    name: "Macaw's Furniture",
    summary: "Furniture, roofs, bridges, doors, and windows — pure building range.",
    curatedTags: { building: 1 },
    reasonTemplate: "you love building and decorating",
    modrinthSlug: "macaws-furniture"
  },
  {
    id: "alexs-mobs",
    name: "Alex's Mobs",
    summary: "Over 100 distinctive ambient creatures across oceans, skies, and biomes.",
    curatedTags: { exploration: 0.7, combat: 0.5, rpg: 0.4 },
    reasonTemplate: "you wanted a more alive world",
    modrinthSlug: "alexs-mobs"
  },
  {
    id: "cataclysm",
    name: "L_Ender's Cataclysm",
    summary: "Serious, fair boss fights tucked inside themed dungeons.",
    curatedTags: { combat: 1, exploration: 0.6, rpg: 0.5 },
    reasonTemplate: "you wanted tougher combat",
    modrinthSlug: "lenders-cataclysm"
  },
  {
    id: "open-parties-claims",
    name: "Open Parties and Claims",
    summary: "Claim your land so mobs and friends can't wreck it, and form parties.",
    curatedTags: { coop: 1, building: 0.3 },
    reasonTemplate: "you play with friends",
    modrinthSlug: "open-parties-and-claims"
  },
  {
    id: "sodium-extra",
    name: "Sodium Extra",
    summary: "Extra video-setting toggles on top of Sodium for fine performance tuning.",
    curatedTags: { performance: 0.7, "low-end": 0.7, interface: 0.4 },
    reasonTemplate: "you wanted more performance control",
    modrinthSlug: "sodium-extra"
  }
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- catalog`
Expected: PASS (5 tests). If a `modrinthSlug` is wrong it won't fail here (that's covered by live enrichment later) — but double-check slugs against modrinth.com when convenient.

- [ ] **Step 5: Commit**

```bash
git add lib/curation/catalog.ts lib/curation/catalog.test.ts
git commit -m "feat: add curated seed catalog with tags and reason templates"
```

---

## Task 6: Modrinth adapter

Normalizes Modrinth's `/v2/projects` (metadata) and `/v2/version` (dependencies) responses into our `Enrichment` shape.

**Files:**
- Create: `lib/sources/modrinth.ts`
- Create: `lib/sources/__fixtures__/modrinth-projects.json`
- Create: `lib/sources/__fixtures__/modrinth-version.json`
- Test: `lib/sources/modrinth.test.ts`

- [ ] **Step 1: Create the fixtures**

`lib/sources/__fixtures__/modrinth-projects.json` (trimmed real-shape response from `GET /v2/projects?ids=["AANobbMI"]`):

```json
[
  {
    "id": "AANobbMI",
    "slug": "sodium",
    "title": "Sodium",
    "description": "The fastest and most compatible rendering optimization mod for Minecraft.",
    "categories": ["optimization"],
    "downloads": 50000000,
    "icon_url": "https://cdn.modrinth.com/data/AANobbMI/icon.png",
    "game_versions": ["1.20.1", "1.21", "1.21.1"],
    "loaders": ["fabric", "quilt", "neoforge"],
    "versions": ["FAKEVERSIONID"]
  }
]
```

`lib/sources/__fixtures__/modrinth-version.json` (real-shape response from `GET /v2/version/FAKEVERSIONID`):

```json
{
  "id": "FAKEVERSIONID",
  "project_id": "AANobbMI",
  "name": "Sodium 0.6.0",
  "version_number": "mc1.21.1-0.6.0",
  "game_versions": ["1.21.1"],
  "loaders": ["fabric"],
  "date_published": "2024-09-01T00:00:00Z",
  "dependencies": [
    { "version_id": null, "project_id": "P7dR8mSH", "file_name": null, "dependency_type": "required" },
    { "version_id": null, "project_id": "YL57xq9U", "file_name": null, "dependency_type": "optional" }
  ],
  "files": [{ "url": "https://cdn.modrinth.com/data/AANobbMI/versions/x/sodium.jar", "primary": true }]
}
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/sources/modrinth.test.ts
import { describe, it, expect } from "vitest";
import { normalizeProject, normalizeDependencies } from "@/lib/sources/modrinth";
import projectsFixture from "@/lib/sources/__fixtures__/modrinth-projects.json";
import versionFixture from "@/lib/sources/__fixtures__/modrinth-version.json";

describe("modrinth normalization", () => {
  it("normalizes a project into Enrichment fields", () => {
    const e = normalizeProject(projectsFixture[0]);
    expect(e.loaders).toContain("fabric");
    expect(e.loaders).not.toContain("forge");        // not present upstream
    expect(e.gameVersions).toContain("1.21.1");
    expect(e.downloads).toBe(50000000);
    expect(e.links.modrinth).toBe("https://modrinth.com/mod/sodium");
    expect(e.iconUrl).toContain("icon.png");
  });

  it("keeps only known loaders", () => {
    const e = normalizeProject({ ...projectsFixture[0], loaders: ["fabric", "rift", "modloader"] });
    expect(e.loaders).toEqual(["fabric"]);
  });

  it("extracts only REQUIRED dependencies as required", () => {
    const deps = normalizeDependencies(versionFixture);
    const required = deps.filter((d) => d.required).map((d) => d.id);
    expect(required).toEqual(["P7dR8mSH"]);          // optional one excluded from required
    expect(deps.map((d) => d.id)).toContain("YL57xq9U"); // optional still listed
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- modrinth`
Expected: FAIL — cannot find module `@/lib/sources/modrinth`.

- [ ] **Step 4: Implement `lib/sources/modrinth.ts`**

```ts
import type { CuratedMod, Dependency, Enrichment, Loader, ModSource } from "@/lib/sources/types";

const API = "https://api.modrinth.com/v2";
const KNOWN_LOADERS: Loader[] = ["fabric", "forge", "neoforge", "quilt"];
const UA = "FullHearts/0.1 (github.com/YatoVoid/FullHearts)";

interface MrProject {
  id: string;
  slug: string;
  title: string;
  game_versions: string[];
  loaders: string[];
  downloads?: number;
  icon_url?: string;
}

interface MrDependency {
  project_id: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
}

interface MrVersion {
  project_id: string;
  dependencies: MrDependency[];
}

export function normalizeProject(p: MrProject): Enrichment {
  const loaders = p.loaders.filter((l): l is Loader =>
    (KNOWN_LOADERS as string[]).includes(l)
  );
  return {
    loaders,
    gameVersions: p.game_versions ?? [],
    dependencies: [],
    links: { modrinth: `https://modrinth.com/mod/${p.slug}` },
    downloads: p.downloads,
    iconUrl: p.icon_url
  };
}

export function normalizeDependencies(v: MrVersion): Dependency[] {
  return v.dependencies
    .filter((d) => d.project_id && (d.dependency_type === "required" || d.dependency_type === "optional"))
    .map((d) => ({
      id: d.project_id as string,
      name: d.project_id as string, // resolved to a title in Plan 2
      required: d.dependency_type === "required"
    }));
}

async function mrFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: 3600 }
  });
  if (!res.ok) throw new Error(`Modrinth ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export const modrinthSource: ModSource = {
  name: "modrinth",
  async enrich(mods: CuratedMod[]): Promise<Map<string, Enrichment>> {
    const out = new Map<string, Enrichment>();
    const withSlug = mods.filter((m) => m.modrinthSlug);
    if (withSlug.length === 0) return out;

    // Batch metadata: /v2/projects?ids=["slug1","slug2"] (slugs are accepted as ids)
    const ids = JSON.stringify(withSlug.map((m) => m.modrinthSlug));
    let projects: MrProject[] = [];
    try {
      projects = await mrFetch<MrProject[]>(`/projects?ids=${encodeURIComponent(ids)}`);
    } catch {
      return out; // graceful: caller falls back to curated-only
    }

    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    for (const m of withSlug) {
      const p = bySlug.get(m.modrinthSlug as string);
      if (p) out.set(m.id, normalizeProject(p));
    }
    return out;
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- modrinth`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/sources/modrinth.ts lib/sources/modrinth.test.ts lib/sources/__fixtures__/
git commit -m "feat: add Modrinth source adapter with normalization tests"
```

---

## Task 7: CurseForge stub + source merge with graceful fallback

**Files:**
- Create: `lib/sources/curseforge.ts`
- Create: `lib/sources/index.ts`
- Test: `lib/sources/index.test.ts`

- [ ] **Step 1: Implement `lib/sources/curseforge.ts` (active only with a key)**

```ts
import type { CuratedMod, Enrichment, ModSource } from "@/lib/sources/types";

/**
 * CurseForge adapter. Only meaningful when CURSEFORGE_API_KEY is set.
 * Full normalization lands in a later plan; for now it returns no enrichment
 * (Modrinth covers the seed catalog), but the source is wired so enabling the
 * key flips it on without touching callers.
 */
export function curseforgeSource(apiKey: string): ModSource {
  return {
    name: "curseforge",
    async enrich(_mods: CuratedMod[]): Promise<Map<string, Enrichment>> {
      // Placeholder: real CurseForge fetch added in a later plan.
      // apiKey is captured here and used then.
      void apiKey;
      return new Map();
    }
  };
}
```

- [ ] **Step 2: Write the failing test for merge + fallback**

```ts
// lib/sources/index.test.ts
import { describe, it, expect } from "vitest";
import { mergeEnrichment } from "@/lib/sources/index";
import type { CuratedMod, Enrichment } from "@/lib/sources/types";

const curated: CuratedMod[] = [
  { id: "a", name: "A", summary: "s", curatedTags: { magic: 1 }, reasonTemplate: "r", modrinthSlug: "a" }
];

describe("mergeEnrichment", () => {
  it("falls back to empty live fields when no source has data", () => {
    const [mod] = mergeEnrichment(curated, []);
    expect(mod.id).toBe("a");
    expect(mod.loaders).toEqual([]);
    expect(mod.gameVersions).toEqual([]);
    expect(mod.dependencies).toEqual([]);
    expect(mod.name).toBe("A"); // curated fields preserved
  });

  it("applies enrichment from the first source that has it", () => {
    const e: Enrichment = {
      loaders: ["fabric"], gameVersions: ["1.21"], dependencies: [],
      links: { modrinth: "https://modrinth.com/mod/a" }, downloads: 5
    };
    const [mod] = mergeEnrichment(curated, [new Map([["a", e]])]);
    expect(mod.loaders).toEqual(["fabric"]);
    expect(mod.links.modrinth).toContain("/mod/a");
    expect(mod.downloads).toBe(5);
  });

  it("union-merges loaders/versions and prefers earlier sources for links", () => {
    const cf: Enrichment = { loaders: ["forge"], gameVersions: ["1.20.1"], dependencies: [], links: { curseforge: "https://curseforge.com/x" } };
    const mr: Enrichment = { loaders: ["fabric"], gameVersions: ["1.21"], dependencies: [], links: { modrinth: "https://modrinth.com/mod/a" } };
    const [mod] = mergeEnrichment(curated, [new Map([["a", mr]]), new Map([["a", cf]])]);
    expect(mod.loaders.sort()).toEqual(["fabric", "forge"]);
    expect(mod.gameVersions.sort()).toEqual(["1.20.1", "1.21"]);
    expect(mod.links.modrinth).toBeTruthy();
    expect(mod.links.curseforge).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- sources/index`
Expected: FAIL — cannot find module `@/lib/sources/index`.

- [ ] **Step 4: Implement `lib/sources/index.ts`**

```ts
import type { CuratedMod, Enrichment, Mod, ModSource } from "@/lib/sources/types";
import { modrinthSource } from "@/lib/sources/modrinth";
import { curseforgeSource } from "@/lib/sources/curseforge";

/** Build the active source list. Modrinth always; CurseForge only when keyed. */
export function getSources(): ModSource[] {
  const sources: ModSource[] = [modrinthSource];
  const key = process.env.CURSEFORGE_API_KEY;
  if (key) sources.push(curseforgeSource(key));
  return sources;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Combine curated mods with enrichment maps (one per source, in priority order).
 * Loaders/versions/dependencies are union-merged; links prefer earlier sources.
 */
export function mergeEnrichment(
  curated: CuratedMod[],
  enrichments: Map<string, Enrichment>[]
): Mod[] {
  return curated.map((m) => {
    const found = enrichments
      .map((e) => e.get(m.id))
      .filter((e): e is Enrichment => Boolean(e));

    const loaders = uniq(found.flatMap((e) => e.loaders));
    const gameVersions = uniq(found.flatMap((e) => e.gameVersions));
    const dependencies = found.flatMap((e) => e.dependencies);
    const links: Mod["links"] = {};
    for (const e of found) {
      if (!links.modrinth && e.links.modrinth) links.modrinth = e.links.modrinth;
      if (!links.curseforge && e.links.curseforge) links.curseforge = e.links.curseforge;
    }
    const downloads = found.reduce<number | undefined>(
      (max, e) => (e.downloads != null ? Math.max(max ?? 0, e.downloads) : max),
      undefined
    );
    const iconUrl = found.find((e) => e.iconUrl)?.iconUrl;

    return { ...m, loaders, gameVersions, dependencies, links, downloads, iconUrl };
  });
}

/** Fetch enrichment from all active sources and merge into the curated catalog. */
export async function enrichCatalog(curated: CuratedMod[]): Promise<Mod[]> {
  const sources = getSources();
  const results = await Promise.all(
    sources.map((s) => s.enrich(curated).catch(() => new Map<string, Enrichment>()))
  );
  return mergeEnrichment(curated, results);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- sources/index`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/sources/curseforge.ts lib/sources/index.ts lib/sources/index.test.ts
git commit -m "feat: merge sources with graceful CurseForge fallback"
```

---

## Task 8: Serverless proxy route

Exposes the enriched catalog at `GET /api/mods`, the only network-touching module.

**Files:**
- Create: `app/api/mods/route.ts`

- [ ] **Step 1: Implement `app/api/mods/route.ts`**

```ts
import { NextResponse } from "next/server";
import { CATALOG } from "@/lib/curation/catalog";
import { enrichCatalog } from "@/lib/sources/index";

// Cache the enriched response at the edge for an hour; refresh in the background.
export const revalidate = 3600;

export async function GET() {
  try {
    const mods = await enrichCatalog(CATALOG);
    return NextResponse.json({ mods, count: mods.length });
  } catch {
    // Last-resort fallback: serve curated data with empty live fields.
    const mods = CATALOG.map((m) => ({
      ...m,
      loaders: [],
      gameVersions: [],
      dependencies: [],
      links: {}
    }));
    return NextResponse.json({ mods, count: mods.length, degraded: true }, { status: 200 });
  }
}
```

- [ ] **Step 2: Verify the endpoint returns live-enriched data**

Run: `npm run dev`
Then in another terminal: `curl -s http://localhost:3000/api/mods | head -c 600`
Expected: JSON with `mods` array; entries for Modrinth-known slugs (e.g. `sodium`) include non-empty `loaders` (e.g. `["fabric",...]`) and `gameVersions`, plus a `links.modrinth` URL. If Modrinth is unreachable, you get `"degraded": true` with curated fields only — both are acceptable.

- [ ] **Step 3: Build to confirm no type/route errors**

Run: `npm run build`
Expected: build succeeds and lists the `/api/mods` route.

- [ ] **Step 4: Commit**

```bash
git add app/api/mods/route.ts
git commit -m "feat: add serverless /api/mods proxy with caching and fallback"
```

---

## Task 9: Update tracking docs & close out Plan 1

**Files:**
- Modify: `PROJECT_PROGRESS.md`

- [ ] **Step 1: Add a milestone entry to the top of `PROJECT_PROGRESS.md`**

```markdown
## 2026-06-14 — Plan 1 complete: Foundation & Data Layer
- Next.js + TS + Vitest scaffolded; Full Hearts landing ported and reframed to the quiz.
- Curation taxonomy (`lib/curation/tags.ts`) + seed catalog (`lib/curation/catalog.ts`, ~20 mods).
- Pluggable source layer: Modrinth adapter + CurseForge stub, merged with graceful fallback.
- Serverless `/api/mods` proxy returns live-enriched, cached catalog.
- Tests: tags, catalog integrity, Modrinth normalization, source merge — all passing.

Next: Plan 2 — Engine, Quiz & Results.
```

- [ ] **Step 2: Run the full test suite and build once more**

Run: `npm test && npm run build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add PROJECT_PROGRESS.md
git commit -m "docs: record Plan 1 completion"
```

---

## Self-review notes

- **Spec coverage (Plan 1 portion):** scaffold + landing (spec §3, build-order 1) ✓; pluggable sources + Modrinth + CurseForge fallback (§2.1, §2.3, §3) ✓; serverless proxy + cache + resilience (§3, §9) ✓; curation taxonomy + seed catalog (§2.4, §4, build-order 3) ✓; unified `Mod`/`Dependency` types (§4) ✓; testing (§10) ✓. Engine, quiz, results, collections are intentionally Plan 2/3.
- **Dependencies note:** `normalizeDependencies` is implemented and tested but not yet wired into `/api/mods` (project-level enrichment is enough for the data layer; per-version dependency fetch + name resolution is wired when results need it in Plan 2). This is deliberate, not a gap.
- **Type consistency:** `CuratedMod`, `Mod`, `Enrichment`, `Dependency`, `Loader`, `Tag` are defined once in `types.ts`/`tags.ts` and reused everywhere; `enrich()` returns `Map<string, Enrichment>` consistently across `modrinth.ts`, `curseforge.ts`, and `index.ts`.
- **Placeholder scan:** the CSS port (Task 1 Step 5) references existing `index.html` line ranges rather than re-pasting ~190 lines — intentional to avoid divergence; all net-new code is shown in full.
