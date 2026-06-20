// scripts/gen-coverage.mjs
// Regenerate lib/catalog/coverage.snapshot.json from the live pool.
// Run with: npm run gen:coverage
import { writeFileSync } from "node:fs";

const API = "https://api.modrinth.com/v2";
const UA = "FullHearts/0.1 (github.com/YatoVoid/FullHearts)";
const LOADERS = ["forge", "neoforge", "fabric", "quilt"];
const VERSIONS = ["1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.1", "1.19.4", "1.19.2", "1.18.2", "1.16.5", "1.12.2"];
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
