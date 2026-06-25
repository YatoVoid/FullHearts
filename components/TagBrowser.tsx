"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import { TAG_LABELS, type Tag } from "@/lib/curation/tags";
import { useCollectionTarget } from "@/lib/storage/useCollectionTarget";
import { loadPool } from "@/lib/catalog/clientPool";
import { fetchModsBySlugs, searchModrinthCategory, searchModrinthQuery } from "@/lib/sources/modrinth";
import { modBuildsFor } from "@/lib/modpack/mrpack";
import { type ModFilter, DEFAULT_FILTER, loadFilter, saveFilter, matchesFilter, versionOptions } from "@/lib/catalog/filter";
import { useDialog } from "@/components/useDialog";
import { HEART_SRC } from "@/lib/asset";
import Footer from "@/components/Footer";
import ModCard from "@/components/ModCard";
import ModFilterBar from "@/components/ModFilterBar";
import CollectionPicker from "@/components/CollectionPicker";
import ScrollTop from "@/components/ScrollTop";

const MATCH_THRESHOLD = 0.5; // same bar Explore uses to place a mod in a tag

// What to pull live for "show more" per tag. Most tags map to a Modrinth
// category; visuals and cozy aren't categories (shaders/resource packs are their
// own project types) so they fall back to a text query — the "logic differs by
// sub-category" case.
const LIVE_CATEGORY: Partial<Record<Tag, string>> = {
  performance: "optimization",
  interface: "utility",
  building: "decoration",
  exploration: "adventure",
  automation: "technology",
  tech: "technology",
  magic: "magic",
  combat: "equipment",
  rpg: "adventure",
  coop: "social",
  structures: "worldgen",
  biome: "worldgen",
  mobs: "mobs",
  food: "food",
  qol: "utility"
};
const LIVE_QUERY: Partial<Record<Tag, string>> = {
  visual: "shaders",
  "low-grind": "cozy"
};

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

