"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton({ className = "btn btn--ghost" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
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
