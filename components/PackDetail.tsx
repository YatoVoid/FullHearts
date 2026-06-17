"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import type { Pack } from "@/lib/packs/packs";
import { ensureCollection, addMod } from "@/lib/storage/collections";
import { setLastCollectionId } from "@/lib/storage/user";
import { loadPool } from "@/lib/catalog/clientPool";
import { HEART_SRC } from "@/lib/asset";
import Footer from "@/components/Footer";
import ModCard from "@/components/ModCard";
import DownloadPack from "@/components/DownloadPack";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

function prettify(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Minimal Mod so a pack entry not in the live pool still renders + exports. */
function stub(slug: string): Mod {
  return {
    id: slug,
    name: prettify(slug),
    summary: "",
    curatedTags: {},
    reasonTemplate: "",
    modrinthSlug: slug,
    loaders: [],
    gameVersions: [],
    dependencies: [],
    links: { modrinth: `https://modrinth.com/mod/${slug}` }
  };
}

export default function PackDetail({ pack }: { pack: Pack }) {
  const [pool, setPool] = useState<Mod[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadPool()
      .then((p) => { if (!cancelled) setPool(p); })
      .catch(() => { if (!cancelled) setPool([]); });
    return () => { cancelled = true; };
  }, []);

  // Resolve each pack slug to a rich pool mod when available, else a stub.
  const mods = useMemo(() => {
    const bySlug = new Map<string, Mod>();
    for (const m of pool ?? []) {
      if (m.modrinthSlug) bySlug.set(m.modrinthSlug, m);
      bySlug.set(m.id, m);
    }
    return pack.mods.map((slug) => bySlug.get(slug) ?? stub(slug));
  }, [pool, pack.mods]);

  function add(modId: string) {
    const collection = ensureCollection(pack.name);
    addMod(collection.id, modId);
    setLastCollectionId(collection.id);
    setAdded((prev) => new Set(prev).add(modId));
  }

  function addAll() {
    const collection = ensureCollection(pack.name);
    for (const m of mods) addMod(collection.id, m.id);
    setLastCollectionId(collection.id);
    setAdded(new Set(mods.map((m) => m.id)));
  }

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <Link className="nav-cta" href="/packs">All packs</Link>
        </div>
      </header>

      <main className="results">
        <div className="results-head">
          <div className="eyebrow">
            <Link href="/packs" style={{ color: "var(--grass)" }}>← All packs</Link>
          </div>
          <h2 style={{ fontFamily: "var(--pixel)", fontSize: "clamp(15px,3vw,22px)", margin: "8px 0 10px" }}>
            <span aria-hidden="true">{pack.emoji} </span>{pack.name}
          </h2>
          <div className="summary">{pack.description}</div>
          <div className="compat compat-ok" style={{ maxWidth: 560 }}>
            ✓ Hand-tested · {pack.loader[0].toUpperCase() + pack.loader.slice(1)} {pack.mcVersion} · {pack.mods.length} mods
          </div>

          <DownloadPack name={pack.name} mods={mods} loader={pack.loader} mcVersion={pack.mcVersion} />

          <div className="results-actions">
            <button type="button" className="btn-ghost" onClick={addAll}>Save all to a collection</button>
            {pack.modrinthCollection && (
              <a className="btn-ghost" href={pack.modrinthCollection} target="_blank" rel="noopener noreferrer">
                View on Modrinth
              </a>
            )}
            <Link className="btn-ghost" href="/install">How to install</Link>
          </div>
        </div>

        <div className="grid">
          {mods.map((mod, i) => (
            <ModCard key={mod.id} mod={mod} i={i} added={added.has(mod.id)} onAdd={add} />
          ))}
        </div>
      </main>

      <Footer />
    </>
  );
}
