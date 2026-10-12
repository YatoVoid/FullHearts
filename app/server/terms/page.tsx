import type { Metadata } from "next";
import Link from "next/link";
import { EduHeader, EduFooter } from "@/components/server/EduChrome";
import { PRICE_LABEL, TERMS_VERSION, contactEmail } from "@/lib/educraft";

// The contact address comes from the runtime env, which the build step doesn't have.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "EduCraft terms | Full Hearts" };

export default function TermsPage() {
  const contact = contactEmail();
  return (
    <>
      <EduHeader />
      <main className="page">
        <div className="wrap legal">
          <h1>EduCraft terms</h1>
          <p className="hint">Version {TERMS_VERSION}</p>

          <p>
            These terms cover paid access to EduCraft, a private Minecraft Java Edition server for children, run by the
            Full Hearts team. The parent or guardian who signs up agrees to them on behalf of their family.
          </p>

          <h2>What you get</h2>
          <p>
            Each subscription gives one child a spot on the EduCraft whitelist for the realm we assign. Your child needs
            their own Minecraft Java Edition account and the EduCraft mod pack. We don&rsquo;t sell Minecraft itself, and
            EduCraft isn&rsquo;t affiliated with or endorsed by Mojang or Microsoft.
          </p>

          <h2>Approval comes first</h2>
          <p>
            Every request is reviewed by hand. We may decline a request without giving a reason. Nothing is charged until
            a request is approved and you start the subscription.
          </p>

          <h2>Price and renewal</h2>
          <ul>
            <li>{PRICE_LABEL} per child per month, charged in US dollars through Stripe.</li>
            <li>The subscription renews automatically each month until you cancel.</li>
            <li>We&rsquo;ll email you before any price change takes effect, and you can cancel before it does.</li>
          </ul>

          <h2>Cancelling</h2>
          <p>
            Cancel any time from <Link href="/server/account/">your account</Link>. Access ends right away, and we
            refund the unused days of the current month to the card you paid with. If you only want to change cards, use
            Manage billing instead of cancelling, and access continues.
          </p>

          <h2>Missed payments</h2>
          <p>
            If a monthly payment fails, your child keeps access for 24 hours while you update the card. After that, access
            is removed until the payment goes through. Removal can take up to a few hours after the 24 hours end.
          </p>

          <h2>Rules on the server</h2>
          <p>
            Players must be kind, keep chat clean, and leave other players&rsquo; builds alone. Play also follows the{" "}
            <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noopener noreferrer">Minecraft EULA</a>{" "}
            and Mojang&rsquo;s usage guidelines. We may suspend a player who breaks the rules. If we end access for good,
            we refund the unused days.
          </p>

          <h2>No guarantees</h2>
          <p>
            We work to keep the server running, but it can go down for maintenance, updates or problems outside our
            control. EduCraft is provided as it is, to the extent the law allows.
          </p>

          <h2>Changes to these terms</h2>
          <p>We&rsquo;ll email you about any change that matters before it applies, and ask you to agree again if it&rsquo;s significant.</p>

          <h2>Contact</h2>
          <p>
            {contact ? <>Email <a href={`mailto:${contact}`}>{contact}</a>.</> : <>Use the <Link href="/contact">contact page</Link>.</>}
          </p>
        </div>
      </main>
      <EduFooter />
    </>
  );
}
