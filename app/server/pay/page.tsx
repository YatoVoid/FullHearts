import type { Metadata } from "next";
import { EduHeader, EduFooter } from "@/components/server/EduChrome";
import PayLink from "@/components/server/PayLink";

export const metadata: Metadata = {
  title: "Start the subscription | EduCraft",
  robots: { index: false },
  referrer: "no-referrer"
};

export default function PayPage() {
  return (
    <>
      <EduHeader />
      <main className="page">
        <div className="wrap narrow">
          <div className="page__head">
            <h1>Start the subscription</h1>
          </div>
          <div className="panel">
            <PayLink />
          </div>
        </div>
      </main>
      <EduFooter />
    </>
  );
}
