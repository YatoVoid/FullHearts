import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EduHeader, EduFooter } from "@/components/server/EduChrome";
import LoginForm from "@/components/server/LoginForm";
import { currentParent } from "@/lib/parent-session";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Sign in | EduCraft",
  robots: { index: false }
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentParent()) redirect(next);

  return (
    <>
      <EduHeader />
      <main className="page">
        <div className="wrap narrow">
          <div className="page__head">
            <h1>Sign in</h1>
            <p className="lede">For parents and guardians. We email you a 6-digit code, no password to remember. You stay signed in on this device for 30 days, until you sign out.</p>
          </div>
          <div className="panel">
            <LoginForm next={next} />
          </div>
        </div>
      </main>
      <EduFooter />
    </>
  );
}
