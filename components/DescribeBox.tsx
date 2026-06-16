"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { converse, PROFILE_STORAGE_KEY, type ConversationTurn } from "@/lib/recommend/intent";

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
    const result = turn?.intent ?? converse(text).intent;
    if (!result) {
      setTurn(converse(text)); // nudge the user with a "tell me more" reply
      return;
    }
    try {
      sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(result.profile));
    } catch {
      // sessionStorage unavailable — results page falls back to the quiz.
    }
    router.push("/results?mode=describe");
  }

  const canGenerate = Boolean(turn?.intent);

  return (
    <div className="describe">
      <label className="describe-label" htmlFor="describe-input">
        Describe your ideal Minecraft gameplay
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
    </div>
  );
}
