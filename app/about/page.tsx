import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { HEART_SRC } from "@/lib/asset";

export const metadata: Metadata = {
  title: "About | Full Hearts",
  description:
    "Who makes Full Hearts and how the Minecraft mod recommender actually works: the quiz, the compatibility checks, and the hand-curated catalogue behind every suggestion."
};

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

export default function About() {
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
        <h1>About Full Hearts</h1>
        <p>
          Full Hearts is a Minecraft mod recommender. You answer a short quiz about how you like to play, and it hands
          you a small, compatible modpack you can actually install, instead of a wall of a thousand mods to sort through
          yourself. It is a fan project, built and maintained by one independent developer who has spent years running
          modded Minecraft servers for friends, and it grew out of a problem I kept hitting in person.
        </p>

        <h2>Why it exists</h2>
        <p>
          Getting into modded Minecraft is genuinely hard for a newcomer, and it is hard in a way that has nothing to do
          with the mods being bad. The friction is everywhere else. You have to know which loader you are on (Forge,
          Fabric, Quilt, NeoForge), which of those a mod supports, whether a mod supports your exact game version,
          whether two mods you want will even launch together, and which extra library mods each one silently depends on.
          Get any of that wrong and the game crashes on startup with a log that means nothing to most players. I watched
          friend after friend give up at exactly that step. Full Hearts is my attempt to remove that step so the fun part
          &mdash; playing &mdash; starts sooner.
        </p>

        <h2>How the recommender actually works</h2>
        <p>
          The suggestions are not random and they are not sponsored placements. Under the hood there are a few real steps,
          and it is worth being transparent about them because &ldquo;an algorithm chose these&rdquo; usually hides
          nothing at all.
        </p>
        <ul>
          <li>
            <strong>The quiz reads your intent.</strong> Your answers map to play-style signals &mdash; do you want
            technical automation, cozy building, exploration, performance, visual polish, or a bit of everything &mdash;
            and how heavy a pack you can tolerate. There is no account and nothing is uploaded; your answers stay in your
            own browser.
          </li>
          <li>
            <strong>Scoring against a hand-curated catalogue.</strong> Every mod that can be recommended has been reviewed
            and tagged by hand, not scraped wholesale. Each one carries what it is good for, who it is for, and why it
            earns a slot. The scorer weighs those tags against your intent so the pack fits the way you actually want to
            play.
          </li>
          <li>
            <strong>Compatibility is checked, not assumed.</strong> This is the part that separates a real recommendation
            from a list. The tool resolves each mod to a concrete, deliverable build for your chosen loader and game
            version, follows its required-dependency chain, and drops anything that would not launch. A known-bad
            blocklist catches specific mods that crash on specific loader and version combinations even when their public
            metadata claims otherwise.
          </li>
          <li>
            <strong>You leave with a real file.</strong> The result exports as a standard <code>.mrpack</code> you can
            drop into the Modrinth App, Prism, or ATLauncher, so the whole loadout installs at once rather than being
            clicked together mod by mod.
          </li>
        </ul>

        <h2>The curation philosophy</h2>
        <p>
          The catalogue is deliberately small and opinionated. A recommender that suggests everything is just a search
          box, and it pushes the hardest decisions back onto the person least equipped to make them. So the bar for a mod
          to be included is simple: it has to be stable on the versions we target, it has to play well with the other
          mods people are likely to pick alongside it, and it has to earn its place for a clear reason. When a mod is
          known to break a common combination, it is blocked outright rather than quietly shipped in a pack that will not
          start. The goal is that a pack you build here launches the first time.
        </p>

        <h2>Who it is for</h2>
        <p>
          It is aimed at players who want to enjoy modded Minecraft without becoming a part-time compatibility engineer:
          newcomers taking their first step past vanilla, and busy players who just want a good pack for the weekend
          without an afternoon of research. Experienced pack-makers are welcome too &mdash; the compatibility resolution
          and the one-file export save time even when you already know what you want.
        </p>

        <h2>Honesty and limits</h2>
        <p>
          Full Hearts is a fan-made tool and is not affiliated with, endorsed by, or sponsored by Mojang, Microsoft,
          Modrinth, or any mod author. Mod information comes from the public{" "}
          <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer">Modrinth</a> API, and the mods
          themselves remain the work and property of their creators. Always download mods from official sources. The
          compatibility checks are careful but the modded ecosystem moves fast, so if something does not launch,{" "}
          <Link href="/contact">let me know</Link> and the catalogue or blocklist gets fixed.
        </p>

        <p>
          If you want to see it in action, the fastest way is to just{" "}
          <Link href="/quiz">take the quiz</Link> or <Link href="/explore">browse the catalogue by tag</Link>.
        </p>
      </main>

      <Footer />
    </>
  );
}