/** Full listing of every mod in a single tag (no per-section cap). */
export default function TagBrowser({ tag }: { tag: Tag }) {
  const [mods, setMods] = useState<Mod[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const { collections, targetId, selectTarget, createAndSelect, addToTarget, removeFromTarget, added } = useCollectionTarget();
  const { confirm: askConfirm, dialog } = useDialog();
  const [addBusy, setAddBusy] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [filter, setFilter] = useState<ModFilter>(DEFAULT_FILTER);
  const [qualityOn, setQualityOn] = useState(true);
  const [live, setLive] = useState<Mod[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    setFilter(loadFilter());
    let cancelled = false;
    (async () => {
      try {
        const data = await loadPool();
        if (cancelled) return;
        setMods(data);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function changeFilter(f: ModFilter) {
    if (lock) return; // locked to the collection's loader/version
    setFilter(f);
    saveFilter(f);
  }

  const versions = useMemo(() => versionOptions(mods), [mods]);

  const target = collections.find((c) => c.id === targetId);

  // Resolve target collection mods missing from the curated pool (added via live
  // search) so the add-guard blocks incompatible additions.
  const [extraTargetMods, setExtraTargetMods] = useState<Record<string, Mod>>({});
  useEffect(() => {
    if (!target) return;
    const missing = target.modIds.filter((id) => !mods.some((m) => m.id === id) && !extraTargetMods[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    fetchModsBySlugs(missing).then((ms) => {
      if (!cancelled && ms.length) setExtraTargetMods((prev) => ({ ...prev, ...Object.fromEntries(ms.map((m) => [m.id, m])) }));
    });
    return () => { cancelled = true; };
  }, [target, mods, extraTargetMods]);

  const targetMods = useMemo(
    () => target ? target.modIds.map((id) => mods.find((m) => m.id === id) ?? extraTargetMods[id]).filter((m): m is Mod => Boolean(m)) : [],
    [mods, target, extraTargetMods]
  );

  // Lock to the user's explicitly chosen loader + version (stored on the
  // collection), never re-derived from the mods.
  const lock = target?.loader && target?.gameVersion ? { loader: target.loader, version: target.gameVersion } : null;

  const needsChoice = Boolean(target) && !lock && (filter.loader === "all" || filter.version === "all");

  useEffect(() => {
    if (!lock) return;
    if (filter.loader !== lock.loader || filter.version !== lock.version) {
      setFilter({ loader: lock.loader, version: lock.version });
    }
  }, [lock, filter.loader, filter.version]);

  const isCompatibleWithTarget = (mod: Mod) =>
    !lock || (mod.loaders.includes(lock.loader) && mod.gameVersions.includes(lock.version));

  // Loader/version not chosen yet -> Add scrolls back up to the picker and flashes it.
  const chooserRef = useRef<HTMLDivElement>(null);
  const [flashChooser, setFlashChooser] = useState(false);
  function requireChoice() {
    chooserRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashChooser(true);
    window.setTimeout(() => setFlashChooser(false), 1600);
  }

  async function handleAdd(modId: string) {
    if (needsChoice) { requireChoice(); return; }
    const loaderSel = lock?.loader ?? (filter.loader !== "all" ? filter.loader : undefined);
    const versionSel = lock?.version ?? (filter.version !== "all" ? filter.version : undefined);
    // Verify a real jar exists for this loader+version before adding (project tags lie).
    if (loaderSel && versionSel) {
      const mod = [...mods, ...live, ...Object.values(extraTargetMods)].find((m) => m.id === modId);
      if (mod) {
        setAddError("");
        setAddBusy(modId);
        const ok = await modBuildsFor(mod, loaderSel, versionSel);
        setAddBusy(null);
        if (!ok) {
          setAddError(`${mod.name} has no ${loaderSel.charAt(0).toUpperCase() + loaderSel.slice(1)} ${versionSel} build, so it wasn't added.`);
          return;
        }
      }
    }
    addToTarget(modId, loaderSel && versionSel ? { loader: loaderSel, version: versionSel } : undefined);
  }

  const inTag = useMemo(
    () =>
      mods
        .filter((m) => (m.curatedTags[tag] ?? 0) >= MATCH_THRESHOLD && matchesFilter(m, filter))
        .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0)),
    [mods, tag, filter]
  );

  // When the quality filter is off, pull lesser-known mods for this category live
  // from Modrinth — the curated pool only carries the most popular ones, so this
  // is what actually fills out thin categories on demand.
  useEffect(() => {
    if (qualityOn) { setLive([]); return; }
    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      const o = {
        loader: filter.loader === "all" ? undefined : filter.loader,
        version: filter.version === "all" ? undefined : filter.version,
        limit: 100
      };
      const cat = LIVE_CATEGORY[tag];
      const hits = cat ? await searchModrinthCategory(cat, o) : await searchModrinthQuery(LIVE_QUERY[tag] ?? tag, o);
      if (cancelled) return;
      setLive(hits);
      setLiveLoading(false);
    })();
    return () => { cancelled = true; };
  }, [qualityOn, tag, filter]);

  // Live mods not already shown from the curated pool, respecting the loader/version.
  const extra = useMemo(() => {
    if (qualityOn) return [];
    const known = new Set<string>();
    for (const m of inTag) { known.add(m.id); if (m.modrinthSlug) known.add(m.modrinthSlug); }
    return live.filter((m) => !known.has(m.id) && !known.has(m.modrinthSlug ?? "") && matchesFilter(m, filter));
  }, [live, inTag, qualityOn, filter]);

  async function toggleQuality() {
    if (qualityOn) {
      const ok = await askConfirm({
        title: "Turn off the quality filter?",
        body: "This shows lesser-known mods in this category, including untested, niche, or abandoned ones. Great for digging deeper, but less guaranteed to work cleanly.",
        confirmLabel: "Show more mods",
        icon: "alert"
      });
      if (!ok) return;
      setQualityOn(false);
    } else {
      setQualityOn(true);
    }
  }

  const card = (mod: Mod, i: number) => (
    <ModCard
      key={mod.id}
      mod={mod}
      i={i}
      added={added.has(mod.id)}
      disabled={addBusy === mod.id || (!added.has(mod.id) && !isCompatibleWithTarget(mod))}
      onAdd={handleAdd}
      onRemove={removeFromTarget}
    />
  );

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <nav className="links">
            <Link href="/explore">Explore</Link>
            <Link href="/collections">Collections</Link>
          </nav>
          <Link className="nav-cta" href="/quiz">Start the quiz</Link>
        </div>
      </header>

      <main className="explore">
        <div className="section-head">
          <div className="eyebrow"><Link href="/explore" style={{ color: "var(--grass)" }}>← All themes</Link></div>
          <h2>{TAG_LABELS[tag]}</h2>
        </div>

        {status === "loading" && <p className="results-state">Loading mods…</p>}
        {status === "error" && <p className="results-state">Couldn&apos;t load the library. Please refresh.</p>}

        {status === "ready" && (
          <>
            <CollectionPicker collections={collections} targetId={targetId} onSelect={selectTarget} onCreate={(n) => createAndSelect(n)} />
            <div ref={chooserRef} className={`explore-chooser${flashChooser ? " flash" : ""}`}>
              {needsChoice && (
                <p className="filter-prompt" role="status">
                  Pick a mod loader and Minecraft version for <b>{target?.name}</b> before adding mods. That&apos;s what the pack is built for.
                </p>
              )}
              <ModFilterBar
                filter={filter}
                versions={versions}
                onChange={changeFilter}
                lockLoader={lock?.loader}
                lockVersion={lock?.version}
                needLoader={needsChoice && filter.loader === "all"}
                needVersion={needsChoice && filter.version === "all"}
              />
            </div>
            {addBusy && <p className="add-feedback checking" role="status">Checking this mod builds for your loadout…</p>}
            {addError && <p className="add-feedback err" role="alert">{addError}</p>}
            <div className="row-head">
              <h2>{TAG_LABELS[tag]}</h2>
              <div className="row-head-right">
                <span className="count">{inTag.length}{!qualityOn && extra.length > 0 ? ` + ${extra.length}` : ""} mods</span>
                <label className="quality-toggle">
                  <input type="checkbox" checked={qualityOn} onChange={toggleQuality} />
                  High-quality only
                </label>
              </div>
            </div>
            {inTag.length === 0 && extra.length === 0 && !liveLoading ? (
              <p className="results-state">No mods match this loader/version in this theme.</p>
            ) : (
              <div className="grid">
                {inTag.map((mod, i) => card(mod, i))}
                {extra.map((mod, i) => card(mod, inTag.length + i))}
              </div>
            )}
            {liveLoading && <p className="results-state">Finding more mods on Modrinth…</p>}
          </>
        )}
      </main>

      <ScrollTop />
      <Footer />
      {dialog}
    </>
  );
}
