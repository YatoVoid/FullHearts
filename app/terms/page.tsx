import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { HEART_SRC } from "@/lib/asset";

export const metadata: Metadata = {
  title: "Terms of Use | Full Hearts",
  description: "The terms for using Full Hearts: a free, as-is fan tool for discovering Minecraft mods."
};

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

export default function Terms() {
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
        <h1>Terms of Use</h1>
        <p>Full Hearts is a free, fan-made tool for discovering Minecraft mods. By using it, you agree to these terms.</p>

        <h2>Provided “as is”</h2>
        <p>
          The site and its recommendations, compatibility checks, and generated modpack files are provided “as is”,
          without warranties of any kind. We do our best to surface mods that work together, but we can&apos;t guarantee any
          mod, dependency, or modpack will install or run without issues. Use is at your own risk.
        </p>

        <h2>Third-party mods and downloads</h2>
        <p>
          Full Hearts does not host mods. Links and modpack files point to third-party sources such as Modrinth. We are
          not responsible for third-party content, its licensing, or any harm, data loss, or damage that results from
          downloading or running it. Always download mods from their official sources and review what you run.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Full Hearts and its operator are not liable for any direct, indirect,
          incidental, or consequential damages arising from your use of the site, including game crashes, lost worlds, or
          corrupted files.
        </p>

        <h2>Affiliate links and ads</h2>
        <p>
          Some outbound links (for example, server hosting) are affiliate links, clearly labeled, and the site may show
          ads. See our <Link href="/privacy">Privacy page</Link> for how data is handled.
        </p>

        <h2>Trademarks</h2>
        <p>
          Not affiliated with or endorsed by Mojang or Microsoft. Minecraft is a trademark of Mojang AB. Mod names and
          assets belong to their respective authors.
        </p>

        <h2>Changes</h2>
        <p>These terms may change over time. Continued use after a change means you accept the updated terms.</p>
      </main>

      <Footer />
    </>
  );
}
