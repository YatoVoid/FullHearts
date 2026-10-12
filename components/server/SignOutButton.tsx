"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn--ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/server/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/server/");
        router.refresh();
      }}
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
