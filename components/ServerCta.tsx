// Server-host affiliate CTA. BisectHosting is primary because it installs
// Modrinth (.mrpack) modpacks in one click and runs a recurring creator
// program; Shockbyte ($4/sale) is the budget secondary. Override either via env.
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
