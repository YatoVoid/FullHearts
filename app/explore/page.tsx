"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import { TAGS, TAG_LABELS, type Tag } from "@/lib/curation/tags";
import { ensureCollection, addMod } from "@/lib/storage/collections";
import { setLastCollectionId } from "@/lib/storage/user";
import { loadPool } from "@/lib/catalog/clientPool";
import { HEART_SRC } from "@/lib/asset";
import Footer from "@/components/Footer";
import AdSlot from "@/components/AdSlot";

const DEFAULT_COLLECTION = "My loadout";
const MIN_SECTION = 4;     // a tag needs this many mods to get a section
const PER_SECTION = 18;    // cap cards shown per section
const RARITY = ["r-epic", "r-rare", "r-uncommon", "r-common"];

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
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
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

  const sections = useMemo(() => buildSections(mods), [mods]);

  const term = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!term) return null;
    return mods
      .filter((m) => m.name.toLowerCase().includes(term) || (m.summary ?? "").toLowerCase().includes(term))
      .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
  }, [term, mods]);

  function add(modId: string) {
    const collection = ensureCollection(DEFAULT_COLLECTION);
    addMod(collection.id, modId);
    setLastCollectionId(collection.id);
    setAdded((prev) => new Set(prev).add(modId));
  }

  const card = (mod: Mod, i: number) => (
    <article className={`tip ${RARITY[i % RARITY.length]}`} key={mod.id}>
      <div className="row1">
        {mod.iconUrl && <img className="tip-icon" src={mod.iconUrl} alt="" loading="lazy" />}
        <span className="title">{mod.name}</span>
      </div>
      <div className="badges">
        {mod.loaders.slice(0, 3).map((l) => <span className="badge" key={l}>{l.toUpperCase()}</span>)}
      </div>
      <p className="desc">{mod.summary}</p>
      <div className="tip-links">
        <button
          type="button"
          className={`add-btn${added.has(mod.id) ? " added" : ""}`}
          onClick={() => add(mod.id)}
          disabled={added.has(mod.id)}
        >
          {added.has(mod.id) ? "Added ✓" : "+ Add"}
        </button>
        {mod.links.modrinth && (
          <a href={mod.links.modrinth} target="_blank" rel="noopener noreferrer">Modrinth</a>
        )}
      </div>
    </article>
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
        )}

        {status === "loading" && <p className="results-state">Loading the library…</p>}
        {status === "error" && <p className="results-state">Couldn&apos;t load the library. Please refresh.</p>}

        {status === "ready" && matches && (
          <>
            <div className="row-head">
              <h2>Search results</h2>
              <span className="count">{matches.length} match{matches.length === 1 ? "" : "es"}</span>
            </div>
            {matches.length === 0 ? (
              <div className="no-results">
                <p className="results-state">No mods match “{query}”. Try a different word.</p>
                <a className="btn-ghost" href={requestUrl(query)} target="_blank" rel="noopener noreferrer">
                  ＋ Request “{query}” be added
                </a>
                <p className="request-note">We review every request by hand and only add mods that meet the bar.</p>
              </div>
            ) : (
              <div className="grid">{matches.map((mod, i) => card(mod, i))}</div>
            )}
          </>
        )}

        {status === "ready" && !matches && (
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
                  <span className="count">{section.total} mods</span>
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

      <Footer />
    </>
  );
}
