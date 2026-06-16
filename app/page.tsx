import Link from "next/link";

const HEART = (
  <svg viewBox="0 0 9 9" aria-hidden="true">
    <path d="M1 0h2v1h1V0h2v1h1v1h1v3h-1v1h-1v1h-1v1H4v-1H3V6H2V5H1V4H0V1h1z" fill="#b3000c" />
    <path d="M1 1h2v1h1v1h1V2h1V1h2v1H7v1h1v1H7v1H6v1H5v1H4V6H3V5H2V4H1V2H0V1h1z" fill="#fb1f2c" />
    <path d="M1 1h1v1H1zM3 1h1v1H3z" fill="#ff8a90" />
  </svg>
);

export default function Home() {
  return (
    <>
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
          <div className="eyebrow">PERSONALIZED · MINECRAFT JAVA</div>
          <div className="hearts" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ width: 30, height: 30, display: "inline-flex", animationDelay: `${i * 60}ms` }}>{HEART}</span>
            ))}
          </div>
          <h1>Find the <span className="g">perfect mods</span><br />without the guesswork.</h1>
          <p className="lede">Answer a few quick questions about how you like to play. We&apos;ll build you a compatible mod loadout — and tell you exactly why each one made the cut.</p>
          <div className="hero-actions">
            <Link className="btn-primary" href="/quiz">Build my loadout</Link>
            <Link className="btn-ghost" href="/explore">Browse mods</Link>
            <Link className="btn-ghost" href="/results?lucky=1">🎲 Feeling lucky</Link>
          </div>
          <div className="xpbar"><i className="xpfill" /></div>
          <div className="xplabel">NO ACCOUNT · SAVED IN YOUR BROWSER</div>
        </section>

        <section className="stats wrap">
          <div className="stat"><div className="num">9</div><div className="lab">Quick questions</div></div>
          <div className="stat"><div className="num">0</div><div className="lab">Accounts required</div></div>
          <div className="stat"><div className="num">100%</div><div className="lab">Reasons explained</div></div>
        </section>

        <section className="wrap" id="how" style={{ padding: "70px 0 90px" }}>
          <div className="section-head">
            <div className="eyebrow">HOW IT WORKS</div>
            <h2>Three steps to your loadout</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">1 · Take the quiz</span><span className="loader">~2 MIN</span></div>
              <p className="desc">Tell us how you like to play — building, exploring, automating, fighting — plus your version and mod loader.</p>
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

      <footer>
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
          <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
          <span className="name">FULL<b>HEARTS</b></span>
        </div>
        <p>A fan-made mod recommender. Always download from official sources like Modrinth or CurseForge.</p>
        <p className="note">Not affiliated with or endorsed by Mojang or Microsoft. Minecraft is a trademark of Mojang AB.</p>
      </footer>
    </>
  );
}
