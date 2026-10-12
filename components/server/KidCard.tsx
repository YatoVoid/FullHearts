import type { ChildWithContext } from "@/lib/children";
import type { KidStatus } from "@/lib/kid-status";
import KidBilling from "@/components/server/KidBilling";
import { PACK_URL } from "@/lib/educraft";

export default function KidCard({ kid, status }: { kid: ChildWithContext; status: KidStatus }) {
  return (
    <article className="kid" aria-labelledby={`kid-${kid.id}`}>
      <div className="kid__head">
        <h3 id={`kid-${kid.id}`}>{kid.nickname}</h3>
        <span className="kid__user">{kid.mc_username}</span>
        <span className={`state state--${status.tone}`}>{status.label}</span>
      </div>
      <p>{status.detail}</p>
      {status.action !== "none" && (
        <KidBilling childId={kid.id} nickname={kid.nickname} action={status.action} canCancel={status.canCancel} />
      )}
      {status.showJoin && kid.realm_address && (
        <details>
          <summary>How to join {kid.realm_name}</summary>
          <ol className="join">
            <li>
              Install the <a href="https://modrinth.com/app" target="_blank" rel="noopener noreferrer">Modrinth App</a>,
              Prism Launcher or ATLauncher.
            </li>
            <li>
              Download the <a href={PACK_URL} download>EduCraft pack</a> and import it into that launcher.
            </li>
            <li>Sign in with the Microsoft account that owns {kid.nickname}&rsquo;s Minecraft Java Edition.</li>
            <li>Press Play on the EduCraft instance, not plain Minecraft.</li>
            <li>
              Choose Multiplayer, then Add Server, and enter <code>{kid.realm_address}</code>
            </li>
          </ol>
        </details>
      )}
    </article>
  );
}
