"use client";

import { useEffect, useState } from "react";

/** Floating "back to top" button that appears once you've scrolled past the
 *  fold. Fixed bottom-right, large enough to be a comfortable mobile tap target. */
export default function ScrollTop({ threshold = 450 }: { threshold?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!show) return null;

  return (
    <button
      type="button"
      className="scroll-top"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ▲
    </button>
  );
}
