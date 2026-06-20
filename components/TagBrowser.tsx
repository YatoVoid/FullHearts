"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import { TAG_LABELS, type Tag } from "@/lib/curation/tags";
import { useCollectionTarget } from "@/lib/storage/useCollectionTarget";
import { loadPool } from "@/lib/catalog/clientPool";
import { fetchModsBySlugs } from "@/lib/sources/modrinth";
import { type ModFilter, DEFAULT_FILTER, loadFilter, saveFilter, matchesFilter, versionOptions } from "@/lib/catalog/filter";
import { HEART_SRC } from "@/lib/asset";
import Footer from "@/components/Footer";
import ModCard from "@/components/ModCard";
import ModFilterBar from "@/components/ModFilterBar";
import CollectionPicker from "@/components/CollectionPicker";
import ScrollTop from "@/components/ScrollTop";

const MATCH_THRESHOLD = 0.5; // same bar Explore uses to place a mod in a tag

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
  const [filter, setFilter] = useState<ModFilter>(DEFAULT_FILTER);

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

  function handleAdd(modId: string) {
    const loadout = filter.loader !== "all" && filter.version !== "all" ? { loader: filter.loader, version: filter.version } : undefined;
    addToTarget(modId, loadout);
  }

  const inTag = useMemo(
    () =>
      mods
        .filter((m) => (m.curatedTags[tag] ?? 0) >= MATCH_THRESHOLD && matchesFilter(m, filter))
        .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0)),
    [mods, tag, filter]
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
            <div className="row-head">
              <h2>{TAG_LABELS[tag]}</h2>
              <span className="count">{inTag.length} mods</span>
            </div>
            {inTag.length === 0 ? (
              <p className="results-state">No mods match this loader/version in this theme.</p>
            ) : (
              <div className="grid">
                {inTag.map((mod, i) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    i={i}
                    added={added.has(mod.id)}
                    disabled={needsChoice || (!added.has(mod.id) && !isCompatibleWithTarget(mod))}
                    onAdd={handleAdd}
                    onRemove={removeFromTarget}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <ScrollTop />
      <Footer />
    </>
  );
}
