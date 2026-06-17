// Server-host referral CTA. Defaults to our Shockbyte referral ($4/sale);
// override with NEXT_PUBLIC_HOST_REF to swap providers (e.g. BisectHosting
// https://www.bisecthosting.com/clients/aff.php?aff=7330) without a code change.
const HOST_REF =
  process.env.NEXT_PUBLIC_HOST_REF ||
  "https://panel.shockbyte.com/refer/883382c0cadf9f25e5aab31b74cc6463";

/** Non-intrusive, contextual prompt to rent a server for multiplayer modpacks. */
export default function ServerCta() {
  return (
    <aside className="server-cta">
      <div className="server-cta-body">
        <strong>Playing with friends?</strong>
        <span>Run your modpack on an always-on server. Set up in minutes, no port forwarding.</span>
      </div>
      <div className="server-cta-actions">
        {/* rel="sponsored" per Google guidance for paid/affiliate links */}
        <a className="btn-primary" href={HOST_REF} target="_blank" rel="noopener noreferrer sponsored">
          Get a server
        </a>
        <span className="server-cta-disc">Affiliate link. Supports Full Hearts at no cost to you.</span>
      </div>
    </aside>
  );
}
