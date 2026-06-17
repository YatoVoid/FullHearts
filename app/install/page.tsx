import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { HEART_SRC, asset } from "@/lib/asset";

export const metadata: Metadata = {
  title: "Install your whole loadout at once | Full Hearts",
  description:
    "Turn your Full Hearts loadout into a Modrinth collection and auto-download every mod in one go, no clicking through each page."
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
          <div className="eyebrow">INSTALL EVERYTHING AT ONCE</div>
          <h2>Get your whole loadout in a few clicks</h2>
          <p className="intro-lede">
            Instead of downloading each mod one by one, save your loadout as a Modrinth collection and let a small tool
            grab them all. Here&apos;s the five-step flow.
          </p>
        </div>

        <div className="compat compat-ok" style={{ maxWidth: 620, margin: "0 auto 30px" }}>
          ⚡ Easiest way: on your <Link href="/collections" style={{ color: "var(--grass)" }}>collections</Link> or
          results page, hit <strong>“Download as modpack (.mrpack)”</strong> and import the single file into the Modrinth
          App, Prism, or ATLauncher. No steps below needed. (Fabric &amp; Quilt.)
        </div>

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
          <a className="btn-primary" href={DOWNLOADER} target="_blank" rel="noopener noreferrer">
            ⬇ Get the collection downloader
          </a>
          <Link className="btn-ghost" href="/collections">Open my collections</Link>
        </div>

        <p className="install-note">
          The downloader is a third-party open-source tool. Always review what you run, and only download mods from
          official sources.
        </p>
      </main>

      <Footer />
    </>
  );
}
