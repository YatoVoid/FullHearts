import Link from "next/link";
import Footer from "@/components/Footer";
import { QUESTIONS } from "@/lib/curation/questions";
import { CATALOG } from "@/lib/curation/catalog";
import { HEART_SRC } from "@/lib/asset";
import DescribeBox from "@/components/DescribeBox";
import LuckyButton from "@/components/LuckyButton";
import Icon from "@/components/Icon";

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
    "Pick the Minecraft mods you want and Full Hearts pulls in every dependency, version matches them to your loader, and checks they run together against live data, then exports one .mrpack you import and launch. New to mods? A quick quiz builds a set for you.",
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
          <Link className="nav-cta" href="/explore">Build a pack</Link>
        </div>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-glow" aria-hidden="true" />
          <div className="eyebrow">AUTO-VERIFIED · DEPENDENCY-CHECKED · MINECRAFT JAVA</div>
          <div className="hearts" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ width: 30, height: 30, display: "inline-flex", animationDelay: `${i * 60}ms` }}>{HEART}</span>
            ))}
          </div>
          <h1>Pick the mods you love. We make them <span className="g">work together</span>.</h1>
          <p className="lede">Add any mods and Full Hearts pulls in every dependency, version matches them to your loader, and checks they actually run together. Then it&apos;s one file you import and launch. New to mods? Take the quiz and we&apos;ll build a set from scratch.</p>
          <div className="hero-actions">
            <Link className="btn-primary" href="/explore">Add your mods</Link>
            <LuckyButton className="btn-ghost" />
            <Link className="btn-ghost" href="/quiz">New? Take the quiz</Link>
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
          <div className="stat"><div className="num">1 file</div><div className="lab">Installs the whole pack</div></div>
          <div className="stat"><div className="num">0</div><div className="lab">Accounts required</div></div>
          <div className="stat"><div className="num">{QUESTIONS.length}</div><div className="lab">Quick questions, optional</div></div>
        </section>

        <section className="wrap">
          <div className="mrpack-band">
            <div className="mrpack-emoji" aria-hidden="true"><Icon name="package" size={40} /></div>
            <div className="mrpack-text">
              <div className="eyebrow">THE ONE-CLICK MODPACK</div>
              <h2>One file. The whole pack. Made to launch clean.</h2>
              <p>
                Download your pack as a single <code>.mrpack</code>. Every mod <strong>and its dependencies</strong> are
                bundled and version matched, then checked to work together against live data before you download. Import it
                into the Modrinth App, Prism, or ATLauncher in one click. No other mod recommender does this.
              </p>
              <div className="hero-actions" style={{ justifyContent: "flex-start" }}>
                <Link className="btn-primary" href="/explore">Build my modpack</Link>
                <Link className="btn-ghost" href="/install">How it works</Link>
              </div>
            </div>
          </div>
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
              <div className="row1"><span className="title">3 · One-click install</span><span className="loader">.MRPACK</span></div>
              <p className="desc">Download the whole loadout as one modpack file, dependencies included, and import it into your launcher. It just launches.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>No per-mod hunting</div>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
