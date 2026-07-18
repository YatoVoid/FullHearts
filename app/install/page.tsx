import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Icon from "@/components/Icon";
import { HEART_SRC, asset } from "@/lib/asset";

export const metadata: Metadata = {
  title: "How to install your mods | Full Hearts",
  description:
    "Install your whole Full Hearts loadout in one click with a .mrpack file, or follow the manual Modrinth-collection route."
};

const DOWNLOADER = "https://github.com/kay-xr/modrinth-collection-downloader/releases";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

interface Step {
  img?: string;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Log into Modrinth",
    body: (
      <>
        Open <a href="https://modrinth.com/auth/sign-in" target="_blank" rel="noopener noreferrer">modrinth.com</a> and
        sign in (or create a free account). Collections are saved to your account.
      </>
    )
  },
  {
    img: "/guide/1.png",
    title: "Click “Publish”",
    body: <>On Modrinth, open the <strong>Publish</strong> menu in the top-right.</>
  },
  {
    img: "/guide/2.png",
    title: "Create a collection",
    body: <>Choose <strong>Create a collection</strong> and name it whatever you like.</>
  },
  {
    img: "/guide/3.png",
    title: "Open all your mods & add them",
    body: (
      <>
        Back on your <Link href="/collections">collection</Link> (or results) page, hit{" "}
        <strong>“Open all mod pages”</strong>. Every mod opens in its own tab. On each Modrinth tab, click{" "}
        <strong>+</strong> and add it to the collection you just made.
      </>
    )
  },
  {
    img: "/guide/4.png",
    title: "Auto-download with the collection downloader",
    body: (
      <>
        Download the <a href={DOWNLOADER} target="_blank" rel="noopener noreferrer">Modrinth Collection Downloader</a> from
        GitHub and run the <code>.exe</code>. Paste your <strong>collection ID</strong> (it&apos;s in the collection&apos;s
        URL), and it downloads every mod automatically into a <code>mods</code> folder next to the exe. Drag that{" "}
        <code>mods</code> folder into your Minecraft directory and launch. Done!
      </>
    )
  }
];

