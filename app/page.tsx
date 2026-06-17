import Link from "next/link";
import Footer from "@/components/Footer";
import { QUESTIONS } from "@/lib/curation/questions";
import { CATALOG } from "@/lib/curation/catalog";
import { HEART_SRC } from "@/lib/asset";
import DescribeBox from "@/components/DescribeBox";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Full Hearts",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  description:
    "A hand-tested, curated Minecraft mod collection. Answer a few questions and get a personalized, compatible loadout you can't go wrong with, plus a reason for every pick.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <header className="nav">
        <div className="nav-inner">
          <div className="brand">
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </div>
          <nav className="links">
            <Link href="/explore">Explore</Link>
            <Link href="/collections">Collections</Link>
          </nav>
          <Link className="nav-cta" href="/quiz">Start the quiz</Link>
        </div>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-glow" aria-hidden="true" />
          <div className="eyebrow">CURATED · HAND-TESTED · MINECRAFT JAVA</div>
          <div className="hearts" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ width: 30, height: 30, display: "inline-flex", animationDelay: `${i * 60}ms` }}>{HEART}</span>
            ))}
          </div>
          <h1>A mod collection you <span className="g">can&apos;t go wrong</span> with.</h1>
          <p className="lede">Every mod in Full Hearts is hand-picked and tested, so there are no duds. Answer a few quick questions about how you like to play and we&apos;ll build you a compatible loadout, with a reason behind every pick.</p>
          <div className="hero-actions">
            <Link className="btn-primary" href="/quiz">Build my loadout</Link>
            <Link className="btn-ghost" href="/explore">Browse mods</Link>
            <Link className="btn-ghost" href="/results?lucky=1">🎲 Feeling lucky</Link>
          </div>
          <div className="xpbar"><i className="xpfill" /></div>
          <div className="xplabel">NO ACCOUNT · SAVED IN YOUR BROWSER</div>
        </section>

        <section className="wrap describe-section">
          <div className="section-head">
            <div className="eyebrow">OR JUST TELL ME</div>
            <h2>Describe your dream game</h2>
          </div>
          <DescribeBox />
        </section>

        <section className="stats wrap">
          <div className="stat"><div className="num">{CATALOG.length}</div><div className="lab">Hand-tested mods</div></div>
          <div className="stat"><div className="num">{QUESTIONS.length}</div><div className="lab">Quick questions</div></div>
          <div className="stat"><div className="num">0</div><div className="lab">Accounts required</div></div>
        </section>

        <section className="wrap" id="how" style={{ padding: "70px 0 90px" }}>
          <div className="section-head">
            <div className="eyebrow">HOW IT WORKS</div>
            <h2>Three steps to your loadout</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">1 · Take the quiz</span><span className="loader">~2 MIN</span></div>
              <p className="desc">Tell us how you like to play (building, exploring, automating, fighting) plus your version and mod loader.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>No jargon, one question at a time</div>
            </article>
            <article className="tip r-rare">
              <div className="row1"><span className="title">2 · Get your loadout</span><span className="loader">RANKED</span></div>
              <p className="desc">We rank compatible mods to your taste and show a plain-English reason for every pick, with dependencies flagged.</p>

              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>A reason behind every mod</div>
            </article>
            <article className="tip r-epic">
              <div className="row1"><span className="title">3 · Save &amp; install</span><span className="loader">1-CLICK</span></div>
              <p className="desc">Save the collection in your browser, then open install links straight to Modrinth or CurseForge.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>Export &amp; share your build</div>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
