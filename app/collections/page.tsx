"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import { loadPool } from "@/lib/catalog/clientPool";
import { fetchModsBySlugs } from "@/lib/sources/modrinth";
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

  const refresh = useCallback(() => setCollections(listCollections()), []);

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

      {upTarget && (
        <button type="button" className="scroll-top" aria-label="Back to this collection" onClick={scrollToCollection}>
          ▲
        </button>
      )}
    </>
  );
}
