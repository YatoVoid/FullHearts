"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import { TAGS, TAG_LABELS, type Tag } from "@/lib/curation/tags";
import { useCollectionTarget } from "@/lib/storage/useCollectionTarget";
import { loadPool } from "@/lib/catalog/clientPool";
import { searchModrinthQuery, fetchModsBySlugs } from "@/lib/sources/modrinth";
import { modBuildsFor } from "@/lib/modpack/mrpack";
import { isHighQuality } from "@/lib/catalog/quality";
import { type ModFilter, DEFAULT_FILTER, loadFilter, saveFilter, matchesFilter, versionOptions } from "@/lib/catalog/filter";
import { HEART_SRC } from "@/lib/asset";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";
import ModCard from "@/components/ModCard";
import ModFilterBar from "@/components/ModFilterBar";
import CollectionPicker from "@/components/CollectionPicker";
import ScrollTop from "@/components/ScrollTop";

const MIN_SECTION = 4;     // a tag needs this many mods to get a section
const PER_SECTION = 18;    // cap cards shown per section

// Requests go to the repo's issue tracker: a private-to-owner review queue, no
// backend and no auto-publishing, so the "only tested mods" promise holds.
function requestUrl(q: string): string {
  const title = encodeURIComponent(`Mod request: ${q}`);
  const body = encodeURIComponent(
    `A visitor searched for "${q}" on fullhearts.app and found no match.\n\n` +
      `If this is a high-quality, well-tested mod, consider reviewing and adding it to the catalog.`
  );
  return `https://github.com/YatoVoid/FullHearts/issues/new?title=${title}&body=${body}&labels=mod-request`;
}

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

interface Section {
  tag: Tag;
  label: string;
  mods: Mod[];
  total: number;
}

/** Group the pool into a section per tag with enough members, sorted by size. */
function buildSections(mods: Mod[]): Section[] {
  const sections: Section[] = [];
  for (const tag of TAGS) {
    const matches = mods
      .filter((m) => (m.curatedTags[tag] ?? 0) >= 0.5)
      .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    if (matches.length >= MIN_SECTION) {
      sections.push({ tag, label: TAG_LABELS[tag], total: matches.length, mods: matches.slice(0, PER_SECTION) });
    }
  }
  return sections.sort((a, b) => b.total - a.total);
}

