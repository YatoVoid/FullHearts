"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import type { Loader, Mod } from "@/lib/sources/types";
import { loadPool } from "@/lib/catalog/clientPool";
import { fetchModsBySlugs, fetchModsBySlugsIndexed } from "@/lib/sources/modrinth";
import { modBuildsFor } from "@/lib/modpack/mrpack";
import { parseMrpack, MrpackImportError } from "@/lib/modpack/import";
import { VERSIONS } from "@/lib/catalog/coverage";
import { checkCompatibility, compatibilitySummary } from "@/lib/recommend/compatibility";
import DownloadPack from "@/components/DownloadPack";
import ServerCta from "@/components/ServerCta";
import Icon from "@/components/Icon";
import { useDialog } from "@/components/useDialog";
import {
  listCollections,
  createCollection,
  renameCollection,
  duplicateCollection,
  deleteCollection,
  removeMod,
  setLoadout,
  setPinnedVersions,
  type Collection
} from "@/lib/storage/collections";
import { encodeCollection, decodeCollection, overridesFitShareLink } from "@/lib/storage/share";
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
  env: "client" | "server";          // server mode drops client-only mods
  name: string;
  done: { name: string; migrated: number; dropped: string[] } | null;
}

/** Mods that survive a migration for the chosen environment: server mode also
 *  drops client-only mods (Modrinth server_side "unsupported"). */
