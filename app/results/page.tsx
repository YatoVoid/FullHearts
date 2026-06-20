"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import type { QuizAnswers } from "@/lib/curation/questions";
import { buildProfile, type Profile } from "@/lib/recommend/profile";
import { recommend, recommendFromQuery, type RankedMod, type Recommendation } from "@/lib/recommend/index";
import { pickLucky } from "@/lib/recommend/lucky";
import { isContentMod, backgroundCap } from "@/lib/recommend/classify";
import { QUERY_STORAGE_KEY, parseIntent } from "@/lib/recommend/intent";
import { recommendedVersion, type Coverage } from "@/lib/catalog/coverage";
import snapshotCoverage from "@/lib/catalog/coverage.snapshot.json";
import { buildMrpack } from "@/lib/modpack/mrpack";
import DownloadPack from "@/components/DownloadPack";
import { ensureCollection, addMod, setLoadout } from "@/lib/storage/collections";
import { setLastCollectionId } from "@/lib/storage/user";
import { loadPool, isDegraded } from "@/lib/catalog/clientPool";
import { checkCompatibility } from "@/lib/recommend/compatibility";
import { HEART_SRC } from "@/lib/asset";
import Footer from "@/components/Footer";
import ServerCta from "@/components/ServerCta";
import AdSlot from "@/components/AdSlot";

const DEFAULT_COLLECTION = "My loadout";

// Rank more candidates than the loadout size so we can fill it with mods that
// ACTUALLY build for the chosen loader+version, then bound how many we resolve
// live (per-mod Modrinth calls) to maxMods + this buffer.
const CANDIDATE_LIMIT = 90;
const RESOLVE_BUFFER = 20;

const ANSWERS_KEY = "fullhearts:answers";
const RARITY = ["r-epic", "r-rare", "r-uncommon"];

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

type Status = "loading" | "ready" | "empty" | "no-answers" | "error";

function loadAnswers(): QuizAnswers | null {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    return raw ? (JSON.parse(raw) as QuizAnswers) : null;
  } catch {
    return null;
  }
}

