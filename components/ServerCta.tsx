// Server-host affiliate CTA (both links are our affiliate URLs).
// BisectHosting is the primary "Get a server": it installs Modrinth (.mrpack)
// modpacks in ONE click (exactly what this site exports) and its budget tier is
// $2.99/mo, premium $7.99/mo for real modded RAM.
// Shockbyte is the secondary "Budget option": its entry tier is cheaper
// (~$1.99-2.50/mo), so it's the genuine cheapest pick. (Verified June 2026.)
// Override either via env ONLY with another affiliate URL.
const BISECT =
  process.env.NEXT_PUBLIC_HOST_REF_BISECT ||
  "https://www.bisecthosting.com/clients/aff.php?aff=7330";
const SHOCKBYTE =
  process.env.NEXT_PUBLIC_HOST_REF ||
  "https://shockbyte.com/billing/aff.php?aff=11335";

/** Contextual prompt to rent a server for a multiplayer modpack. */
export default function ServerCta({
  compact = false,
  heading,
  body
}: {
  compact?: boolean;
  heading?: string;
  body?: string;
}) {
  return (
    <aside className={`server-cta${compact ? " server-cta-compact" : ""}`}>
      <div className="server-cta-body">
        <strong>{heading ?? "Playing with friends?"}</strong>
        <span>{body ?? "Run your modpack on an always-on server. BisectHosting installs Modrinth packs in one click."}</span>
      </div>
      <div className="server-cta-actions">
        {/* rel="sponsored" per Google guidance for paid/affiliate links */}
        <a className="btn-primary" href={BISECT} target="_blank" rel="noopener noreferrer sponsored">
          Get a server
        </a>
        <span className="server-cta-disc">
          Affiliate links, no cost to you.{" "}
          <a href={SHOCKBYTE} target="_blank" rel="noopener noreferrer sponsored">Budget option →</a>
        </span>
      </div>
    </aside>
  );
}
