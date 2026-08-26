import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Icon from "@/components/Icon";
import { HEART_SRC } from "@/lib/asset";

export const metadata: Metadata = {
  title: "EduCraft: our Minecraft server | Full Hearts",
  description:
    "EduCraft is our own private, kid-safe Minecraft Java server: coding, engineering, farming and trading, then exploring a shared survival world. Request access through Full Hearts."
};

const PACK_URL =
  "https://raw.githubusercontent.com/OpenSource-For-Freedom/minecraft/main/data/EduCraftClient.mrpack";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.app";

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

const CHECK = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m3.5 9.5 3.5 3.5 7.5-8" />
  </svg>
);

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
      mainEntity: [
        {
          "@type": "Question",
          name: "Does my kid need to buy anything?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Minecraft Java Edition (PC or Mac) is required, one purchase from Microsoft. The modpack, the launcher and the server itself are free."
          }
        },
        {
          "@type": "Question",
          name: "Why does it say I am not whitelisted?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Either the request has not been processed yet, or the username has a typo. Access is granted by hand after you contact us, so it is never instant."
          }
        },
        {
          "@type": "Question",
          name: "Can they play from a friend's house, or on holiday?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, from any network, anywhere in the world. Access is granted to a Minecraft username, never to a home address or connection."
          }
        }
      ]
    }
  ]
};

