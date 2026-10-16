import Link from "next/link";
import SignOutButton from "@/components/server/SignOutButton";
import { currentParent } from "@/lib/parent-session";

export default async function AccountNav({ current }: { current?: "account" }) {
  if (!(await currentParent())) {
    return (
      <Link className="btn btn--ghost" href="/server/login/?next=%2Fserver%2Faccount%2F">
        Sign in
      </Link>
    );
  }
  if (current === "account") return <SignOutButton />;
  return (
    <>
      <SignOutButton className="navlink" />
      <Link className="btn btn--ghost" href="/server/account/">Your account</Link>
    </>
  );
}
