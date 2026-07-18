import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { HEART_SRC } from "@/lib/asset";

export const metadata: Metadata = {
  title: "About | Full Hearts",
  description:
    "What Full Hearts does: adds mod dependencies, checks compatibility, keeps a server matched to your client, and moves a loadout to another Minecraft version. A short quiz helps if you are new."
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
          <Link className="nav-cta" href="/explore">Build a pack</Link>
        </div>
      </header>

      <main className="prose">
        <h1>About Full Hearts</h1>
        <p>
          Full Hearts is a tool that makes a Minecraft modpack actually work. You pick the mods you want, and it handles
          the parts that usually break a pack: it adds every dependency, checks the mods run together on your loader and
          version, keeps a server matched to your client, and moves a whole loadout to a different version when you need
          to. It is a fan project, built and maintained by one independent developer who has spent years running modded
          Minecraft servers for friends.
        </p>

        <h2>Why it exists</h2>
        <p>
          The mods are the easy part of modded Minecraft. The friction is everywhere around them. You have to know which
          loader you are on (Forge, Fabric, Quilt, NeoForge), which of those each mod supports, whether it supports your
          exact game version, whether two mods you want will launch together, and which extra library mods each one
          quietly depends on. One wrong choice and the game crashes on startup with a log that means nothing to most
          players. Full Hearts was built to take that whole problem off your hands so you get to play sooner.
        </p>

        <h2>What it does</h2>
        <ul>
          <li>
            <strong>Adds every dependency.</strong> Most mods need library mods to run, and a missing one is the most
            common startup crash. Full Hearts follows each mod&apos;s full dependency chain and pulls in what it needs,
            resolved for your loader and version.
          </li>
          <li>
            <strong>Checks compatibility for real.</strong> It resolves each mod to a concrete build for your chosen
            loader and version and drops anything that has no matching file. A known-bad list catches mods that crash on
            specific loader and version combinations even when their public data claims they are fine.
          </li>
          <li>
            <strong>Keeps your server matched to your client.</strong> It builds a server mod set from the same loadout
            you play on, at the same versions, and leaves client only mods off the server, so you and your friends line
            up instead of getting a version mismatch on join.
          </li>
          <li>
            <strong>Moves a pack to another version.</strong> Point a loadout at a different Minecraft version or loader
            and it re-resolves every mod to a build that works there, then shows you anything that could not come along.
          </li>
          <li>
            <strong>Exports one file.</strong> The result downloads as a standard <code>.mrpack</code> for the Modrinth
            App, Prism, or ATLauncher, so the whole loadout installs at once instead of being clicked together mod by mod.
          </li>
        </ul>

        <h2>Not sure what to pick?</h2>
        <p>
          If you are new to mods and do not know where to start, a short quiz suggests a starter pack based on how you
          like to play. It is optional. Everything the mod tools do above works the same whether you bring your own list
          or let the quiz build one. There is no account and nothing is uploaded; your answers stay in your own browser.
        </p>

        <h2>The catalogue</h2>
        <p>
          The mods the quiz can suggest are reviewed and tagged by hand, not scraped in bulk. Each one carries what it is
          good for and why it earns a place. The bar is simple: a mod has to be stable on the versions we target and play
          well with the mods people pick alongside it. When a mod is known to break a common combination it gets blocked,
          so a pack you build here launches the first time.
        </p>

        <h2>Honesty and limits</h2>
        <p>
          Full Hearts is a fan-made tool with no affiliation to Mojang, Microsoft, Modrinth, or any mod author. Mod
          information comes from the public{" "}
          <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer">Modrinth</a> API, and the mods stay
          the work and property of their creators. Always download mods from official sources. The compatibility checks
          are careful, but the modded ecosystem moves fast, so if something does not launch,{" "}
          <Link href="/contact">tell me</Link> and the catalogue or the known-bad list gets fixed.
        </p>

        <p>
          To try it, <Link href="/explore">add your own mods</Link>, or{" "}
          <Link href="/quiz">take the quiz</Link> if you want a starting point.
        </p>
      </main>

      <Footer />
    </>
  );
}