export default function ServerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <header className="nav">
        <div className="nav-inner">
          <Link className="brand" href="/" style={{ textDecoration: "none" }}>
            <span className="heart" style={{ width: 26, height: 26, display: "inline-flex" }}>{HEART}</span>
            <span className="name">FULL<b>HEARTS</b></span>
          </Link>
          <nav className="links">
            <Link href="/explore">Explore</Link>
            <Link href="/server">Our server</Link>
          </nav>
          <a className="nav-cta" href="#join">Get the pack</a>
        </div>
      </header>

      <main className="server-page">
        <div className="section-head">
          <div className="eyebrow">A FULL HEARTS PROJECT · REQUEST ACCESS</div>
          <h2>EduCraft: education and adventure, on a server built for kids</h2>
          <p className="intro-lede">
            EduCraft is our own private Minecraft Java server: a small, whitelisted world where kids write real Lua
            programs on in-game computers, engineer contraptions, run farms and shops, then set out to explore a
            shared survival world. No strangers, no PvP, no chat with the open internet.
          </p>
          <div className="hero-actions">
            <a className="btn-primary" href={PACK_URL} download>
              <Icon name="download" size={15} /> Download the modpack
            </a>
            <a className="btn-ghost" href="#join">How to join</a>
          </div>
        </div>

        {/* ---------- learn ---------- */}
        <section style={{ marginBottom: 60 }}>
          <div className="section-head">
            <div className="eyebrow">THE EDUCATION PART</div>
            <h2>A curriculum kids do not notice they are taking</h2>
            <p className="intro-lede">
              Every mod on the server was picked because it teaches something while it plays like a game.
            </p>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">Write real programs</span></div>
              <p className="desc">In-game computers run genuine Lua. Kids start with a turtle that digs a straight line and end up automating whole farms.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>CC: Tweaked, Advanced Peripherals</div>
            </article>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">Engineer contraptions</span></div>
              <p className="desc">Cogs, belts, pumps and pistons with believable physics. Windmills grind grain, drills mine stone, trains connect bases.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>Create</div>
            </article>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">Farm, cook and bake</span></div>
              <p className="desc">Crops need planning, recipes need ingredients, and a working bakery or vineyard needs both.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>Farmer&rsquo;s Delight, Bakery, Vinery</div>
            </article>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">Run a shop</span></div>
              <p className="desc">A real in-game currency with coins, tills and price tags. Kids set prices and learn why the math has to work.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>Lightman&rsquo;s Currency</div>
            </article>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">Take on quests</span></div>
              <p className="desc">A bounty board posts jobs: gather, craft, deliver. Reading a brief and finishing the task is its own lesson.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>Bountiful</div>
            </article>
            <article className="tip r-uncommon">
              <div className="row1"><span className="title">Read the manual</span></div>
              <p className="desc">Every new player spawns with an illustrated guide book, and a recipe browser answers what can I make with this.</p>
              <div className="fix"><span style={{ width: 14, height: 14, display: "inline-flex" }}>{HEART}</span>Patchouli, Just Enough Items</div>
            </article>
          </div>
        </section>

        {/* ---------- adventure ---------- */}
        <section style={{ marginBottom: 60 }}>
          <div className="section-head">
            <div className="eyebrow">THE ADVENTURE PART</div>
            <h2>Then they close the book and go exploring</h2>
            <p className="intro-lede">
              It is still survival Minecraft: mountains to cross, caves to light and bases to defend, tuned so the
              danger is exciting instead of cruel.
            </p>
          </div>
          <div className="principles">
            <span><b>&#10003;</b> Waystones link the whole world</span>
            <span><b>&#10003;</b> Maps fill in only where you&rsquo;ve been</span>
            <span><b>&#10003;</b> PvP off, forced difficulty easy</span>
            <span><b>&#10003;</b> Builds stay protected</span>
          </div>
          <div className="stats">
            <div className="stat"><div className="num">1.20.1</div><div className="lab">Minecraft Java, Forge</div></div>
            <div className="stat"><div className="num">23</div><div className="lab">Hand-picked mods</div></div>
            <div className="stat"><div className="num">20</div><div className="lab">Players per server</div></div>
            <div className="stat"><div className="num">0</div><div className="lab">PvP, griefing, command blocks</div></div>
          </div>
        </section>

        {/* ---------- join ---------- */}
        <section id="join" style={{ marginBottom: 60, scrollMarginTop: 80 }}>
          <div className="section-head">
            <div className="eyebrow">HOW TO JOIN</div>
            <h2>Four steps from zero to online</h2>
            <p className="intro-lede">You need Minecraft Java Edition on a PC or Mac, and about ten minutes.</p>
          </div>
          <ol className="steps">
            <li className="step">
              <div className="step-body">
                <div className="step-num">1</div>
                <div>
                  <h3>Sign in to Minecraft Java Edition</h3>
                  <p>The server accepts real Microsoft-account logins only, the same account that owns Minecraft Java. Every player is a verified, named account, never anonymous.</p>
                </div>
              </div>
            </li>
            <li className="step">
              <div className="step-body">
                <div className="step-num">2</div>
                <div>
                  <h3>Get a mod launcher and import the pack</h3>
                  <p>
                    Install the <a href="https://modrinth.com/app" target="_blank" rel="noopener noreferrer">Modrinth App</a>,{" "}
                    <a href="https://prismlauncher.org" target="_blank" rel="noopener noreferrer">Prism Launcher</a>, or{" "}
                    <a href="https://atlauncher.com" target="_blank" rel="noopener noreferrer">ATLauncher</a>, then import the pack below.
                    It installs Forge 1.20.1 plus the exact mod versions the server runs.
                  </p>
                  <div className="install-cta" style={{ justifyContent: "flex-start", margin: "16px 0 0" }}>
                    <a className="btn-primary" href={PACK_URL} download>
                      <Icon name="download" size={15} /> EduCraftClient.mrpack &middot; v1.2.1
                    </a>
                  </div>
                </div>
              </div>
            </li>
            <li className="step">
              <div className="step-body">
                <div className="step-num">3</div>
                <div>
                  <h3>Ask us for access</h3>
                  <p>
                    EduCraft is invite-only and stays that way. There is no signup form and no instant access: send us
                    the player&rsquo;s exact Minecraft username through our <Link href="/contact">contact page</Link>,
                    and we add it by hand. Send the username only, never a child&rsquo;s real name.
                  </p>
                  <div className="install-cta" style={{ justifyContent: "flex-start", margin: "16px 0 0" }}>
                    <Link className="btn-primary" href="/contact">Contact us for access</Link>
                  </div>
                </div>
              </div>
            </li>
            <li className="step">
              <div className="step-body">
                <div className="step-num">4</div>
                <div>
                  <h3>Add the server and play</h3>
                  <p>
                    When your request is approved we send the server address privately along with the confirmation.
                    In the game: Multiplayer, then Add Server, then paste it in.
                  </p>
                  <p style={{ marginTop: 8 }}>
                    Press Play on the <strong>EduCraft instance itself</strong>, not on plain Minecraft. An ordinary
                    copy has no Forge, so the server turns it away before it ever reaches the whitelist.
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </section>

        {/* ---------- mods ---------- */}
        <section style={{ marginBottom: 60 }}>
          <div className="section-head">
            <div className="eyebrow">FULL MANIFEST</div>
            <h2>Every mod in the pack, and why it is there</h2>
          </div>
          <div className="server-table-wrap">
            <table className="server-table">
              <caption>EduCraftClient v1.2.1 &middot; Minecraft 1.20.1 &middot; Forge 47.4.20. Server-side tooling (chat filter, block logging, permissions, worldgen packs) is not part of the client pack.</caption>
              <thead>
                <tr><th scope="col">Mod</th><th scope="col">Version</th><th scope="col">What it does here</th></tr>
              </thead>
              <tbody>
                <tr className="group"><td colSpan={3}>Gameplay</td></tr>
                <tr><td>Create</td><td className="ver">6.0.8</td><td>Mechanical engineering: cogs, belts, trains, contraptions</td></tr>
                <tr><td>CC: Tweaked</td><td className="ver">1.120.0</td><td>In-game computers and turtles programmed in real Lua</td></tr>
                <tr><td>Advanced Peripherals</td><td className="ver">0.7.48r</td><td>Lets those computers sense and control the world around them</td></tr>
                <tr><td>CC:C Bridge</td><td className="ver">1.7.1</td><td>Connects computers to Create machinery</td></tr>
                <tr><td>Farmer&rsquo;s Delight</td><td className="ver">1.3.2</td><td>Deeper farming and a full cooking system</td></tr>
                <tr><td>Bakery</td><td className="ver">1.1.15</td><td>Doughs, ovens and pastries, a working bakery trade</td></tr>
                <tr><td>Vinery</td><td className="ver">1.4.41</td><td>Vineyards and juice-making</td></tr>
                <tr><td>Lightman&rsquo;s Currency</td><td className="ver">2.3.0.5</td><td>Coins, shops and tills for player-run commerce</td></tr>
                <tr><td>Waystones</td><td className="ver">14.1.20</td><td>Named warp points that make the big world walkable</td></tr>
                <tr><td>Bountiful</td><td className="ver">6.0.4</td><td>A bounty board of gather-and-deliver quests</td></tr>
                <tr><td>Comforts</td><td className="ver">6.4.0</td><td>Sleeping bags and hammocks for expeditions</td></tr>
                <tr><td>Patchouli</td><td className="ver">85</td><td>Powers the illustrated EduCraft guide book</td></tr>
                <tr><td>Just Enough Items</td><td className="ver">15.20.0.133</td><td>Searchable recipes for every item in the pack</td></tr>
                <tr><td>Open Parties and Claims</td><td className="ver">0.30.3</td><td>Claim your base against griefing, land shows up right on the map</td></tr>
                <tr className="group"><td colSpan={3}>Space travel</td></tr>
                <tr><td>Ad Astra</td><td className="ver">1.15.20</td><td>Build a rocket and fly to the Moon, Mars, Venus, Mercury and Glacio</td></tr>
                <tr className="group"><td colSpan={3}>Client-side maps</td></tr>
                <tr><td>Xaero&rsquo;s Minimap</td><td className="ver">26.3.0</td><td>Corner minimap that reveals only where you have been</td></tr>
                <tr><td>Xaero&rsquo;s World Map</td><td className="ver">1.43.0</td><td>Full-screen map drawn from your own exploration</td></tr>
                <tr className="group"><td colSpan={3}>On the server only, nothing to install</td></tr>
                <tr><td>Terralith</td><td className="ver">2.5.4</td><td>Hundreds of new biomes and far more dramatic terrain</td></tr>
                <tr><td>When Dungeons Arise</td><td className="ver">2.1.58</td><td>Huge hand-built structures: pirate ships, mountain castles, sky keeps</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- parents ---------- */}
        <section style={{ marginBottom: 60 }}>
          <div className="section-head">
            <div className="eyebrow">FOR PARENTS</div>
            <h2>Built like it matters, because it does</h2>
          </div>
          <ul className="check-list">
            <li>{CHECK}<span><strong>Access by request, enforced.</strong> Nobody joins unless we add their exact username, and removing a name kicks that player immediately.</span></li>
            <li>{CHECK}<span><strong>Verified accounts only.</strong> Online-mode is on, so every player is a real, paid Microsoft account.</span></li>
            <li>{CHECK}<span><strong>Chat is filtered and small.</strong> A profanity filter runs server-side, and the only people in chat are the handful of kids on the whitelist.</span></li>
            <li>{CHECK}<span><strong>No PvP, no gear cheats.</strong> Players cannot attack each other, and the server refuses flight outright.</span></li>
            <li>{CHECK}<span><strong>Every block change is logged.</strong> Rollback tooling records who placed, broke or took what, so griefing is provable and reversible.</span></li>
            <li>{CHECK}<span><strong>Hardened hosting.</strong> A locked-down container on a firewalled cloud host with security auditing and automated backups.</span></li>
          </ul>
          <p className="intro-lede">
            This site sets no cookies, runs no analytics for EduCraft, and makes no network calls to reveal the
            server address. It is shared privately, family by family, once a whitelist request is approved.
          </p>
        </section>

        {/* ---------- faq ---------- */}
        <section>
          <div className="section-head">
            <div className="eyebrow">QUESTIONS</div>
            <h2>The ones we actually get asked</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>Does my kid need to buy anything?</summary>
              <p>Minecraft Java Edition (PC or Mac) is required, one purchase from Microsoft. The modpack, the launcher and the server itself are free.</p>
            </details>
            <details>
              <summary>Will this run on our computer?</summary>
              <p>The pack likes about 4 GB of memory given to the game and a mid-range machine from the last five or six years.</p>
            </details>
            <details>
              <summary>Why does it say I am not whitelisted?</summary>
              <p>Either the request has not been processed yet, or the username has a typo. Access is granted by hand after you contact us, so it is never instant. Usernames are case-sensitive: send the exact spelling and we will fix it in minutes.</p>
            </details>
            <details>
              <summary>It says failed to connect, or shows an error full of code.</summary>
              <p>Almost always this means the launcher started plain Minecraft instead of the EduCraft instance. Close the game, go back to your launcher, and press Play on the EduCraft instance itself. It should say Forge 1.20.1.</p>
            </details>
            <details>
              <summary>Can they play from a friend&rsquo;s house, or on holiday?</summary>
              <p>Yes, from any network, anywhere in the world. Access is granted to a Minecraft username, never to a home address or connection.</p>
            </details>
            <details>
              <summary>The game says the mods do not match the server.</summary>
              <p>Your pack is out of date. Download EduCraftClient.mrpack from this page again and open it with your launcher. Watch for this: your launcher may create a new instance rather than updating the old one, so delete the stale entry to avoid confusion.</p>
            </details>
          </div>
          <p className="intro-lede" style={{ marginTop: 32 }}>
            More questions? <Link href="/contact">Get in touch</Link>. Server source is on{" "}
            <a href="https://github.com/OpenSource-For-Freedom/minecraft" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
