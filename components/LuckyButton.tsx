"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isModrinthUp } from "@/lib/catalog/clientPool";
import Icon from "@/components/Icon";

/** Shared honest wording for "Modrinth's live data is down" — reused on the
 *  results page so users hear the same clear, blame-free explanation everywhere. */
export const MODRINTH_DOWN_TITLE = "Mod data is down right now";
export const MODRINTH_DOWN_BODY =
  "Modrinth's API — where we read every mod, version, and dependency — isn't responding at the moment. This isn't your connection or anything wrong on our end. We won't hand you a pack we can't verify will launch, so this is paused until their data is back. Please try again in a few minutes.";

/**
 * The "Feeling lucky" (dice) button, gated on Modrinth being reachable. While we
 * don't know yet, it stays enabled (optimistic); if the API is confirmed down it
 * becomes a clearly-disabled chip with the honest reason on hover — because a
 * randomized pack we can't validate is exactly what we promise never to ship.
 */
export default function LuckyButton({ className = "btn-ghost" }: { className?: string }) {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    let on = true;
    isModrinthUp().then((v) => { if (on) setUp(v); });
    return () => { on = false; };
  }, []);

  if (up === false) {
    return (
      <span
        className={`${className} is-disabled`}
        role="button"
        aria-disabled="true"
        title={MODRINTH_DOWN_BODY}
      >
        <Icon name="dice" size={15} /> Feeling lucky · unavailable
      </span>
    );
  }
  return <Link className={className} href="/results?lucky=1"><Icon name="dice" size={15} /> Feeling lucky</Link>;
}