function loadQuery(): string | null {
  try {
    return sessionStorage.getItem(QUERY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function Results() {
  const [status, setStatus] = useState<Status>("loading");
  const [results, setResults] = useState<RankedMod[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState("");
  const [degraded, setDegraded] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [buildProgress, setBuildProgress] = useState({ pct: 0, label: "" });

  // Creep the validation bar up a hair each tick so it always looks alive.
  useEffect(() => {
    if (status !== "loading") return;
    const t = setInterval(() => {
      setBuildProgress((p) => (p.pct >= 96 ? p : { ...p, pct: p.pct + 0.4 }));
    }, 240);
    return () => clearInterval(t);
  }, [status]);

  function addToCollection(modId: string) {
    const collection = ensureCollection(DEFAULT_COLLECTION);
    if (profile) setLoadout(collection.id, profile.loader, profile.gameVersion);
    const mods = results.map((r) => r.mod);
    const targetMods = mods.filter((m) => collection && m.id !== modId && m.id !== undefined).filter((m) => m.id && collection.modIds.includes(m.id));
    const modToAdd = results.find((r) => r.mod.id === modId)?.mod;
    if (modToAdd && targetMods.length > 0) {
      const report = checkCompatibility([...targetMods, modToAdd]);
      if (!report.ok) {
        window.alert("This mod does not match the loader/version of your collection. Add only matching mods.");
        return;
      }
    }
    addMod(collection.id, modId);
    setLastCollectionId(collection.id);
    setAdded((prev) => new Set(prev).add(modId));
  }

  function addAll() {
    const collection = ensureCollection(DEFAULT_COLLECTION);
    if (profile) setLoadout(collection.id, profile.loader, profile.gameVersion);
    const mods = results.map((r) => r.mod);
    for (const { mod } of results) {
      const targetMods = mods.filter((m) => m.id !== mod.id && collection.modIds.includes(m.id));
      if (checkCompatibility([...targetMods, mod]).ok) {
        addMod(collection.id, mod.id);
      }
    }
    setLastCollectionId(collection.id);
    setAdded(new Set(results.map((r) => r.mod.id)));
  }

  // Open every mod's page in a new tab. Browsers may ask to allow multiple
  // popups the first time — that's expected for a deliberate "open all".
  function openAll() {
    for (const { mod } of results) {
      const url = mod.links.modrinth || mod.links.curseforge;
      if (url && /^https?:\/\//.test(url)) window.open(url, "_blank", "noopener");
    }
  }

  const [luckyLabel, setLuckyLabel] = useState("");
  const [describeQuery, setDescribeQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Pick the source of the recommendation: lucky theme, a parsed playstyle
    // description, or the saved quiz answers.
    let compute: ((mods: Mod[]) => Recommendation) | null = null;
    // The profile is known from the answers/query alone (before any fetch), so we
    // can fetch a pool FACETED to the chosen loader+version — the key to a Forge
    // quiz returning real Forge mods instead of a Fabric-skewed top-downloads pool.
    let poolProfile: Profile | null = null;
    if (params.get("lucky")) {
      const { theme, answers: luckyAnswers } = pickLucky();
      setLuckyLabel(theme.label);
      poolProfile = buildProfile(luckyAnswers);
      compute = (mods) => recommend(luckyAnswers, mods, CANDIDATE_LIMIT);
    } else if (params.get("mode") === "describe") {
      const query = loadQuery();
      if (query) {
        setDescribeQuery(query);
        poolProfile = parseIntent(query).profile;
        // If the user didn't name a Minecraft version, default to the recommended
        // one for their loader (newest version with a near-peak, stable mod set).
        if (!/\b1\.\d{1,2}(\.\d{1,2})?\b/.test(query)) {
          poolProfile.gameVersion = recommendedVersion(snapshotCoverage as Coverage, poolProfile.loader);
        }
        compute = (mods) => recommendFromQuery(query, mods, CANDIDATE_LIMIT);
      }
    } else {
      const answers = loadAnswers();
      if (answers && Object.keys(answers).length > 0) {
        poolProfile = buildProfile(answers);
        compute = (mods) => recommend(answers, mods, CANDIDATE_LIMIT);
      }
    }

    if (!compute || !poolProfile) {
      setStatus("no-answers");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const mods = await loadPool({ loader: poolProfile!.loader, version: poolProfile!.gameVersion });
        if (cancelled) return;
        const rec = compute!(mods);
        const deg = isDegraded(mods);
        setProfile(rec.profile);
        setSummary(rec.profileSummary);
        setDegraded(deg);

        const max = rec.profile.maxMods;
        if (deg) {
          // Live data is down — can't verify buildability, so show the ranked
          // candidates as-is (old behavior) rather than excluding everything.
          setResults(rec.results.slice(0, max));
          setStatus(rec.results.length > 0 ? "ready" : "empty");
          return;
        }

        // Split candidates into CONTENT (game-changing) and BACKGROUND (perf,
        // visuals, UI, QoL, libraries). The size limit counts CONTENT mods; a
        // small bounded set of background mods rides on top, so a "cozy builder"
        // pack is full of cozy/building mods, not 20 FPS/texture/fix mods.
        const contentCands = rec.results.filter((c) => isContentMod(c.mod));
        const bgCands = rec.results.filter((c) => !isContentMod(c.mod));
        const bgCap = backgroundCap(max);
        const contentSlice = contentCands.slice(0, max + RESOLVE_BUFFER);
        const bgSlice = bgCands.slice(0, bgCap + 10);

        // FULL build validation (same one the download uses) on the superset, so
        // the loadout shown == exactly what downloads (cached, instant later).
        const { included } = await buildMrpack({
          name: "Full Hearts loadout",
          mods: [...contentSlice, ...bgSlice].map((c) => c.mod),
          loader: rec.profile.loader,
          mcVersion: rec.profile.gameVersion,
          onProgress: (pct, label) => { if (!cancelled) setBuildProgress((prev) => ({ pct: Math.max(prev.pct, pct), label })); }
        });
        if (cancelled) return;
        const okIds = new Set(included.map((m) => m.id));
        const fill = (cands: RankedMod[], n: number) => {
          const out: RankedMod[] = [];
          for (const c of cands) {
            if (out.length >= n) break;
            if (okIds.has(c.mod.id)) out.push(c);
          }
          return out;
        };
        const finalResults = [...fill(contentSlice, max), ...fill(bgSlice, bgCap)];
        setResults(finalResults);
        setStatus(finalResults.length > 0 ? "ready" : "empty");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Content mods are what the user asked for (the size limit); the rest are
  // "essentials" (performance/visual/QoL/library) that ride along.
  const contentCount = results.filter((r) => isContentMod(r.mod)).length;
  const essentialCount = results.length - contentCount;

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <Link className="nav-cta" href="/quiz">Retake quiz</Link>
        </div>
      </header>

      <main className="results">
        <div className="results-head">
          <div className="eyebrow">
            {luckyLabel
              ? `🎲 FEELING LUCKY · ${luckyLabel.toUpperCase()}`
              : describeQuery
              ? `🔎 “${describeQuery.toUpperCase()}” · AI BETA`
              : "YOUR LOADOUT"}
          </div>
          {status === "ready" && <div className="summary">{summary}</div>}
          {status === "ready" && profile && !degraded && (
            <div className="compat compat-ok">
              ✓ {contentCount} mods{essentialCount > 0 ? ` + ${essentialCount} essentials` : ""} for {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)} {profile.gameVersion}. Every one builds.
            </div>
          )}
          {status === "ready" && profile && (
            <DownloadPack
              name="Full Hearts loadout"
              mods={results.map((r) => r.mod)}
              loader={profile.loader}
              mcVersion={profile.gameVersion}
            />
          )}
          {status === "ready" && (
            <div className="results-actions">
              <button type="button" className="btn-ghost" onClick={addAll}>Save all to collection</button>
              <button type="button" className="btn-ghost" onClick={openAll}>Open all mod pages ({results.length})</button>
              <Link className="btn-ghost" href="/install">📦 Install guide</Link>
              <Link className="btn-ghost" href="/collections">View collections</Link>
            </div>
          )}
        </div>

        {status === "loading" && (
          <div className="results-building" role="status" aria-live="polite">
            <div className="quiz-progress" aria-hidden="true"><i style={{ width: `${Math.max(6, buildProgress.pct)}%` }} /></div>
            <p className="results-state">
              {buildProgress.label || "Building your loadout…"}
              <br />
              We&apos;re cross-checking every mod and its dependencies for {profile?.loader ? profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1) : "your loader"}{" "}
              {profile?.gameVersion ?? ""} so your pack installs clean the first time.
            </p>
          </div>
        )}

        {status === "no-answers" && (
          <p className="results-state">
            No answers yet. <Link href="/quiz" className="g" style={{ color: "var(--grass)" }}>Take the quiz</Link> to get your loadout.
          </p>
        )}

        {status === "error" && (
          <p className="results-state">
            We couldn&apos;t reach the mod data. Please <Link href="/quiz" style={{ color: "var(--grass)" }}>try again</Link>.
          </p>
        )}

        {status === "empty" && (
          <p className="results-state">
            {profile
              ? <>No mods build for {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)} {profile.gameVersion}. <Link href="/quiz" style={{ color: "var(--grass)" }}>Retake the quiz</Link> with a different loader or Minecraft version.</>
              : <>No matches for those answers yet. <Link href="/quiz" style={{ color: "var(--grass)" }}>Tweak your quiz</Link> and try again.</>}
          </p>
        )}

        {status === "ready" && (
          <>
            {degraded && (
              <p className="degraded-note">Showing curated info. Live data is temporarily unavailable.</p>
            )}
            <div className="grid">
              {results.map(({ mod, reason }, i) => {
                const required = mod.dependencies.filter((d) => d.required);
                const rarity = RARITY[Math.min(i, RARITY.length - 1)];
                return (
                  <article className={`tip ${rarity}`} key={mod.id}>
                    <div className="row1">
                      {mod.iconUrl && <img className="tip-icon" src={mod.iconUrl} alt="" loading="lazy" />}
                      <span className="title">{mod.name}</span>
                    </div>
                    <div className="badges">
                      {mod.loaders.map((l) => <span className="badge" key={l}>{l.toUpperCase()}</span>)}
                      {mod.gameVersions.slice(0, 1).map((v) => <span className="badge" key={v}>{v}</span>)}
                    </div>
                    <p className="desc">{mod.summary}</p>
                    <p className="why">{reason}</p>
                    {required.length > 0 && (
                      <p className="deps">
                        <b>Requires:</b> {required.map((d) => d.name).join(", ")}
                      </p>
                    )}
                    <div className="tip-links">
                      <button
                        type="button"
                        className={`add-btn${added.has(mod.id) ? " added" : ""}`}
                        onClick={() => addToCollection(mod.id)}
                        disabled={added.has(mod.id)}
                      >
                        {added.has(mod.id) ? "Added ✓" : "+ Add"}
                      </button>
                      {mod.links.modrinth && (
                        <a href={mod.links.modrinth} target="_blank" rel="noopener noreferrer">Modrinth</a>
                      )}
                      {mod.links.curseforge && (
                        <a className="alt" href={mod.links.curseforge} target="_blank" rel="noopener noreferrer">CurseForge</a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <ServerCta />
            <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULTS || "9713352410"} />
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
