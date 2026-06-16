import Link from "next/link";
import { HEART_SRC } from "@/lib/asset";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

/** Shared site footer: brand, data attribution, legal links and disclaimers. */
export default function Footer() {
  return (
    <footer>
      <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
        <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
        <span className="name">FULL<b>HEARTS</b></span>
      </div>
      <p>A fan-made mod recommender. Always download from official sources like Modrinth or CurseForge.</p>
      <a
        className="bmc"
        href="https://buymeacoffee.com/walilambere"
        target="_blank"
        rel="noopener noreferrer"
      >
        ☕ Buy me a coffee
      </a>
      <p className="note">
        Mod data from <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer">Modrinth</a>.
        {" · "}<Link href="/privacy">Privacy</Link>
      </p>
      <p className="note">Not affiliated with or endorsed by Mojang or Microsoft. Minecraft is a trademark of Mojang AB.</p>
    </footer>
  );
}
