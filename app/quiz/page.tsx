"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QUESTIONS, type QuizAnswers } from "@/lib/curation/questions";

const ANSWERS_KEY = "fullhearts:answers";
const PROGRESS_KEY = "fullhearts:progress";

interface SavedProgress {
  step: number;
  answers: QuizAnswers;
}

const HEART = (
  <img
    src="/heart.png"
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
        if (Number.isInteger(n) && n >= 1 && n <= question.options.length) {
          toggle(question.options[n - 1].id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, toggle, question, resume]);

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

        <div className="quiz-options" role={question.kind === "single" ? "radiogroup" : "group"}>
          {question.options.map((opt, i) => {
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
                {opt.label}
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
