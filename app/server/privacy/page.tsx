import type { Metadata } from "next";
import Link from "next/link";
import { EduHeader, EduFooter } from "@/components/server/EduChrome";
import { TERMS_VERSION, contactEmail } from "@/lib/educraft";

// The contact address comes from the runtime env, which the build step doesn't have.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "EduCraft privacy notice | Full Hearts" };

export default function EduPrivacyPage() {
  const contact = contactEmail();
  const reach = contact ? (
    <a href={`mailto:${contact}`}>{contact}</a>
  ) : (
    <Link href="/contact">our contact page</Link>
  );
  return (
    <>
      <EduHeader />
      <main className="page">
        <div className="wrap legal">
          <h1>EduCraft privacy notice</h1>
          <p className="hint">Version {TERMS_VERSION}. This is our notice to parents under the Children&rsquo;s Online Privacy Protection Act (COPPA).</p>

          <p>
            EduCraft is a Minecraft server for children, run by the Full Hearts team. Only a parent or guardian can sign
            a child up, and we never ask a child for contact details.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li><strong>From you:</strong> your email, your name, and optionally a phone number.</li>
            <li><strong>About each child:</strong> a nickname, their age, and their Minecraft Java username and account ID.</li>
            <li><strong>On the server:</strong> chat messages and in-game actions, such as blocks placed and broken. These are kept so we can filter chat and look into problems.</li>
            <li><strong>Payments:</strong> handled by Stripe. We never see or store card numbers.</li>
          </ul>

          <h2>How we use it</h2>
          <p>
            To review requests, put approved children on the server, bill you, email you about the account, and keep the
            server safe. We don&rsquo;t sell it, we don&rsquo;t use it for advertising, and we don&rsquo;t build profiles of children.
          </p>

          <h2>Who else sees it</h2>
          <ul>
            <li><strong>Stripe</strong> processes payments and sees your email and card details, never your child&rsquo;s.</li>
            <li><strong>Resend</strong> delivers our emails to you.</li>
            <li><strong>Mojang</strong> receives the Minecraft username when we check that the account exists.</li>
          </ul>

          <h2>How long we keep it</h2>
          <ul>
            <li>Requests we don&rsquo;t approve: deleted after 30 days.</li>
            <li>After access ends: your child&rsquo;s details are deleted 90 days later.</li>
            <li>Billing records stay with Stripe as tax law requires.</li>
          </ul>

          <h2>Your rights</h2>
          <p>
            You can see what we hold about your child, ask us to delete it, or tell us to stop collecting it. Stopping
            means your child can no longer play. Email {reach} and we&rsquo;ll answer within 10 days.
          </p>

          <h2>Contact</h2>
          <p>Questions about this notice: {reach}.</p>
        </div>
      </main>
      <EduFooter />
    </>
  );
}
