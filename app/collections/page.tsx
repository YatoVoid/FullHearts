"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Loader, Mod } from "@/lib/sources/types";
import { loadPool } from "@/lib/catalog/clientPool";
import { fetchModsBySlugs } from "@/lib/sources/modrinth";
import { modBuildsFor } from "@/lib/modpack/mrpack";
import { VERSIONS } from "@/lib/catalog/coverage";
import { checkCompatibility, compatibilitySummary } from "@/lib/recommend/compatibility";
import DownloadPack from "@/components/DownloadPack";
import ServerCta from "@/components/ServerCta";
import {
  listCollections,
  createCollection,
  renameCollection,
  duplicateCollection,
  deleteCollection,
  removeMod,
  setLoadout,
  type Collection
} from "@/lib/storage/collections";
import { encodeCollection, decodeCollection } from "@/lib/storage/share";
import { toJSON, toText } from "@/lib/storage/export";
import { hasLocalStorage } from "@/lib/storage/safe";
import { markVisited } from "@/lib/storage/user";
import { HEART_SRC } from "@/lib/asset";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

const MIGRATE_LOADERS: Loader[] = ["forge", "neoforge", "fabric", "quilt"];
const LOADER_LABEL: Record<Loader, string> = { forge: "Forge", neoforge: "NeoForge", fabric: "Fabric", quilt: "Quilt" };

interface MigrateState {
  collection: Collection;
  version: string | null;            // chosen target MC version (null = still picking)
  checking: boolean;
  results: { loader: Loader; build: Mod[]; miss: Mod[] }[] | null;
  loader: Loader | null;             // chosen target loader
  name: string;
  done: { name: string; migrated: number; dropped: string[] } | null;
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [byId, setById] = useState<Record<string, Mod>>({});
  const [degraded, setDegraded] = useState(false);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [upTarget, setUpTarget] = useState<string | null>(null);
  const [mig, setMig] = useState<MigrateState | null>(null);

  const refresh = useCallback(() => setCollections(listCollections()), []);

  // Migrate flow: after the user picks a target version, check every mod in the
  // collection against all four loaders (real per-build check), so we can
  // recommend the loader that keeps the most mods. Heavy but bounded; deliberate.
  async function runMigrateCheck(c: Collection, version: string) {
    setMig((m) => (m ? { ...m, version, checking: true, results: null, loader: null } : m));
    let resolved = c.modIds.map((id) => byId[id]).filter((x): x is Mod => Boolean(x));
    const missing = c.modIds.filter((id) => !byId[id]);
    if (missing.length) resolved = [...resolved, ...(await fetchModsBySlugs(missing))];

    const results: { loader: Loader; build: Mod[]; miss: Mod[] }[] = [];
    for (const loader of MIGRATE_LOADERS) {
      const build: Mod[] = [];
      const miss: Mod[] = [];
      let q = [...resolved];
      while (q.length) {
        const batch = q.splice(0, 6); // bounded concurrency
        const settled = await Promise.all(batch.map(async (mod) => ({ mod, ok: await modBuildsFor(mod, loader, version) })));
        for (const { mod, ok } of settled) (ok ? build : miss).push(mod);
      }
      results.push({ loader, build, miss });
    }
    const best = results.reduce((a, b) => (b.build.length > a.build.length ? b : a));
    setMig((m) => (m ? { ...m, checking: false, results, loader: best.loader, name: `${c.name} (${version})` } : m));
  }