export default function Install() {
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
            <Link href="/quiz">Quiz</Link>
          </nav>
          <Link className="nav-cta" href="/collections">My collections</Link>
        </div>
      </header>

      <main className="install">
        <div className="section-head">
          <div className="eyebrow">HOW TO INSTALL YOUR MODS</div>
          <h2>One file. The whole pack.</h2>
          <p className="intro-lede">
            Full Hearts builds you a single modpack file. Import it into a launcher and every mod installs at once,
            already checked to work together. No clicking through each page.
          </p>
        </div>

        {/* Method 1: the easy, recommended path */}
        <section className="method method-primary">
          <div className="method-head">
            <span className="method-badge">RECOMMENDED</span>
            <h3>One-click modpack (.mrpack)</h3>
          </div>
          <ol className="steps">
            <li className="step">
              <div className="step-body">
                <div className="step-num">1</div>
                <div>
                  <h3>Get a launcher that reads .mrpack</h3>
                  <p>
                    Use the{" "}
                    <a href="https://modrinth.com/app" target="_blank" rel="noopener noreferrer">Modrinth App</a>,{" "}
                    <a href="https://prismlauncher.org" target="_blank" rel="noopener noreferrer">Prism Launcher</a>, or{" "}
                    <a href="https://atlauncher.com" target="_blank" rel="noopener noreferrer">ATLauncher</a> (all free).
                  </p>
                </div>
              </div>
            </li>
            <li className="step">
              <div className="step-body">
                <div className="step-num">2</div>
                <div>
                  <h3>Download your modpack</h3>
                  <p>
                    On your <Link href="/collections">collections</Link> or results page, click{" "}
                    <strong>“Download as modpack (.mrpack)”</strong>. You get one small file.
                  </p>
                </div>
              </div>
            </li>
            <li className="step">
              <div className="step-body">
                <div className="step-num">3</div>
                <div>
                  <h3>Import it and play</h3>
                  <p>
                    In your launcher choose <strong>Add instance → From file</strong> (or just drag the{" "}
                    <code>.mrpack</code> in). It downloads and installs every mod for you. Launch and play.
                  </p>
                  <p className="install-note" style={{ marginTop: 8 }}>
                    The file lands in your <strong>Downloads</strong> folder — don&apos;t double-click it. Import it from
                    <em> inside</em> the launcher using the step above.
                  </p>
                </div>
              </div>
            </li>
          </ol>
          <div className="install-cta">
            <Link className="btn-primary" href="/collections">Open my collections</Link>
          </div>
          <p className="install-note">Works for Fabric, Quilt, Forge &amp; NeoForge loadouts. Modrinth-hosted mods only.</p>
        </section>

        {/* Method 2: manual fallback */}
        <section className="method method-alt">
          <div className="method-head">
            <span className="method-badge alt">MANUAL</span>
            <h3>Prefer a Modrinth collection?</h3>
          </div>
          <p className="intro-lede" style={{ marginBottom: 24 }}>
            You can also build a Modrinth collection and pull it down with a community tool. Slower, but works on any
            loader.
          </p>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li className="step" key={i}>
                <div className="step-body">
                  <div className="step-num">{i + 1}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </div>
                {step.img && (
                  <img className="step-img" src={asset(step.img)} alt={step.title} loading="lazy" />
                )}
              </li>
            ))}
          </ol>
          <div className="install-cta">
            <a className="btn-ghost" href={DOWNLOADER} target="_blank" rel="noopener noreferrer">
              <Icon name="download" size={15} /> Get the collection downloader
            </a>
            <Link className="btn-ghost" href="/collections">Open my collections</Link>
          </div>
          <p className="install-note">
            The downloader is a third-party open-source tool. Always review what you run, and only download mods from
            official sources.
          </p>
        </section>

        {/* Written guide: what you need, troubleshooting, servers */}
        <section className="method method-alt">
          <div className="method-head">
            <span className="method-badge alt">BEFORE YOU START</span>
            <h3>What you need</h3>
          </div>
          <ul className="guide-list">
            <li>
              <strong>Minecraft: Java Edition.</strong> Mods only work on Java, not Bedrock (the phone, console, and
              Windows 10/11 Store version). If you can install Forge or Fabric, you have Java.
            </li>
            <li>
              <strong>A launcher that reads <code>.mrpack</code>.</strong> The{" "}
              <a href="https://modrinth.com/app" target="_blank" rel="noopener noreferrer">Modrinth App</a>,{" "}
              <a href="https://prismlauncher.org" target="_blank" rel="noopener noreferrer">Prism Launcher</a>, or{" "}
              <a href="https://atlauncher.com" target="_blank" rel="noopener noreferrer">ATLauncher</a>. All are free and
              install the correct Java runtime and mod loader for you, which is the part people usually get wrong by hand.
            </li>
            <li>
              <strong>A little RAM headroom.</strong> A small pack runs fine on 4 GB; heavier packs are happier with 6&ndash;8 GB.
              You set this in the launcher&apos;s instance settings, not in the game.
            </li>
          </ul>
        </section>

        <section className="method method-alt">
          <div className="method-head">
            <span className="method-badge alt">TROUBLESHOOTING</span>
            <h3>When something won&apos;t launch</h3>
          </div>
          <p className="intro-lede" style={{ marginBottom: 24 }}>
            Most modded crashes are not the mods being broken &mdash; they are a mismatch between loader, version, or a
            missing dependency. Here are the ones that come up most, and why the one-click <code>.mrpack</code> avoids
            them.
          </p>

          <h3>&ldquo;The game crashed&rdquo; or a missing-dependency error on startup</h3>
          <p>
            A mod almost always needs one or more library mods to run (Fabric API, Architectury, GeckoLib, and so on).
            Miss one and the game closes with a log most players can&apos;t read. The <code>.mrpack</code> Full Hearts
            builds already includes the full dependency chain for every mod, resolved for your exact loader and version,
            so this is the single biggest reason to use the one-click route over adding jars by hand.
          </p>

          <h3>A mod says it requires a different Minecraft version</h3>
          <p>
            Every mod in a pack has to be built for the <em>same</em> game version and the <em>same</em> loader. A Forge
            1.20.1 jar will not load on Fabric, and a 1.21 jar will not load on 1.20.1. Full Hearts resolves each mod to a
            concrete build for the version and loader you chose and drops anything that has no matching file, so a pack
            you export here is already version-consistent.
          </p>

          <h3>Some mods are missing from my pack</h3>
          <p>
            If a mod has no stable build for your loader and version, or a required dependency of it doesn&apos;t, it gets
            left out rather than shipped in a pack that won&apos;t start. The results screen lists exactly what was
            excluded and why. Switching to a version with wider support (1.20.1 and 1.21.1 are the safest right now)
            usually brings the missing mods back.
          </p>

          <h3>It works in single-player but not when I join a server</h3>
          <p>
            A server needs the <em>same version</em> of every mod that adds content or networking. Client-only mods &mdash;
            a minimap, an inventory search like JEI &mdash; belong on your client and should not be on the server, and
            forcing them there causes a mismatch. Build the server&apos;s mod set from the same loadout so the shared mods
            line up exactly.
          </p>

          <h3>Is this safe to run?</h3>
          <p>
            The mods download from Modrinth&apos;s own CDN, and the jars stay the work and property of their authors. Full
            Hearts never bundles or re-hosts mod files. Whatever route you take, only download mods from official sources
            like Modrinth or CurseForge, and treat any tool that asks you to run an <code>.exe</code> with the usual care.
          </p>
        </section>

        <section className="method method-alt">
          <div className="method-head">
            <span className="method-badge alt">SERVERS</span>
            <h3>Putting the pack on a server</h3>
          </div>
          <p>
            To play with friends, the shared mods have to match on both sides. The clean way is to build the server&apos;s
            set from the same loadout you play on, so every content mod is the identical version client and server. Keep
            purely client-side mods (minimaps, JEI, shaders) off the server, and add server-only tools (permissions, a web
            map, chat filters) separately. If a specific mod refuses to load on the server, tell me which one on the{" "}
            <Link href="/contact">Contact</Link> page and it gets checked against the catalogue.
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
