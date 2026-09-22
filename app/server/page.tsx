import Link from "next/link";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Icon from "@/components/Icon";
import { HEART_SRC, asset } from "@/lib/asset";
import "./server.css";

const fraunces = localFont({
  src: "./fonts/Fraunces.var.woff2",
  weight: "100 900",
  variable: "--font-fraunces",
  display: "swap"
});
const nunito = localFont({
  src: "./fonts/NunitoSans.var.woff2",
  weight: "200 900",
  variable: "--font-nunito",
  display: "swap"
});

export const metadata: Metadata = {
  title: "EduCraft: our Minecraft server | Full Hearts",
  description:
    "EduCraft is our own private, kid-safe Minecraft Java server: coding, engineering, farming and trading, then exploring a shared survival world. Request access through Full Hearts."
};

const PACK_URL =
  "https://raw.githubusercontent.com/OpenSource-For-Freedom/minecraft/main/data/EduCraftClient.mrpack";
const PACK_VERSION = "1.2.1";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.app";

const LEARN = [
  {
    title: "Write real programs",
    body: "In-game computers run genuine Lua. Kids start with a turtle that digs a straight line and end up automating whole farms.",
    mods: "CC: Tweaked, Advanced Peripherals"
  },
  {
    title: "Engineer contraptions",
    body: "Cogs, belts, pumps and pistons with believable physics. Windmills grind grain, drills mine stone, trains connect bases.",
    mods: "Create"
  },
  {
    title: "Farm, cook and bake",
    body: "Crops need planning, recipes need ingredients, and a working bakery or vineyard needs both.",
    mods: "Farmer’s Delight, Bakery, Vinery"
  },
  {
    title: "Run a shop",
    body: "A real in-game currency with coins, tills and price tags. Kids set prices and find out why the math has to work.",
    mods: "Lightman’s Currency"
  },
  {
    title: "Take on quests",
    body: "A bounty board posts jobs: gather, craft, deliver. Reading a brief and finishing the task is its own lesson.",
    mods: "Bountiful"
  },
  {
    title: "Read the manual",
    body: "Every new player spawns with an illustrated guide book, and a recipe browser answers “what can I make with this?”",
    mods: "Patchouli, Just Enough Items"
  }
];

const ADVENTURE = [
  { title: "Waystones link the world", body: "Named warp points make a big map walkable." },
  { title: "Maps fill in as you go", body: "The minimap and world map only reveal ground you have actually walked." },
  { title: "PvP off, difficulty easy", body: "Players cannot attack each other, and the server forces easy difficulty. Danger stays exciting instead of cruel." },
  { title: "Builds stay protected", body: "Every player can claim their base, and claims show on the map." }
];

type ModRow = { name: string; version: string; note: string };
const MODS: { group: string; rows: ModRow[] }[] = [
  {
    group: "Gameplay",
    rows: [
      { name: "Create", version: "6.0.8", note: "Mechanical engineering: cogs, belts, trains, contraptions" },
      { name: "CC: Tweaked", version: "1.120.0", note: "In-game computers and turtles programmed in real Lua" },
      { name: "Advanced Peripherals", version: "0.7.48r", note: "Lets those computers sense and control the world around them" },
      { name: "CC:C Bridge", version: "1.7.1", note: "Connects computers to Create machinery" },
      { name: "Farmer’s Delight", version: "1.3.2", note: "Deeper farming and a full cooking system" },
      { name: "Bakery", version: "1.1.15", note: "Doughs, ovens and pastries, a working bakery trade" },
      { name: "Vinery", version: "1.4.41", note: "Vineyards and juice-making" },
      { name: "Lightman’s Currency", version: "2.3.0.5", note: "Coins, shops and tills for player-run commerce" },
      { name: "Waystones", version: "14.1.20", note: "Named warp points that make the big world walkable" },
      { name: "Bountiful", version: "6.0.4", note: "A bounty board of gather-and-deliver quests" },
      { name: "Comforts", version: "6.4.0", note: "Sleeping bags and hammocks for expeditions" },
      { name: "Patchouli", version: "85", note: "Powers the illustrated EduCraft guide book" },
      { name: "Just Enough Items", version: "15.20.0.133", note: "Searchable recipes for every item in the pack" },
      { name: "Open Parties and Claims", version: "0.30.3", note: "Claim your base against griefing, land shows up right on the map" }
    ]
  },
  {
    group: "Space travel",
    rows: [{ name: "Ad Astra", version: "1.15.20", note: "Build a rocket and fly to the Moon, Mars, Venus, Mercury and Glacio" }]
  },
  {
    group: "Client-side maps",
    rows: [
      { name: "Xaero’s Minimap", version: "26.3.0", note: "Corner minimap that reveals only where you have been" },
      { name: "Xaero’s World Map", version: "1.43.0", note: "Full-screen map drawn from your own exploration" }
    ]
  },
  {
    group: "On the server only, nothing to install",
    rows: [
      { name: "Terralith", version: "2.5.4", note: "Hundreds of new biomes and far more dramatic terrain" },
      { name: "When Dungeons Arise", version: "2.1.58", note: "Huge hand-built structures: pirate ships, mountain castles, sky keeps" }
    ]
  }
];