  function confirmMigrate() {
    if (!mig || !mig.version || !mig.loader || !mig.results) return;
    const res = mig.results.find((r) => r.loader === mig.loader);
    if (!res) return;
    const name = mig.name.trim() || `${mig.collection.name} (${mig.version})`;
    const created = createCollection(name, res.build.map((m) => m.id));
    setLoadout(created.id, mig.loader, mig.version);
    refresh();
    setMig((m) => (m ? { ...m, done: { name, migrated: res.build.length, dropped: res.miss.map((x) => x.name) } } : m));
  }

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Floating "back to this collection's top" arrow: while you're scrolled
  // inside an expanded (long) list, point to the NEAREST expanded collection
  // header above you — not the top of the page.
  useEffect(() => {
    function onScroll() {
      let best: { id: string; top: number } | null = null;
      for (const id of expanded) {
        const el = document.getElementById(`col-${id}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // header scrolled above the viewport, but the card is still on screen
        if (r.top < 8 && r.bottom > 120) {
          if (!best || r.top > best.top) best = { id, top: r.top };
        }
      }
      setUpTarget(best ? best.id : null);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [expanded, collections]);

  const scrollToCollection = useCallback(() => {
    if (!upTarget) return;
    const el = document.getElementById(`col-${upTarget}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: "smooth" });
  }, [upTarget]);

  // Import a shared collection from the URL hash, then load state.
  useEffect(() => {
    markVisited();
    setDegraded(!hasLocalStorage());

    const hash = window.location.hash;
    const match = hash.match(/share=([^&]+)/);
    if (match) {
      const payload = decodeCollection(decodeURIComponent(match[1]));
      if (payload) {
        createCollection(payload.name || "Shared loadout", payload.modIds);
        setNote("Imported a shared collection.");
      }
      history.replaceState(null, "", window.location.pathname);
    }
    refresh();
  }, [refresh]);

  // Resolve mod ids to display names + links from the live catalog.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mods = await loadPool();
        if (cancelled) return;
        setNames(Object.fromEntries(mods.map((m) => [m.id, m.name])));
        setById(Object.fromEntries(mods.map((m) => [m.id, m])));
        setLinks(Object.fromEntries(
          mods
            .map((m) => [m.id, m.links.modrinth || m.links.curseforge] as const)
            .filter((e): e is [string, string] => Boolean(e[1]))
        ));
      } catch {
        // names fall back to ids
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve collection mods the curated pool doesn't carry (added via live
  // search) straight from Modrinth, so they're packed and compatibility-checked
  // instead of silently vanishing from the loadout.
  useEffect(() => {
    const allIds = new Set(collections.flatMap((c) => c.modIds));
    const missing = [...allIds].filter((id) => !byId[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    fetchModsBySlugs(missing).then((mods) => {
      if (cancelled || mods.length === 0) return;
      setById((prev) => ({ ...prev, ...Object.fromEntries(mods.map((m) => [m.id, m])) }));
      setNames((prev) => ({ ...prev, ...Object.fromEntries(mods.map((m) => [m.id, m.name])) }));
      setLinks((prev) => ({
        ...prev,
        ...Object.fromEntries(
          mods.map((m) => [m.id, m.links.modrinth || m.links.curseforge]).filter((e): e is [string, string] => Boolean(e[1]))
        )
      }));
    });
    return () => { cancelled = true; };
  }, [collections, byId]);

  function openAll(c: Collection) {
    for (const id of c.modIds) {
      if (links[id] && /^https?:\/\//.test(links[id])) window.open(links[id], "_blank", "noopener");
    }
  }

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(""), 2500);
  };

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash("Copy failed. Your browser blocked clipboard access.");
    }
  }

  function handleRename(c: Collection) {
    const name = window.prompt("Rename collection", c.name);
    if (name != null) {
      renameCollection(c.id, name);
      refresh();
    }
  }

  function handleDelete(c: Collection) {
    if (window.confirm(`Delete "${c.name}"?`)) {
      deleteCollection(c.id);
      refresh();
    }
  }

  function shareUrl(c: Collection): string {
    const encoded = encodeCollection({ name: c.name, modIds: c.modIds });
    return `${window.location.origin}/collections#share=${encoded}`;
  }

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
            <Link href="/quiz">Quiz</Link>
          </nav>
          <Link className="nav-cta" href="/explore">Add more mods</Link>
        </div>
      </header>

      <main className="collections">
        <div className="section-head">
          <div className="eyebrow">YOUR COLLECTIONS</div>
          <h2>Saved loadouts</h2>
        </div>

