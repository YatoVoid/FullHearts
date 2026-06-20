"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QUESTIONS, type QuizAnswers } from "@/lib/curation/questions";
import { HEART_SRC } from "@/lib/asset";
import { computeCoverage, recommendedVersion, sizeOptionsFor, type Coverage } from "@/lib/catalog/coverage";
import snapshotCoverage from "@/lib/catalog/coverage.snapshot.json";
import { loadPool } from "@/lib/catalog/clientPool";
import type { Loader } from "@/lib/sources/types";

const ANSWERS_KEY = "fullhearts:answers";
const PROGRESS_KEY = "fullhearts:progress";

interface SavedProgress {
  step: number;
  answers: QuizAnswers;
}

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

export default function Quiz() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [resume, setResume] = useState<SavedProgress | null>(null);
  const hydrated = useRef(false);

  // Coverage: start from the committed snapshot, replace with live counts when the
  // cached pool resolves. Counts are advisory and never block advancing.
  const [coverage, setCoverage] = useState<Coverage>(snapshotCoverage as Coverage);

  // On mount, surface any in-progress quiz as a resume offer (don't auto-apply).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedProgress;
        if (saved && (saved.step > 0 || Object.keys(saved.answers ?? {}).length > 0)) {
          setResume(saved);
        }
      }
    } catch {
      // sessionStorage unavailable — just start fresh.
    }
    hydrated.current = true;
  }, []);

  // Persist progress after hydration so a reload/return can resume.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ step, answers }));
    } catch {
      // ignore — resume is best-effort.
    }
  }, [step, answers]);

  const applyResume = useCallback(() => {
    if (!resume) return;
    setStep(resume.step);
    setAnswers(resume.answers);
    setResume(null);
  }, [resume]);

  const startOver = useCallback(() => {
    setResume(null);
    setStep(0);
    setAnswers({});
    try {
      sessionStorage.removeItem(PROGRESS_KEY);
    } catch {
      // ignore
    }
  }, []);

  const question = QUESTIONS[step];
  const total = QUESTIONS.length;
  const selected = answers[question.id] ?? [];
  const progress = Math.round((step / total) * 100);
  const canAdvance = selected.length > 0;

  // Map quiz answers -> chosen loader/version (loader option ids equal loader names).
  const chosenLoader = (answers.loader?.[0] ?? "forge") as Loader;
  const versionById: Record<string, string> = {};
  for (const o of QUESTIONS.find((q) => q.id === "version")?.options ?? []) {
    if (o.gameVersion) versionById[o.id] = o.gameVersion;
  }
  const chosenVersion = versionById[answers.version?.[0] ?? ""] ?? "1.20.1";

  // Refetch coverage faceted to the chosen loader so per-version counts and the
  // recommended version reflect what that loader actually offers (Forge peaks on
  // 1.20.1, not 1.21.1) — matching what the results page will deliver.
  useEffect(() => {
    let cancelled = false;
    loadPool({ loader: chosenLoader })
      .then((pool) => { if (!cancelled) setCoverage(computeCoverage(pool)); })
      .catch(() => { /* keep snapshot */ });
    return () => { cancelled = true; };
  }, [chosenLoader]);

  const recVersion = recommendedVersion(coverage, chosenLoader);

  // Decorate the version and size steps with live availability. Other steps render
  // their static options unchanged. Size ids stay aligned so buildProfile is intact.
  type DisplayOption = { id: string; label: string; note?: string; recommended?: boolean };
  let displayOptions: DisplayOption[];
  if (question.id === "version") {
    // NeoForge only exists for 1.20.1+, even though Modrinth tags some older mods
    // with it — don't offer versions it can't actually build.
    const NEOFORGE_OK = new Set(["1.21.1", "1.21", "1.20.4", "1.20.1"]);
    const withCounts = question.options
      .filter((o) => chosenLoader !== "neoforge" || NEOFORGE_OK.has(o.gameVersion ?? ""))
      .map((o) => ({
        id: o.id,
        label: o.label,
        count: coverage[chosenLoader]?.[o.gameVersion ?? ""] ?? 0,
        gameVersion: o.gameVersion
      }));
    // Keep newest-first order, but hide versions with too few mods to bother with
    // (an empty/near-empty old version isn't worth offering). Fall back gracefully
    // if counts haven't loaded or the threshold would hide everything.
    const MIN = 8;
    const enough = withCounts.filter((o) => o.count >= MIN);
    const some = withCounts.filter((o) => o.count > 0);
    const shown = enough.length > 0 ? enough : some.length > 0 ? some : withCounts;
    displayOptions = shown.map((o) => ({
      id: o.id,
      label: o.label,
      note: `${o.count} mods`,
      recommended: o.gameVersion === recVersion
    }));
  } else if (question.id === "size") {
    const count = coverage[chosenLoader]?.[chosenVersion] ?? 0;
    displayOptions = sizeOptionsFor(count).map((o) => ({
      id: o.id,
      label: o.label,
      recommended: o.recommended
    }));
  } else {
    displayOptions = question.options.map((o) => ({ id: o.id, label: o.label }));
  }

  const toggle = useCallback(
    (optionId: string) => {
      setAnswers((prev) => {
        const current = prev[question.id] ?? [];
        if (question.kind === "single") {
          return { ...prev, [question.id]: [optionId] };
        }
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [question.id]: next };
      });
    },
    [question]
  );

  const finish = useCallback(
    (final: QuizAnswers) => {
      try {
        sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(final));
        sessionStorage.removeItem(PROGRESS_KEY); // quiz is complete; nothing to resume
      } catch {
        // sessionStorage may be unavailable (private mode); results page falls back.
      }
      router.push("/results");
    },
    [router]
  );

  const next = useCallback(() => {
    if (!canAdvance) return;
    if (step < total - 1) setStep((s) => s + 1);
    else finish(answers);
  }, [canAdvance, step, total, finish, answers]);

  const back = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  // Keyboard: number keys pick options, Enter advances, Backspace goes back.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (resume) return; // resume offer is up — let the user choose first
      if (e.key === "Enter") {
        next();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      } else {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= displayOptions.length) {
          toggle(displayOptions[n - 1].id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, toggle, displayOptions, resume]);

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <Link className="nav-cta" href="/">Exit</Link>
        </div>
      </header>

      <main className="quiz">
        {resume && (
          <div className="resume-banner" role="alert">
            <div>
              <strong>Pick up where you left off?</strong>
              <span> You were on question {resume.step + 1} of {total}.</span>
            </div>
            <div className="resume-actions">
              <button type="button" className="btn-primary" onClick={applyResume}>Resume</button>
              <button type="button" className="btn-ghost" onClick={startOver}>Start over</button>
            </div>
          </div>
        )}

        <div className="quiz-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
        <div className="quiz-step">QUESTION {step + 1} / {total}</div>

        <h2>{question.prompt}</h2>
        {question.help && <p className="help">{question.help}</p>}
        {question.id === "version" && (
          <p className="help">
            Recommended for {chosenLoader.charAt(0).toUpperCase() + chosenLoader.slice(1)}:{" "}
            {recVersion} (biggest mod selection).
          </p>
        )}

        <div className="quiz-options" role={question.kind === "single" ? "radiogroup" : "group"}>
          {displayOptions.map((opt, i) => {
            const isSel = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={`quiz-option${isSel ? " selected" : ""}`}
                aria-pressed={isSel}
                onClick={() => toggle(opt.id)}
              >
                <span className="key">{i + 1}</span>
                <span className="quiz-option-label">{opt.label}</span>
                {opt.recommended && <span className="quiz-tag">Recommended</span>}
                {opt.note && <span className="quiz-note">{opt.note}</span>}
              </button>
            );
          })}
        </div>

        <div className="quiz-nav">
          <button type="button" className={`btn-ghost${step === 0 ? " btn-disabled" : ""}`} onClick={back}>Back</button>
          <span className="spacer" />
          <button type="button" className={`btn-primary${canAdvance ? "" : " btn-disabled"}`} onClick={next}>
            {step < total - 1 ? "Next" : "See my loadout"}
          </button>
        </div>
      </main>
    </>
  );
}