function keptFor(build: Mod[], env: "client" | "server"): Mod[] {
  return env === "server" ? build.filter((m) => !m.clientOnly) : build;
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
  const [importing, setImporting] = useState(false);
  // Raw overrides/ bytes from an imported pack, keyed by collection id -
  // session-only (React state, not localStorage): see the file-level comment
  // in lib/modpack/import.ts for why these can't live in a Collection.
  const [overridesByCollection, setOverridesByCollection] = useState<Record<string, Record<string, Uint8Array>>>({});
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0); // counts nested enter/leave so a child element inside the dropzone can't flicker the highlight off
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm: askConfirm, prompt: askPrompt, dialog } = useDialog();

  const refresh = useCallback(() => setCollections(listCollections()), []);

  // Import an existing .mrpack: read its modrinth.index.json, resolve the
  // Modrinth-hosted mods back to cards, and drop them into a new editable
  // collection (loader/version pinned from the pack). Each mod's EXACT version
  // is pinned too (see setPinnedVersions), so re-downloading reproduces the
  // same tested build combination instead of buildMrpack silently re-resolving
  // every mod to "newest" - which can pair versions that were never actually
  // tested together and crash at launch. External mods and overrides/ still
  // can't round-trip through a rebuilt pack, so we report their counts rather
  // than pretend they carried over.
  async function importMrpack(file: File) {
    setImporting(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pack = parseMrpack(bytes);
      const { mods, slugByRawId } = await fetchModsBySlugsIndexed(pack.projectIds);
      if (mods.length === 0) {
        flash("Couldn't resolve any of that pack's mods from Modrinth.", 9000);
        return;
      }
      const created = createCollection(pack.name, mods.map((m) => m.id));
      setLoadout(created.id, pack.loader, pack.mcVersion);
      const pinnedVersions: Record<string, string> = {};
      for (const [rawId, versionId] of Object.entries(pack.projectVersions)) {
        pinnedVersions[slugByRawId[rawId] ?? rawId] = versionId;
      }
      if (Object.keys(pinnedVersions).length > 0) setPinnedVersions(created.id, pinnedVersions);
      if (Object.keys(pack.overrides).length > 0) {
        setOverridesByCollection((prev) => ({ ...prev, [created.id]: pack.overrides }));
      }
      refresh();
      const extras: string[] = [];
      const unresolved = pack.projectIds.length - mods.length;
      if (unresolved > 0) extras.push(`${unresolved} mod${unresolved === 1 ? "" : "s"} no longer on Modrinth`);
      if (pack.externalCount > 0) extras.push(`${pack.externalCount} non-Modrinth mod${pack.externalCount === 1 ? "" : "s"}`);
      const tail = extras.length ? ` Keep your original file for: ${extras.join(", ")}.` : "";
      const overrideCount = Object.keys(pack.overrides).length;
      const overridesNote =
        overrideCount > 0
          ? ` Carried over ${overrideCount} override file${overrideCount === 1 ? "" : "s"} (configs, resource packs, guide books, etc.) - they'll be included when you re-export from here, but only in this browser tab for now; if you reload the page first, keep your original file for those instead.`
          : "";
      flash(
        `Imported ${mods.length} mod${mods.length === 1 ? "" : "s"} into "${pack.name}".${tail}${overridesNote}`,
        (tail || overridesNote) ? 15000 : 6000
      );
    } catch (e) {
      flash(e instanceof MrpackImportError ? e.message : "Couldn't read that .mrpack.", 9000);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = ""; // allow re-importing the same file
    }
  }

  // Drag-and-drop onto the import dropzone. dragDepth counts nested enter/leave
  // pairs (the button and hint text inside the zone each fire their own
  // enter/leave as the pointer crosses them) so the highlight only clears once
  // the pointer has actually left the whole zone, not a child inside it.
  function onDropzoneDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragOver(true);
  }
  function onDropzoneDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); // required to allow a drop at all
    if (e.dataTransfer.types.includes("Files")) e.dataTransfer.dropEffect = "copy";
  }
  function onDropzoneDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }
  function onDropzoneDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    if (importing) return;
    const file = [...e.dataTransfer.files].find((f) => f.name.toLowerCase().endsWith(".mrpack")) ?? e.dataTransfer.files[0];
    if (file) importMrpack(file);
  }

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
    const kept = keptFor(res.build, mig.env);
    // Two reasons a mod is left behind: no build for this loader/version, or
    // (server mode) it's client-only. Label the client-only ones so it's clear.
    const droppedClient = mig.env === "server" ? res.build.filter((m) => m.clientOnly) : [];
    const dropped = [
      ...res.miss.map((x) => x.name),
      ...droppedClient.map((x) => `${x.name} (client-only)`)
    ];
    const created = createCollection(name, kept.map((m) => m.id));
    setLoadout(created.id, mig.loader, mig.version);
    refresh();
    setMig((m) => (m ? { ...m, done: { name, migrated: kept.length, dropped } } : m));
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
        const created = createCollection(payload.name || "Shared collection", payload.modIds);
        // Carry the sharer's loader + version so the pack stays version-locked.
        if (payload.loader && payload.version) setLoadout(created.id, payload.loader, payload.version);
        if (payload.overrides && Object.keys(payload.overrides).length > 0) {
          setOverridesByCollection((prev) => ({ ...prev, [created.id]: payload.overrides! }));
          setNote("Imported a shared collection, including its overrides (configs, resource packs, guide books, etc.).");
        } else {
          setNote("Imported a shared collection.");
        }
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

  // Short toast for "Copied" etc.; import results carry must-read detail (which
  // mods/overrides didn't come across), so they get a much longer dwell.
  const flashTimer = useRef<number | null>(null);
  const flash = (msg: string, ms = 2500) => {
    setNote(msg);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setNote(""), ms);
  };

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash("Copy failed. Your browser blocked clipboard access.");
    }
  }

  async function handleRename(c: Collection) {
    const name = await askPrompt({
      title: "Rename collection",
      defaultValue: c.name,
      confirmLabel: "Rename",
      icon: "swap"
    });
    if (name) {
      renameCollection(c.id, name);
      refresh();
    }
  }

  async function handleDelete(c: Collection) {
    const ok = await askConfirm({
      title: "Delete this collection?",
      body: `"${c.name}" will be removed from this browser. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
      icon: "x"
    });
    if (ok) {
      deleteCollection(c.id);
      setOverridesByCollection((prev) => {
        if (!(c.id in prev)) return prev;
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      refresh();
    }
  }

  function shareUrl(c: Collection): string {
    const overrides = overridesByCollection[c.id];
    const includeOverrides = overridesFitShareLink(overrides);
    const encoded = encodeCollection({
      name: c.name,
      modIds: c.modIds,
      loader: c.loader,
      version: c.gameVersion,
      overrides: includeOverrides ? overrides : undefined
    });
    return `${window.location.origin}/collections#share=${encoded}`;
  }

  /** Message for the "Copy share link" toast: says plainly whether this
   *  collection's overrides came along, since a link that silently drops
   *  them (too big - see MAX_OVERRIDES_ZIPPED_BYTES) would be misleading
   *  otherwise. */
  function shareLinkMessage(c: Collection): string {
    const overrides = overridesByCollection[c.id];
    if (!overrides || Object.keys(overrides).length === 0) return "Copied share link to clipboard.";
    return overridesFitShareLink(overrides)
      ? "Copied share link, including its overrides (configs, resource packs, guide books, etc.)."
      : "Copied share link to clipboard. Its overrides were too big to fit in a link - share the .mrpack file instead for those.";
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
          <h2>Saved collections</h2>
        </div>

        <div className="lucky-bar">
          <Link className="btn-ghost" href="/install"><Icon name="package" size={15} /> How to install a whole loadout at once →</Link>
          <div
            className={`import-drop${dragOver ? " on" : ""}`}
            onDragEnter={onDropzoneDragEnter}
            onDragOver={onDropzoneDragOver}
            onDragLeave={onDropzoneDragLeave}
            onDrop={onDropzoneDrop}
          >
            <button
              type="button"
              className="btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <Icon name="package" size={15} /> {importing ? "Importing…" : "Import a modpack (.mrpack file) to edit"}
            </button>
            <span className="import-drop-hint" aria-hidden="true">{dragOver ? "Drop it!" : "or drop a .mrpack file here"}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".mrpack,application/x-modrinth-modpack+zip"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importMrpack(f); }}
            />
          </div>
        </div>

        {degraded && (
          <p className="degraded-note">Private browsing: collections are kept only for this session.</p>
        )}
        <p className="copied-note" role="status">{note}</p>

        {collections.length === 0 ? (
          <p className="results-state">
            No collections yet. <Link href="/quiz" style={{ color: "var(--grass)" }}>Take the quiz</Link>, <Link href="/explore" style={{ color: "var(--grass)" }}>browse Explore</Link>, or import a modpack file above.
          </p>
        ) : (
          collections.map((c) => (
            <section className="col-card" id={`col-${c.id}`} key={c.id}>
              <div className="col-head">
                <h3>{c.name}</h3>
                <div className="col-actions">
                  <button type="button" className="chip-btn" onClick={() => handleRename(c)}>Rename</button>
                  <button type="button" className="chip-btn" onClick={() => {
                    const dup = duplicateCollection(c.id);
                    if (dup && overridesByCollection[c.id]) {
                      setOverridesByCollection((prev) => ({ ...prev, [dup.id]: overridesByCollection[c.id] }));
                    }
                    refresh();
                  }}>Duplicate</button>
                  <button type="button" className="chip-btn danger" onClick={() => handleDelete(c)}>Delete</button>
                </div>
              </div>
              <div className="col-meta">{c.modIds.length} mod{c.modIds.length === 1 ? "" : "s"}</div>

              {(() => {
                const resolved = c.modIds.map((id) => byId[id]).filter((m): m is Mod => Boolean(m));
                if (resolved.length === 0) return null;

                // Pinned target (imported .mrpack / migrated pack): the loader +
                // version are authoritative. DON'T re-judge per-mod support from
                // Modrinth's project-level loaders/game_versions aggregate — it's
                // demonstrably unreliable (e.g. Kambrik ships a Forge 1.20.1 jar
                // but its project omits forge), which both false-conflicted the
                // loader intersection and false-warned "no build". The export step
                // does the real per-version resolution and reports what it drops.
                if (c.loader && c.gameVersion) {
                  const loader = c.loader;
                  const mcVersion = c.gameVersion;
                  const label = `${loader[0].toUpperCase() + loader.slice(1)} · ${mcVersion}`;
                  return (
                    <>
                      {resolved.length >= 2 && (
                        <div className="compat compat-ok"><Icon name="check" size={15} /> Should launch together · {label}</div>
                      )}
                      <DownloadPack name={c.name} mods={resolved} loader={loader} mcVersion={mcVersion} disabled={false} pinnedVersions={c.pinnedVersions} overrides={overridesByCollection[c.id]} />
                    </>
                  );
                }

                const report = checkCompatibility(resolved);
                // No pinned loadout (older / quiz-added collection): derive from the mods.
                const loader =
                  report.commonLoaders.find((l) => l === "fabric") ??
                  report.commonLoaders.find((l) => l === "quilt") ??
                  report.commonLoaders[0];
                const mcVersion = report.commonVersions[0];
                const canPack = report.ok && Boolean(loader) && Boolean(mcVersion);
                return (
                  <>
                    {resolved.length >= 2 && (report.ok ? (
                      <div className="compat compat-ok">
                        <Icon name="check" size={15} /> Should launch together{compatibilitySummary(report) && <> · {compatibilitySummary(report)}</>}
                      </div>
                    ) : (
                      <div className="compat compat-warn"><Icon name="alert" size={15} /> {report.messages[0]}</div>
                    ))}
                    <DownloadPack
                      name={c.name}
                      mods={resolved}
                      loader={loader ?? "fabric"}
                      mcVersion={mcVersion ?? "1.21.1"}
                      pinnedVersions={c.pinnedVersions}
                      overrides={overridesByCollection[c.id]}
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
                  <button type="button" className="chip-btn" onClick={() => setMig({ collection: c, version: null, checking: false, results: null, loader: null, env: "client", name: "", done: null })}>
                    <Icon name="swap" size={15} /> Migrate to another version
                  </button>
                )}
                {c.modIds.length > 0 && (
                  <button type="button" className="chip-btn" onClick={() => openAll(c)}>Open all mod pages</button>
                )}
                <button type="button" className="chip-btn" onClick={() => download(`${c.name}.json`, toJSON(c), "application/json")}>Backup (JSON file)</button>
                <button type="button" className="chip-btn" onClick={() => copy(toText(c, names), "Copied mod list to clipboard.")}>Copy mod list</button>
                <button type="button" className="chip-btn" onClick={() => copy(shareUrl(c), shareLinkMessage(c))}>Copy share link</button>
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
                <h3><Icon name="check" size={16} /> Migrated to {mig.done.name}</h3>
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
                <button type="button" className="cmodal-back" onClick={() => setMig((m) => (m ? { ...m, version: null, results: null, loader: null } : m))}>← Pick a different version</button>
                <h3>Move to which loader?</h3>
                <div className="migrate-env" role="group" aria-label="Pack environment">
                  <button
                    type="button"
                    className={`migrate-env-opt${mig.env === "client" ? " on" : ""}`}
                    onClick={() => setMig((m) => (m ? { ...m, env: "client" } : m))}
                  >
                    <Icon name="monitor" size={20} /> Client<span className="migrate-env-hint">for playing</span>
                  </button>
                  <button
                    type="button"
                    className={`migrate-env-opt${mig.env === "server" ? " on" : ""}`}
                    onClick={() => setMig((m) => (m ? { ...m, env: "server" } : m))}
                  >
                    <Icon name="server" size={20} /> Server<span className="migrate-env-hint">drops client-only mods</span>
                  </button>
                </div>
                <p className="cmodal-sub">On {mig.version}, here&apos;s how many of your {mig.collection.modIds.length} mods come along per loader{mig.env === "server" ? " (client-only mods excluded)" : ""}. We recommend the one that keeps the most.</p>
                <ul className="cmodal-list">
                  {mig.results!.slice().sort((a, b) => keptFor(b.build, mig.env).length - keptFor(a.build, mig.env).length).map((r) => {
                    const kept = keptFor(r.build, mig.env).length;
                    const best = mig.results!.reduce((a, b) => (keptFor(b.build, mig.env).length > keptFor(a.build, mig.env).length ? b : a));
                    return (
                      <li key={r.loader}>
                        <button
                          type="button"
                          className={`cmodal-row${mig.loader === r.loader ? " on" : ""}`}
                          onClick={() => setMig((m) => (m ? { ...m, loader: r.loader } : m))}
                        >
                          <span className="cmodal-row-name">
                            {LOADER_LABEL[r.loader]}
                            {r === best && <span className="migrate-rec"> Recommended</span>}
                          </span>
                          <span className="cmodal-row-count">{kept} / {mig.collection.modIds.length} mods</span>
                        </button>
                      </li>
                    );
                  })}
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
      {dialog}
    </>
  );
}
