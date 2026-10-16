import Link from "next/link";
import AccountNav from "@/components/server/AccountNav";
import { HEART_SRC } from "@/lib/asset";

export function EduHeader({ current }: { current?: "account" }) {
  return (
    <header className="topbar">
      <div className="wrap topbar__row">
        <Link className="wordmark" href="/">
          <img src={HEART_SRC} alt="" aria-hidden="true" />
          Full<span>Hearts</span>
        </Link>
        <nav aria-label="EduCraft">
          <Link href="/server/">About EduCraft</Link>
          <AccountNav current={current} />
        </nav>
      </div>
    </header>
  );
}

export function EduFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__row">
          <div>
            <Link className="wordmark" href="/">
              <img src={HEART_SRC} alt="" aria-hidden="true" />
              Full<span>Hearts</span>
            </Link>
            <p>Minecraft mod tools and a private server for kids. Always download mods from official sources such as Modrinth or CurseForge.</p>
          </div>
          <nav aria-label="Site">
            <Link href="/explore">Explore mods</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/server/terms/">EduCraft terms</Link>
            <Link href="/server/privacy/">EduCraft privacy</Link>
          </nav>
        </div>
        <div className="footer__legal">
          <p>Not affiliated with or endorsed by Mojang or Microsoft. Minecraft is a trademark of Mojang AB.</p>
        </div>
      </div>
    </footer>
  );
}
