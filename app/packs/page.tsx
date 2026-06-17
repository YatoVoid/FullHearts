import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { HEART_SRC } from "@/lib/asset";
import { PACKS } from "@/lib/packs/packs";

export const metadata: Metadata = {
  title: "Curated Minecraft modpacks | Full Hearts",
  description:
    "Hand-tested, named Minecraft modpacks you can download as a single one-click .mrpack file. Performance, cozy, adventure and magic.",
  alternates: { canonical: "/packs" }
};

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

const RARITY = ["r-epic", "r-rare", "r-uncommon", "r-common"];

export default function Packs() {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <nav className="links">
            <Link href="/explore">Explore</Link>
            <Link href="/collections">Collections</Link>
          </nav>
          <Link className="nav-cta" href="/quiz">Start the quiz</Link>
        </div>
      </header>

      <main className="explore">
        <div className="section-head">
          <div className="eyebrow">READY-MADE · HAND-TESTED</div>
          <h2>Curated modpacks</h2>
          <p className="intro-lede">
            Pre-built, compatibility-checked loadouts. Pick one and grab the whole thing as a single one-click modpack
            file. No quiz needed.
          </p>
        </div>

        <div className="grid">
          {PACKS.map((pack, i) => (
            <Link className={`tip pack-card ${RARITY[i % RARITY.length]}`} href={`/packs/${pack.slug}`} key={pack.slug}>
              <div className="pack-emoji" aria-hidden="true">{pack.emoji}</div>
              <div className="row1"><span className="title">{pack.name}</span></div>
              <div className="pack-tagline">{pack.tagline}</div>
              <p className="desc">{pack.description}</p>
              <div className="pack-meta">
                {pack.mods.length} mods · {pack.loader[0].toUpperCase() + pack.loader.slice(1)} {pack.mcVersion}
              </div>
              <span className="pack-go">View pack →</span>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </>
  );
}
