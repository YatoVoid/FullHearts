"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
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

const HEART = (
  <img
    src="/heart.png"
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
  const [degraded, setDegraded] = useState(false);
  const [note, setNote] = useState("");

  const refresh = useCallback(() => setCollections(listCollections()), []);

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

  // Resolve mod ids to display names from the live catalog.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mods");
        if (!res.ok) return;
        const data = (await res.json()) as { mods: Mod[] };
        if (cancelled) return;
        setNames(Object.fromEntries(data.mods.map((m) => [m.id, m.name])));
      } catch {
        // names fall back to ids
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(""), 2500);
  };

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash("Copy failed — your browser blocked clipboard access.");
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
          <Link className="nav-cta" href="/quiz">New loadout</Link>
        </div>
      </header>

      <main className="collections">
        <div className="section-head">
          <div className="eyebrow">YOUR COLLECTIONS</div>
          <h2>Saved loadouts</h2>
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
            <section className="col-card" key={c.id}>
              <div className="col-head">
                <h3>{c.name}</h3>
                <div className="col-actions">
                  <button type="button" className="chip-btn" onClick={() => handleRename(c)}>Rename</button>
                  <button type="button" className="chip-btn" onClick={() => { duplicateCollection(c.id); refresh(); }}>Duplicate</button>
                  <button type="button" className="chip-btn danger" onClick={() => handleDelete(c)}>Delete</button>
                </div>
              </div>
              <div className="col-meta">{c.modIds.length} mod{c.modIds.length === 1 ? "" : "s"}</div>

              {c.modIds.length === 0 ? (
                <p className="col-empty-mods">No mods yet.</p>
              ) : (
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

              <div className="col-actions">
                <button type="button" className="chip-btn" onClick={() => download(`${c.name}.json`, toJSON(c), "application/json")}>Export JSON</button>
                <button type="button" className="chip-btn" onClick={() => copy(toText(c, names), "Copied text list to clipboard.")}>Copy text</button>
                <button type="button" className="chip-btn" onClick={() => copy(shareUrl(c), "Copied share link to clipboard.")}>Copy share link</button>
              </div>
            </section>
          ))
        )}
      </main>
    </>
  );
}
