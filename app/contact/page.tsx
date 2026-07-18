import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { HEART_SRC } from "@/lib/asset";

export const metadata: Metadata = {
  title: "Contact | Full Hearts",
  description:
    "How to reach Full Hearts: report a pack that won't launch, suggest a mod for the catalogue, flag a mistake, or ask about advertising."
};

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

const REPO = "https://github.com/YatoVoid/FullHearts";

export default function Contact() {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <Link className="nav-cta" href="/quiz">Start the quiz</Link>
        </div>
      </header>

      <main className="prose">
        <h1>Contact</h1>
        <p>
          Full Hearts is a small, independent project, and feedback from players is what keeps the catalogue accurate.
          The best way to reach me is through the project&apos;s GitHub, where messages are read and answered directly.
        </p>

        <p>
          <a className="nav-cta" href={`${REPO}/issues/new`} target="_blank" rel="noopener noreferrer">
            Open an issue on GitHub
          </a>
        </p>

        <h2>What to reach out about</h2>
        <ul>
          <li>
            <strong>A pack that won&apos;t launch.</strong> Tell me the loader, the game version, and which mods were in
            it. Compatibility is checked carefully, but the modded ecosystem changes constantly, and a broken combination
            gets added to the blocklist quickly once it&apos;s reported.
          </li>
          <li>
            <strong>Suggest a mod for the catalogue.</strong> If there&apos;s a mod you think belongs here, send its
            Modrinth link and a line about who it&apos;s for. Every addition is reviewed by hand.
          </li>
          <li>
            <strong>Fix a mistake.</strong> Wrong tag, wrong version, an outdated recommendation &mdash; point it out and
            it gets corrected.
          </li>
          <li>
            <strong>Advertising and business.</strong> For ad, sponsorship, or partnership questions, use the same GitHub
            channel and mark it clearly.
          </li>
        </ul>

        <h2>Response time</h2>
        <p>
          This is a one-person project, so replies come as time allows &mdash; usually within a few days. Bug reports
          that stop a pack from launching are prioritised over everything else.
        </p>

        <p>
          For how your data is handled, see the <Link href="/privacy">Privacy</Link> page; for the rules of using the
          site, see <Link href="/terms">Terms</Link>. To learn how the recommender works, read{" "}
          <Link href="/about">About</Link>.
        </p>
      </main>

      <Footer />
    </>
  );
}
