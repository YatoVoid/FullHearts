"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QUESTIONS, type QuizAnswers } from "@/lib/curation/questions";

const ANSWERS_KEY = "fullhearts:answers";

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
  }, [next, back, toggle, question]);

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