const SAFETY = [
  ["Access by request, enforced.", "Nobody joins unless we add their exact username, and removing a name kicks that player immediately."],
  ["Verified accounts only.", "Online-mode is on, so every player is a real, paid Microsoft account."],
  ["Chat is filtered and small.", "A profanity filter runs server-side, and the only people in chat are the handful of kids on the whitelist."],
  ["No PvP, no gear cheats.", "Players cannot attack each other, and the server refuses flight outright."],
  ["Every block change is logged.", "Rollback tooling records who placed, broke or took what, so griefing is provable and reversible."],
  ["Hardened hosting.", "A locked-down container on a firewalled cloud host with security auditing and automated backups."]
];

const FAQ = [
  {
    q: "Does my kid need to buy anything?",
    a: "Minecraft Java Edition (PC or Mac) is required, one purchase from Microsoft. The modpack, the launcher and the server itself are free."
  },
  {
    q: "Will this run on our computer?",
    a: "The pack likes about 4 GB of memory given to the game and a mid-range machine from the last five or six years."
  },
  {
    q: "Why does it say I am not whitelisted?",
    a: "Either the request has not been processed yet, or the username has a typo. Access is granted by hand after you contact us, so it is never instant. Usernames are case-sensitive: send the exact spelling and we will fix it in minutes."
  },
  {
    q: "It says failed to connect, or shows an error full of code.",
    a: "Almost always this means the launcher started plain Minecraft instead of the EduCraft instance. Close the game, go back to your launcher, and press Play on the EduCraft instance itself. It should say Forge 1.20.1."
  },
  {
    q: "Can they play from a friend’s house, or on holiday?",
    a: "Yes, from any network, anywhere in the world. Access is granted to a Minecraft username, never to a home address or connection."
  },
  {
    q: "The game says the mods do not match the server.",
    a: "Your pack is out of date. Download EduCraftClient.mrpack from this page again and open it with your launcher. Your launcher may create a new instance instead of updating the old one, so delete the stale entry to avoid confusion."
  }
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "@id": `${SITE_URL}/server#service`,
      name: "EduCraft",
      serviceType: "Private Minecraft Java server for children",
      description:
        "A whitelisted Minecraft Java Forge 1.20.1 server where children learn programming with in-game computers, mechanical engineering, farming, cooking and running a shop, then explore a large modded world. Access is by request through Full Hearts.",
      audience: { "@type": "Audience", audienceType: "Children and their parents" },
      areaServed: "Worldwide",
      isAccessibleForFree: true,
      provider: { "@type": "Organization", name: "Full Hearts", url: SITE_URL }
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/server#faq`,
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a }
      }))
    }
  ]
};

const CHECK = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m3.5 9.5 3.5 3.5 7.5-8" />
  </svg>
);

