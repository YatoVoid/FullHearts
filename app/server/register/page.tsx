import type { Metadata } from "next";
import Link from "next/link";
import { EduHeader, EduFooter } from "@/components/server/EduChrome";
import RegisterForm from "@/components/server/RegisterForm";
import { requireParent } from "@/lib/parent-session";
import { PRICE_LABEL } from "@/lib/educraft";

export const metadata: Metadata = {
  title: "Request access | EduCraft",
  description: "Parents and guardians request EduCraft access for their children here. Every request is reviewed by hand.",
  robots: { index: false }
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const parent = await requireParent("/server/register/");

  return (
    <>
      <EduHeader />
      <main className="page">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="page__head">
            <h1>Request EduCraft access</h1>
            <p className="lede">
              Add each child you&rsquo;re registering. We review every request by hand. Once one is approved we email you
              the join steps and a link to start the {PRICE_LABEL}/month subscription. Nothing is charged before that.
              New here? Read <Link href="/server/">how EduCraft works</Link> first.
            </p>
          </div>
          <div className="panel">
            <RegisterForm email={parent.email ?? ""} defaultName={parent.name} defaultPhone={parent.phone ?? ""} />
          </div>
        </div>
      </main>
      <EduFooter />
    </>
  );
}
