"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Mod } from "@/lib/sources/types";
import type { QuizAnswers } from "@/lib/curation/questions";
import type { Profile } from "@/lib/recommend/profile";
import { recommend, recommendFromQuery, type RankedMod, type Recommendation } from "@/lib/recommend/index";
import { pickLucky } from "@/lib/recommend/lucky";
import { QUERY_STORAGE_KEY } from "@/lib/recommend/intent";
import { resolveBuildable } from "@/lib/modpack/mrpack";
import DownloadPack from "@/components/DownloadPack";
import { ensureCollection, addMod } from "@/lib/storage/collections";
import { setLastCollectionId } from "@/lib/storage/user";
import { loadPool, isDegraded } from "@/lib/catalog/clientPool";
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
  const [excluded, setExcluded] = useState<{ mod: Mod; reason: string }[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState("");
  const [degraded, setDegraded] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  function addToCollection(modId: string) {
    const collection = ensureCollection(DEFAULT_COLLECTION);
    addMod(collection.id, modId);
    setLastCollectionId(collection.id);
    setAdded((prev) => new Set(prev).add(modId));
  }

  function addAll() {
    const collection = ensureCollection(DEFAULT_COLLECTION);
    for (const { mod } of results) addMod(collection.id, mod.id);
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
    if (params.get("lucky")) {
      const { theme, answers: luckyAnswers } = pickLucky();
      setLuckyLabel(theme.label);
      compute = (mods) => recommend(luckyAnswers, mods, CANDIDATE_LIMIT);
    } else if (params.get("mode") === "describe") {
      const query = loadQuery();
      if (query) {
        setDescribeQuery(query);
        compute = (mods) => recommendFromQuery(query, mods, CANDIDATE_LIMIT);
      }
    } else {
      const answers = loadAnswers();
      if (answers && Object.keys(answers).length > 0) compute = (mods) => recommend(answers, mods, CANDIDATE_LIMIT);
    }

    if (!compute) {
      setStatus("no-answers");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const mods = await loadPool();
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
          setExcluded([]);
          setStatus(rec.results.length > 0 ? "ready" : "empty");
          return;
        }

        // Resolve, in rank order, which candidates ACTUALLY build for this
        // loader+version. The loadout shown == the loadout downloaded.
        const candidates = rec.results.slice(0, max + RESOLVE_BUFFER);
        const { buildable, excluded: ex } = await resolveBuildable(
          candidates.map((c) => c.mod),
          rec.profile.loader,
          rec.profile.gameVersion
        );
        if (cancelled) return;
        const okIds = new Set(buildable.map((m) => m.id));
        const finalResults = candidates.filter((c) => okIds.has(c.mod.id)).slice(0, max);
        setResults(finalResults);
        setExcluded(ex);
        setStatus(finalResults.length > 0 ? "ready" : "empty");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
              ✓ {results.length} mods verified for {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)} {profile.gameVersion} — every one builds.
            </div>
          )}
          {status === "ready" && profile && excluded.length > 0 && (
            <details className="excluded">
              <summary>
                ⚠ {excluded.length} mod{excluded.length === 1 ? "" : "s"} left out (no {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)} {profile.gameVersion} build) — tap to review before downloading
              </summary>
              <ul>
                {excluded.map(({ mod, reason }) => (
                  <li key={mod.id}>
                    <b>{mod.name}</b> — {reason}
                    {mod.links.modrinth && (
                      <> · <a href={mod.links.modrinth} target="_blank" rel="noopener noreferrer">check on Modrinth</a></>
                    )}
                  </li>
                ))}
              </ul>
              <p className="excluded-tip">These aren&apos;t in your pack. To include them, retake the quiz with a different loader or Minecraft version.</p>
            </details>
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

        {status === "loading" && <p className="results-state">Building your loadout…</p>}

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
