"use client";

import { useEffect } from "react";

// In-content, clearly-labeled ad. Renders NOTHING until NEXT_PUBLIC_ADSENSE_CLIENT
// is set, so the experience is never interrupted before ads are live. When set,
// it draws a single responsive AdSense unit in the normal document flow.
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export default function AdSlot({ slot }: { slot?: string }) {
  useEffect(() => {
    if (!CLIENT) return;
    try {
      // @ts-expect-error adsbygoogle is injected by the AdSense script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet / blocked — ignore.
    }
  }, []);

  if (!CLIENT) return null;

  return (
    <div className="ad-slot">
      <span className="ad-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
