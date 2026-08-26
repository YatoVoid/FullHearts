import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { HEART_SRC } from "@/lib/asset";

export const metadata: Metadata = {
  title: "Privacy | Full Hearts",
  description: "How Full Hearts handles data: no accounts, local-only storage, and the third parties we rely on."
};

const HEART = (
  <img
    src={HEART_SRC}
    alt=""
    aria-hidden="true"
    style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
  />
);

export default function Privacy() {
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
        <h1>Privacy</h1>
        <p>Full Hearts is built to need as little of your data as possible.</p>

        <h2>What we store</h2>
        <p>
          Your quiz answers and saved collections live only in your own browser (localStorage and sessionStorage).
          They never leave your device and we cannot see them. Clearing your browser data removes them.
        </p>

        <h2>EduCraft access requests</h2>
        <p>
          If a parent or guardian submits our <Link href="/register">EduCraft request form</Link>, we store: the
          child&rsquo;s nickname, age, and Minecraft Java username, and the parent&rsquo;s name, phone number, and
          (optionally) email. We never ask the child for contact information directly &mdash; the parent submits
          everything, and every request is reviewed by hand before any account is active. This data is stored on our
          own server, used only to review and manage whitelist access, and is not sold or shared, other than
          optionally routing a copy of the submission through <a href="https://formspree.io" target="_blank" rel="noopener noreferrer">Formspree</a> so
          we get a notification. If you want a request or its data removed, email us using the address below.
        </p>

        <h2>Mod data</h2>
        <p>
          Mod information is fetched from the public <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer">Modrinth</a> API.
          We don&apos;t send any personal information to Modrinth.
        </p>

        <h2>Advertising</h2>
        <p>
          We may show ads from Google AdSense to keep the site free. Ad providers may use cookies to serve relevant ads;
          you can manage these through your browser settings or Google&apos;s <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Ads Settings</a>.
        </p>

        <h2>Affiliate links</h2>
        <p>
          Some outbound links (for example, server hosting) are affiliate links. If you sign up through them we may earn a
          commission at no extra cost to you. They&apos;re always labeled.
        </p>

        <h2>Contact</h2>
        <p>Questions about this page? Email <a href="mailto:wali.lambert1960@gmail.com">wali.lambert1960@gmail.com</a> or see the <Link href="/contact">Contact</Link> page.</p>
      </main>

      <Footer />
    </>
  );
}
