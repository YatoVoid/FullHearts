// scripts/gen-coverage.mjs
// Regenerate lib/catalog/coverage.snapshot.json with REAL per-build counts.
// Run with: npm run gen:coverage
//
// The naive approach (count a project for loader L + version V whenever its
// project-level loader list contains L and its version list contains V) badly
// OVER-COUNTS: Create has a Forge build (on 1.20.1) and a 1.21.1 build (on
// NeoForge), so it falsely counts as "Forge 1.21.1" even though no such jar
// exists. That made Forge 1.21.1 look rich and steered users into a gutted pack.
// Here we fetch each project's actual versions and only count a (loader,version)
// pair when a SINGLE version declares both — i.e. a real, downloadable build.
import { writeFileSync } from "node:fs";

const API = "https://api.modrinth.com/v2";
const UA = "FullHearts/0.1 (github.com/YatoVoid/FullHearts)";
const LOADERS = ["forge", "neoforge", "fabric", "quilt"];
const VERSIONS = ["1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.1", "1.19.4", "1.19.2", "1.18.2", "1.16.5", "1.12.2"];
const FACETS = [null, "optimization", "worldgen", "magic", "technology", "adventure", "mobs", "food", "utility", "decoration"];

async function getJSON(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { "User-Agent": UA } });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, (Number(res.headers.get("Retry-After")) || 2) * 1000)); continue; }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

async function searchOne(category) {
  const facets = category ? `[["project_type:mod"],["categories:${category}"]]` : `[["project_type:mod"]]`;
  const json = await getJSON(`/search?limit=60&index=downloads&facets=${encodeURIComponent(facets)}`);
  return json?.hits ?? [];
}

// Collect a deduped pool of slugs to measure (the same set the app's pool draws from).
const slugs = new Set();
for (const c of FACETS) for (const hit of await searchOne(c)) slugs.add(hit.slug);
console.log(`Measuring ${slugs.size} projects for real per-build coverage…`);

const cov = {};
for (const L of LOADERS) { cov[L] = {}; for (const V of VERSIONS) cov[L][V] = 0; }

const all = [...slugs];
for (let i = 0; i < all.length; i += 6) {
  const batch = all.slice(i, i + 6);
  await Promise.all(batch.map(async (slug) => {
    const versions = await getJSON(`/project/${encodeURIComponent(slug)}/version`);
    if (!Array.isArray(versions)) return;
    // For each loader+version, true only if SOME single version supports both.
    for (const L of LOADERS) {
      for (const V of VERSIONS) {
        if (versions.some((v) => (v.loaders ?? []).includes(L) && (v.game_versions ?? []).includes(V))) cov[L][V]++;
      }
    }
  }));
}

writeFileSync(
  new URL("../lib/catalog/coverage.snapshot.json", import.meta.url),
  JSON.stringify(cov, null, 2) + "\n"
);
console.log("Wrote coverage snapshot:", JSON.stringify(cov));
