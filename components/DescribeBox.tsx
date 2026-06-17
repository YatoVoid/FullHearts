"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { converse, QUERY_STORAGE_KEY, type ConversationTurn } from "@/lib/recommend/intent";

// Natural-language entry point. Feels like a smart assistant but is 100% local:
// converse() classifies the message and parseIntent() builds a real Profile that
// /results scores against the actual catalog. No model, no API, no key.
export default function DescribeBox() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [turn, setTurn] = useState<ConversationTurn | null>(null);
  const [thinking, setThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced "thinking" so a reply only appears after you stop typing.
  useEffect(() => {
    if (!text.trim()) {
      setTurn(null);
      setThinking(false);
      return;
    }
    setThinking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTurn(converse(text));
      setThinking(false);
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text]);

  function generate() {
    const current = turn ?? converse(text);
    if (!current.canGenerate) {
      setTurn(current); // nudge the user with a "tell me more" reply
      return;
    }
    try {
      // Store the raw text; /results parses + lexically searches it so it can
      // match mod descriptions, not just tags.
      sessionStorage.setItem(QUERY_STORAGE_KEY, text.trim());
    } catch {
      // sessionStorage unavailable — results page falls back to the quiz.
    }
    router.push("/results?mode=describe");
  }

  const canGenerate = Boolean(turn?.canGenerate);

  return (
    <div className="describe">
      <label className="describe-label" htmlFor="describe-input">
        Describe your ideal Minecraft gameplay
        <span className="beta-badge">AI · BETA</span>
      </label>
      <textarea
        id="describe-input"
        className="describe-input"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. cozy builder who loves exploring, runs on an old laptop, plays with friends"
      />

      <div className="describe-reply" role="status" aria-live="polite">
        {thinking ? <span className="describe-typing">Thinking<i>.</i><i>.</i><i>.</i></span> : turn?.reply}
      </div>

      <button type="button" className="btn-primary" onClick={generate} disabled={!canGenerate}>
        Generate my mod setup
      </button>
      <p className="describe-note">The assistant is in beta and still learning — results improve as the mod library grows.</p>
    </div>
  );
}