        <div className="lucky-bar">
          <Link className="btn-ghost" href="/install">📦 How to install a whole loadout at once →</Link>
        </div>

        {degraded && (
          <p className="degraded-note">Private browsing: collections are kept only for this session.</p>
        )}
        <p className="copied-note" role="status">{note}</p>

        {collections.length === 0 ? (
          <p className="results-state">
            No collections yet. <Link href="/quiz" style={{ color: "var(--grass)" }}>Take the quiz</Link> and save your first loadout.
          </p>
        ) : (
          collections.map((c) => (
            <section className="col-card" id={`col-${c.id}`} key={c.id}>
              <div className="col-head">
                <h3>{c.name}</h3>
                <div className="col-actions">
                  <button type="button" className="chip-btn" onClick={() => handleRename(c)}>Rename</button>
                  <button type="button" className="chip-btn" onClick={() => { duplicateCollection(c.id); refresh(); }}>Duplicate</button>
                  <button type="button" className="chip-btn danger" onClick={() => handleDelete(c)}>Delete</button>
                </div>
              </div>
              <div className="col-meta">{c.modIds.length} mod{c.modIds.length === 1 ? "" : "s"}</div>

              {(() => {
                const resolved = c.modIds.map((id) => byId[id]).filter((m): m is Mod => Boolean(m));
                if (resolved.length === 0) return null;
                const report = checkCompatibility(resolved);
                // Prefer the loadout the user explicitly chose; only fall back to
                // deriving from the mods for older collections that never stored it.
                const loader =
                  c.loader ??
                  report.commonLoaders.find((l) => l === "fabric") ??
                  report.commonLoaders.find((l) => l === "quilt") ??
                  report.commonLoaders[0];
                const mcVersion = c.gameVersion ?? report.commonVersions[0];
                const canPack = report.ok && Boolean(loader) && Boolean(mcVersion);
                return (
                  <>
                    {resolved.length >= 2 && (report.ok ? (
                      <div className="compat compat-ok">
                        ✓ Should launch together{compatibilitySummary(report) && <> · {compatibilitySummary(report)}</>}
                      </div>
                    ) : (
                      <div className="compat compat-warn">⚠ {report.messages[0]}</div>
                    ))}
                    <DownloadPack
                      name={c.name}
                      mods={resolved}
                      loader={loader ?? "fabric"}
                      mcVersion={mcVersion ?? "1.21.1"}
                      disabled={!canPack}
                      hint={report.ok ? "Loader/version unknown yet for these mods." : "Fix the conflict above to export a modpack."}
                    />
                  </>
                );
              })()}

              {c.modIds.length === 0 ? (
                <p className="col-empty-mods">No mods yet.</p>
              ) : (
                <>
                  <button type="button" className="col-toggle" onClick={() => toggleExpanded(c.id)} aria-expanded={expanded.has(c.id)}>
                    {expanded.has(c.id) ? "▾ Hide mods" : `▸ Show ${c.modIds.length} mod${c.modIds.length === 1 ? "" : "s"}`}
                  </button>
                  {expanded.has(c.id) && (
                <ul className="col-mods">
                  {c.modIds.map((id) => (
                    <li key={id}>
                      <span>{names[id] ?? id}</span>
                      <button
                        type="button"
                        className="x-btn"
                        aria-label={`Remove ${names[id] ?? id}`}
                        onClick={() => { removeMod(c.id, id); refresh(); }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                  )}
                </>
              )}

              <div className="col-actions">
                {c.modIds.length > 0 && (
                  <button type="button" className="chip-btn" onClick={() => setMig({ collection: c, version: null, checking: false, results: null, loader: null, name: "", done: null })}>
                    ⇄ Migrate to another version
                  </button>
                )}
                {c.modIds.length > 0 && (
                  <button type="button" className="chip-btn" onClick={() => openAll(c)}>Open all mod pages</button>
                )}
                <button type="button" className="chip-btn" onClick={() => download(`${c.name}.json`, toJSON(c), "application/json")}>Export JSON</button>
                <button type="button" className="chip-btn" onClick={() => copy(toText(c, names), "Copied text list to clipboard.")}>Copy text</button>
                <button type="button" className="chip-btn" onClick={() => copy(shareUrl(c), "Copied share link to clipboard.")}>Copy share link</button>
              </div>
            </section>
          ))
        )}

        {collections.length > 0 && <ServerCta />}
      </main>

      {mig && (
        <div className="cmodal-overlay" role="dialog" aria-modal="true" aria-label="Migrate to another version" onClick={() => setMig(null)}>
          <div className="cmodal migrate-modal" onClick={(e) => e.stopPropagation()}>
            {mig.done ? (
              <>
                <h3>✓ Migrated to {mig.done.name}</h3>
                <p className="cmodal-sub">
                  {mig.done.migrated} mod{mig.done.migrated === 1 ? "" : "s"} carried over to {LOADER_LABEL[mig.loader!]} {mig.version}.
                  {mig.done.dropped.length > 0 && <> {mig.done.dropped.length} couldn&apos;t come along (no build there).</>}
                </p>
                {mig.done.dropped.length > 0 && (
                  <ul className="migrate-dropped">
                    {mig.done.dropped.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
                <button type="button" className="btn-primary" onClick={() => setMig(null)}>Done</button>
              </>
            ) : mig.checking ? (
              <>
                <h3>Checking {mig.collection.modIds.length} mods…</h3>
                <div className="quiz-progress" aria-hidden="true"><i className="migrate-bar" /></div>
                <p className="cmodal-sub">Testing every mod against each loader on {mig.version} to find where the most of them work.</p>
              </>
            ) : !mig.version ? (
              <>
                <h3>Migrate “{mig.collection.name}”</h3>
                <p className="cmodal-sub">
                  Currently {mig.collection.loader ? `${LOADER_LABEL[mig.collection.loader]} ${mig.collection.gameVersion ?? ""}` : "loader/version unset"}. Pick a Minecraft version to move it to:
                </p>
                <ul className="cmodal-list">
                  {VERSIONS.map((v) => (
                    <li key={v}>
                      <button type="button" className="cmodal-row" onClick={() => runMigrateCheck(mig.collection, v)}>
                        <span className="cmodal-row-name">{v}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="cmodal-cancel" onClick={() => setMig(null)}>Cancel</button>
              </>
            ) : (
              <>
                <h3>Move to which loader?</h3>
                <p className="cmodal-sub">On {mig.version}, here&apos;s how many of your {mig.collection.modIds.length} mods have a build per loader. We recommend the one that keeps the most.</p>
                <ul className="cmodal-list">
                  {mig.results!.slice().sort((a, b) => b.build.length - a.build.length).map((r) => (
                    <li key={r.loader}>
                      <button
                        type="button"
                        className={`cmodal-row${mig.loader === r.loader ? " on" : ""}`}
                        onClick={() => setMig((m) => (m ? { ...m, loader: r.loader } : m))}
                      >
                        <span className="cmodal-row-name">
                          {LOADER_LABEL[r.loader]}
                          {r === mig.results!.reduce((a, b) => (b.build.length > a.build.length ? b : a)) && <span className="migrate-rec"> Recommended</span>}
                        </span>
                        <span className="cmodal-row-count">{r.build.length} / {r.build.length + r.miss.length} mods</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="cmodal-new">
                  <input className="cmodal-input" value={mig.name} onChange={(e) => setMig((m) => (m ? { ...m, name: e.target.value } : m))} aria-label="New collection name" placeholder="New collection name" />
                  <button type="button" className="btn-primary" disabled={!mig.loader} onClick={confirmMigrate}>Migrate</button>
                </div>
                <button type="button" className="cmodal-cancel" onClick={() => setMig(null)}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {upTarget && (
        <button type="button" className="scroll-top" aria-label="Back to this collection" onClick={scrollToCollection}>
          ▲
        </button>
      )}
    </>
  );
}
