import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
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
          <Link className="nav-cta" href="/collections">My collections</Link>
        </div>
      </header>

      <main className="install">
        <div className="section-head">
          <div className="eyebrow">HOW TO INSTALL YOUR MODS</div>
          <h2>One file. The whole loadout.</h2>
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
                </div>
              </div>
            </li>
          </ol>
          <div className="install-cta">
            <Link className="btn-primary" href="/collections">Download my modpack</Link>
          </div>
          <p className="install-note">Works for Fabric &amp; Quilt loadouts. Modrinth-hosted mods only.</p>
        </section>

        {/* Method 2: manual fallback */}
        <section className="method method-alt">
          <div className="method-head">
            <span className="method-badge alt">MANUAL</span>
            <h3>Prefer a Modrinth collection? (or on Forge)</h3>
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
              ⬇ Get the collection downloader
            </a>
            <Link className="btn-ghost" href="/collections">Open my collections</Link>
          </div>
          <p className="install-note">
            The downloader is a third-party open-source tool. Always review what you run, and only download mods from
            official sources.
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