export default function Explore() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const { collections, targetId, selectTarget, createAndSelect, addToTarget, removeFromTarget, added } = useCollectionTarget();
  const [showTarget, setShowTarget] = useState(false);
  const [addBusy, setAddBusy] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModFilter>(DEFAULT_FILTER);
  const [live, setLive] = useState<Mod[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [qualityOn, setQualityOn] = useState(true);

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

  const versions = useMemo(() => versionOptions(mods), [mods]);
  // Only mods that work with the chosen loader + version feed the whole page.
  const pool = useMemo(() => mods.filter((m) => matchesFilter(m, filter)), [mods, filter]);

  const sections = useMemo(() => buildSections(pool), [pool]);

  const term = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!term) return null;
    return pool
      .filter((m) => m.name.toLowerCase().includes(term) || (m.summary ?? "").toLowerCase().includes(term))
      .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
  }, [term, pool]);

  // Live Modrinth fallback: find specific mods our library doesn't have.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setLive([]); return; }
    let cancelled = false;
    setLiveLoading(true);
    const t = setTimeout(async () => {
      const hits = await searchModrinthQuery(q, {
        loader: filter.loader === "all" ? undefined : filter.loader,
        version: filter.version === "all" ? undefined : filter.version
      });
      if (cancelled) return;
      // Drop anything already in our library (by id/slug) to avoid duplicates.
      const known = new Set<string>();
      for (const m of mods) { known.add(m.id); if (m.modrinthSlug) known.add(m.modrinthSlug); }
      setLive(hits.filter((m) => !known.has(m.id) && !known.has(m.modrinthSlug ?? "")));
      setLiveLoading(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, filter, mods]);

  const liveShown = useMemo(
    () => (qualityOn ? live.filter(isHighQuality) : live),
    [live, qualityOn]
  );
  const liveHidden = live.length - liveShown.length;

  function toggleQuality() {
    if (qualityOn) {
      const ok = window.confirm(
        "Turn off the quality filter?\n\nThis shows every mod on Modrinth, including untested, niche, or abandoned ones. Only recommended if you know the exact mod you want."
      );
      if (!ok) return;
      setQualityOn(false);
    } else {
      setQualityOn(true);
    }
  }

  const target = collections.find((c) => c.id === targetId);

  // The target collection may hold mods not in the curated pool (added via live
  // search). Resolve those from Modrinth so the add-guard sees their real
  // loader/version and blocks incompatible additions.
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

  // The collection LOCKS to the loader + version the user explicitly chose
  // (stored on the collection), never re-derived from the mods themselves.
  const lock = target?.loader && target?.gameVersion ? { loader: target.loader, version: target.gameVersion } : null;

  // Adding to a collection with no chosen loader/version yet: the user must pick
  // one first (adding under "All" is meaningless — which version is it for?).
  const needsChoice = Boolean(target) && !lock && (filter.loader === "all" || filter.version === "all");

  // Once locked, force the filter to the collection's loader + version.
  useEffect(() => {
    if (!lock) return;
    if (filter.loader !== lock.loader || filter.version !== lock.version) {
      setFilter({ loader: lock.loader, version: lock.version });
    }
  }, [lock, filter.loader, filter.version]);

  function changeFilter(f: ModFilter) {
    if (lock) return; // locked to the collection's loader/version; ignore changes
    setFilter(f);
    saveFilter(f);
  }

  // A mod fits the target if it supports the locked loader + version.
  const isCompatibleWithTarget = (mod: Mod) =>
    !lock || (mod.loaders.includes(lock.loader) && mod.gameVersions.includes(lock.version));

  async function handleAdd(modId: string) {
    const loaderSel = lock?.loader ?? (filter.loader !== "all" ? filter.loader : undefined);
    const versionSel = lock?.version ?? (filter.version !== "all" ? filter.version : undefined);
    // VERIFY the mod actually has a jar for this exact loader + version before it
    // can enter the collection — Modrinth's project tags lie (a "Forge 1.21.1"
    // mod may only have a NeoForge 1.21.1 build), and the user must never end up
    // with mods that won't run.
    if (loaderSel && versionSel) {
      const mod = [...mods, ...live, ...Object.values(extraTargetMods)].find((m) => m.id === modId);
      if (mod) {
        setAddError("");
        setAddBusy(modId);
        const ok = await modBuildsFor(mod, loaderSel, versionSel);
        setAddBusy(null);
        if (!ok) {
          setAddError(`${mod.name} has no ${loaderSel.charAt(0).toUpperCase() + loaderSel.slice(1)} ${versionSel} build — not added.`);
          return;
        }
      }
    }
    addToTarget(modId, loaderSel && versionSel ? { loader: loaderSel, version: versionSel } : undefined);
  }

  const card = (mod: Mod, i: number) => (
    <ModCard
      key={mod.id}
      mod={mod}
      i={i}
      added={added.has(mod.id)}
      disabled={needsChoice || addBusy === mod.id || (!added.has(mod.id) && !isCompatibleWithTarget(mod))}
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
            <Link href="/quiz">Quiz</Link>
            <Link href="/collections">Collections</Link>
          </nav>
          <Link className="nav-cta" href="/quiz">Start the quiz</Link>
        </div>
      </header>

      <main className="explore">
        <div className="section-head">
          <div className="eyebrow">BROWSE BY THEME</div>
          <h2>Explore the mod library</h2>
        </div>

        <div className="lucky-bar">
          <Link className="btn-primary" href="/results?lucky=1">🎲 I&apos;m feeling lucky</Link>
        </div>

        {status === "ready" && (
          <>
            <CollectionPicker collections={collections} targetId={targetId} onSelect={selectTarget} onCreate={(n) => createAndSelect(n)} />
            {addBusy && <p className="add-feedback checking" role="status">Checking this mod builds for your loadout…</p>}
            {addError && <p className="add-feedback err" role="alert">{addError}</p>}
            {target && target.modIds.length > 0 && (
              <div className="target-mods">
                <button type="button" className="btn-ghost target-mods-toggle" onClick={() => setShowTarget((s) => !s)}>
                  {showTarget ? "▾ Hide" : "▸ View"} {target.modIds.length} mod{target.modIds.length === 1 ? "" : "s"} in “{target.name}”
                </button>
                {showTarget && (
                  <ul className="target-mods-list">
                    {targetMods.map((m) => (
                      <li key={m.id}>
                        <span>{m.name}</span>
                        <button type="button" className="x-btn" aria-label={`Remove ${m.name}`} onClick={() => removeFromTarget(m.id)}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {needsChoice && (
              <p className="filter-prompt" role="status">
                Pick a mod loader and Minecraft version for <b>{target?.name}</b> before adding mods — that&apos;s what the pack is built for.
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
            <div className="explore-search">
              <input
                type="search"
                className="explore-search-input"
                placeholder="Search mods by name or description…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search mods"
              />
              {query && (
                <button type="button" className="explore-search-clear" onClick={() => setQuery("")} aria-label="Clear search">×</button>
              )}
            </div>
          </>
        )}

        {status === "loading" && <p className="results-state">Loading the library…</p>}
        {status === "error" && <p className="results-state">Couldn&apos;t load the library. Please refresh.</p>}

        {status === "ready" && matches && (
          <>
            <div className="row-head">
              <h2>From our tested library</h2>
              <span className="count">{matches.length} match{matches.length === 1 ? "" : "es"}</span>
            </div>
            {matches.length === 0 ? (
              <p className="results-state">Nothing in our tested library matches “{query}”. Checking Modrinth below.</p>
            ) : (
              <div className="grid">{matches.map((mod, i) => card(mod, i))}</div>
            )}

            {/* Live Modrinth fallback for specific mods we don't curate */}
            <div className="row-head" style={{ marginTop: 40 }}>
              <h2>More from Modrinth</h2>
              <label className="quality-toggle">
                <input type="checkbox" checked={qualityOn} onChange={toggleQuality} />
                High-quality only
              </label>
            </div>
            {liveLoading ? (
              <p className="results-state">Searching Modrinth…</p>
            ) : liveShown.length > 0 ? (
              <>
                <div className="grid">{liveShown.map((mod, i) => card(mod, i))}</div>
                {qualityOn && liveHidden > 0 && (
                  <p className="request-note" style={{ textAlign: "center", marginTop: 14 }}>
                    {liveHidden} lower-quality match{liveHidden === 1 ? "" : "es"} hidden. Untick “High-quality only” to see {liveHidden === 1 ? "it" : "them"}.
                  </p>
                )}
              </>
            ) : live.length > 0 && qualityOn ? (
              <p className="results-state">
                No high-quality Modrinth matches. <button type="button" className="linklike" onClick={toggleQuality}>Show all matches</button> (not recommended).
              </p>
            ) : (
              <div className="no-results">
                <p className="results-state">No Modrinth mods match “{query}” for this loader/version.</p>
                <a className="btn-ghost" href={requestUrl(query)} target="_blank" rel="noopener noreferrer">
                  ＋ Request “{query}” be added
                </a>
                <p className="request-note">We review every request by hand and only add mods that meet the bar.</p>
              </div>
            )}
          </>
        )}

        {status === "ready" && !matches && sections.length === 0 && (
          <p className="results-state">
            No mods match this loader/version yet. Try <button type="button" className="linklike" onClick={() => changeFilter(DEFAULT_FILTER)}>clearing the filter</button>.
          </p>
        )}

        {status === "ready" && !matches && sections.length > 0 && (
          <>
            <nav className="tag-nav" aria-label="Jump to a category">
              {sections.map((s) => (
                <a key={s.tag} href={`#tag-${s.tag}`}>{s.label}</a>
              ))}
            </nav>

            {sections.map((section) => (
              <section className="explore-section" id={`tag-${section.tag}`} key={section.tag}>
                <div className="row-head">
                  <h2>{section.label}</h2>
                  <div className="row-head-right">
                    <span className="count">{section.total} mods</span>
                    {section.total > PER_SECTION && (
                      <Link className="show-all" href={`/explore/${section.tag}`}>Show all →</Link>
                    )}
                  </div>
                </div>
                <div className="grid">
                  {section.mods.map((mod, i) => card(mod, i))}
                </div>
              </section>
            ))}
            <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE || "4157773400"} />
          </>
        )}
      </main>

      <ScrollTop />
      <Footer />
    </>
  );
}
