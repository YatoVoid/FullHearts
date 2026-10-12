import type { Metadata } from "next";
import Link from "next/link";
import { EduHeader, EduFooter } from "@/components/server/EduChrome";
import SignOutButton from "@/components/server/SignOutButton";
import KidCard from "@/components/server/KidCard";
import { requireParent } from "@/lib/parent-session";
import { listChildrenForParent } from "@/lib/children";
import { contactEmail } from "@/lib/educraft";
import { kidStatus } from "@/lib/kid-status";
import { billingEnabled, subscriptionForChild } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Your account | EduCraft",
  robots: { index: false }
};

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const parent = await requireParent("/server/account/");
  const kids = listChildrenForParent(parent.id);
  const contact = contactEmail();
  const billingOn = billingEnabled();
  const paidNotice = (await searchParams).notice === "paid";

  return (
    <>
      <EduHeader>
        <SignOutButton />
      </EduHeader>
      <main className="page">
        <div className="wrap">
          <div className="page__head">
            <h1>Your account</h1>
            <p className="lede">Signed in as {parent.email}.</p>
          </div>

          {paidNotice && (
            <div className="alert alert--ok" role="status">
              Payment received. Your child is being added to the server, which usually takes a few minutes. We emailed
              you a receipt and the terms.
            </div>
          )}

          <div className="panel">
            <div className="row-between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Your children</h2>
              <Link className="btn btn--ghost" href="/server/register/">Add a child</Link>
            </div>
            {kids.length === 0 ? (
              <p>
                No requests yet. <Link href="/server/register/">Request access</Link> for your child to get started.
              </p>
            ) : (
              kids.map((kid) => (
                <KidCard key={kid.id} kid={kid} status={kidStatus(kid, subscriptionForChild(kid.id), billingOn)} />
              ))
            )}
          </div>

          <div className="panel">
            <h2>Questions</h2>
            <p>
              {contact ? (
                <>
                  Email us at <a href={`mailto:${contact}`}>{contact}</a>. We answer every message.
                </>
              ) : (
                <>
                  Reach us through the <Link href="/contact">contact page</Link>.
                </>
              )}
            </p>
          </div>
        </div>
      </main>
      <EduFooter />
    </>
  );
}