export default function ServerPage() {
  return (
    <div className={`edu ${fraunces.variable} ${nunito.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <header className="topbar">
        <div className="wrap topbar__row">
          <Link className="wordmark" href="/">
            <img src={HEART_SRC} alt="" aria-hidden="true" />
            Full<span>Hearts</span>
          </Link>
          <nav aria-label="Server page">
            <a href="#learn">Learn</a>
            <a href="#adventure">Adventure</a>
            <a href="#join">How to join</a>
            <a href="#mods">Mods</a>
            <a href="#parents">Parents</a>
            <a className="btn btn--primary" href={PACK_URL} download>Get the pack</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="stage" style={{ backgroundImage: `url(${asset("/server/stars.svg")})` }}>
          <div className="wrap hero__grid">
            <div>
              <h1>Education and adventure, on a server built for kids</h1>
              <p className="lede">
                EduCraft is a small, private Minecraft Java server. Kids write Lua programs on in-game computers,
                engineer contraptions, run farms, bakeries and shops, then explore a shared survival world. No
                strangers, no PvP, no chat with the open internet.
              </p>
              <div className="hero__cta">
                <a className="btn btn--primary" href={PACK_URL} download>
                  <Icon name="download" size={16} /> Download the modpack
                </a>
                <a className="btn btn--ghost" href="#join">How to join</a>
              </div>
              <p className="hero__meta">
                EduCraftClient v{PACK_VERSION}, 17 mods. Imports into the Modrinth App, Prism Launcher or ATLauncher.
              </p>
            </div>

            <aside className="glance" aria-labelledby="glance-title">
              <div className="glance__head">
                <h2 id="glance-title">The server at a glance</h2>
                <span className="pill">Private</span>
              </div>
              <dl>
                <dt>Minecraft</dt><dd>Java 1.20.1</dd>
                <dt>Mod loader</dt><dd>Forge 47.4.20</dd>
                <dt>Players</dt><dd>20 at a time</dd>
                <dt>Access</dt><dd><Link href="/register">Request access</Link></dd>
              </dl>
              <p className="glance__note">
                The server address is not published. We send it privately to each family when their request is
                approved, and anyone who is not approved is refused at the door.
              </p>
            </aside>
          </div>
          <div className="hero__art" aria-hidden="true">
            <img src={asset("/server/hero-night.svg")} alt="" />
          </div>
        </section>

        <section className="section" id="learn">
          <div className="wrap">
            <div className="sechead">
              <h2>What kids learn</h2>
              <p className="lede">Every mod on the server was picked because it teaches something while it plays like a game.</p>
            </div>
            <div className="ledger">
              {LEARN.map((item) => (
                <article className="ledger__item" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <p className="ledger__mods"><strong>Mods:</strong> {item.mods}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section deep" id="adventure">
          <div className="wrap">
            <div className="sechead">
              <h2>Then they close the book and go exploring</h2>
              <p className="lede">
                It is still survival Minecraft: mountains to cross, caves to light and bases to defend, tuned so the
                danger is exciting instead of cruel.
              </p>
            </div>
            <div className="deep-grid">
              {ADVENTURE.map((item) => (
                <div key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="join">
          <div className="wrap">
            <div className="sechead">
              <h2>How to join</h2>
              <p className="lede">You need Minecraft Java Edition on a PC or Mac, and about ten minutes.</p>
            </div>
            <ol className="stepper">
              <li className="stepper__item">
                <h3>Sign in to Minecraft Java Edition</h3>
                <p>The server accepts real Microsoft-account logins only, the same account that owns Minecraft Java. Every player is a verified, named account, never anonymous.</p>
              </li>
              <li className="stepper__item">
                <h3>Get a mod launcher and import the pack</h3>
                <p>
                  Install the <a href="https://modrinth.com/app" target="_blank" rel="noopener noreferrer">Modrinth App</a>,{" "}
                  <a href="https://prismlauncher.org" target="_blank" rel="noopener noreferrer">Prism Launcher</a> or{" "}
                  <a href="https://atlauncher.com" target="_blank" rel="noopener noreferrer">ATLauncher</a>, then import
                  the pack below. It installs Forge 1.20.1 and the exact mod versions the server runs.
                </p>
                <a className="btn btn--primary" href={PACK_URL} download>
                  <Icon name="download" size={16} /> Download EduCraftClient.mrpack v{PACK_VERSION}
                </a>
              </li>
              <li className="stepper__item">
                <h3>Ask us for access</h3>
                <p>
                  EduCraft is invite-only. A parent or guardian fills out the <Link href="/register">request form</Link>{" "}
                  with the player&rsquo;s exact Minecraft username, and we review it by hand. Access is never instant.
                </p>
                <a className="btn btn--primary" href="/register">Request access</a>
                <p className="step-note">Use a nickname, never a child&rsquo;s real name. Spell the username exactly, capitals included.</p>
              </li>
              <li className="stepper__item">
                <h3>Add the server and play</h3>
                <p>
                  When your request is approved we send the server address privately with the confirmation. In the
                  game, choose Multiplayer, then Add Server, and paste it in.
                </p>
                <p>
                  Press Play on the <strong>EduCraft instance</strong>, not on plain Minecraft. An ordinary copy has
                  no Forge, so the server turns it away before it reaches the whitelist.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section section--raised" id="mods">
          <div className="wrap">
            <div className="sechead">
              <h2>Every mod in the pack, and why it is there</h2>
            </div>
            <div className="table-scroll">
              <table className="mods-table">
                <caption>
                  EduCraftClient v{PACK_VERSION}, Minecraft 1.20.1, Forge 47.4.20. Server-side tooling (chat filter,
                  block logging, permissions, worldgen packs) is not part of the client pack.
                </caption>
                <thead>
                  <tr><th scope="col">Mod</th><th scope="col">Version</th><th scope="col">What it does here</th></tr>
                </thead>
                <tbody>
                  {MODS.map((g) => (
                    <GroupRows key={g.group} group={g.group} rows={g.rows} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section" id="parents">
          <div className="wrap">
            <div className="sechead">
              <h2>Built like it matters</h2>
            </div>
            <div className="parents-grid">
              <ul className="checks">
                {SAFETY.map(([lead, rest]) => (
                  <li key={lead}>{CHECK}<span><strong>{lead}</strong> {rest}</span></li>
                ))}
              </ul>
              <aside className="aside">
                <h3>About the server address</h3>
                <p>This page never shows it and makes no network call to look it up.</p>
                <p>We share it privately, family by family, once a whitelist request is approved.</p>
              </aside>
            </div>
          </div>
        </section>

        <section className="section section--raised" id="faq">
          <div className="wrap">
            <div className="sechead">
              <h2>Questions we get asked</h2>
            </div>
            <div className="faq">
              {FAQ.map(({ q, a }) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
            <p className="faq__more">
              More questions? <Link href="/contact">Get in touch</Link>. The server source is on{" "}
              <a href="https://github.com/OpenSource-For-Freedom/minecraft" target="_blank" rel="noopener noreferrer">GitHub</a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="footer__row">
            <div>
              <Link className="wordmark" href="/">
                <img src={HEART_SRC} alt="" aria-hidden="true" />
                Full<span>Hearts</span>
              </Link>
              <p>Minecraft mod tools and a private server for kids. Always download mods from official sources such as Modrinth or CurseForge.</p>
            </div>
            <nav aria-label="Site">
              <Link href="/explore">Explore mods</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </nav>
          </div>
          <div className="footer__legal">
            <p>Not affiliated with or endorsed by Mojang or Microsoft. Minecraft is a trademark of Mojang AB.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function GroupRows({ group, rows }: { group: string; rows: ModRow[] }) {
  return (
    <>
      <tr className="group"><td colSpan={3}>{group}</td></tr>
      {rows.map((r) => (
        <tr key={r.name}>
          <td>{r.name}</td>
          <td className="ver">{r.version}</td>
          <td>{r.note}</td>
        </tr>
      ))}
    </>
  );
}
