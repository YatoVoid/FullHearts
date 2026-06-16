"use client";

import { useEffect } from "react";

// In-content, clearly-labeled ad. Renders a manual unit only once BOTH a client
// id and a slot id exist, so no empty boxes appear before ad units are created
// in AdSense. (Auto ads still run from the script in layout.tsx meanwhile.)
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-8767210732134186";

export default function AdSlot({ slot }: { slot?: string }) {
  useEffect(() => {
    if (!CLIENT || !slot) return;
    try {
      // @ts-expect-error adsbygoogle is injected by the AdSense script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet / blocked — ignore.
    }
  }, [slot]);

  if (!CLIENT || !slot) return null;

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
