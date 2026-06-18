"use client";

import { useState } from "react";
import type { Loader, Mod } from "@/lib/sources/types";
import { buildMrpack, MrpackError } from "@/lib/modpack/mrpack";
import ServerCta from "@/components/ServerCta";

function safeName(name: string): string {
  return name.replace(/[^\w \-]/g, "").trim() || "fullhearts";
}

/** One-click .mrpack export for a loadout or collection. */
export default function DownloadPack({
  name,
  mods,
  loader,
  mcVersion,
  disabled,
  hint
}: {
  name: string;
  mods: Mod[];
  loader: Loader;
  mcVersion: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [state, setState] = useState<"idle" | "building">("idle");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function go() {
    setState("building");
    setMsg("");
    try {
      const { blob, included, skipped, depCount } = await buildMrpack({ name, mods, loader, mcVersion });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(name)}.mrpack`;
      a.click();
      URL.revokeObjectURL(url);
      const deps = depCount > 0 ? ` + ${depCount} required ${depCount === 1 ? "dependency" : "dependencies"} (auto-included)` : "";
      const left = skipped.length > 0 ? ` ${skipped.length} mod(s) had no compatible Modrinth file and were left out.` : "";
      setMsg(`Packed ${included.length} mods${deps}. Import the file into Modrinth App, Prism, or ATLauncher.${left}`);
      setDone(true);
    } catch (e) {
      setMsg(e instanceof MrpackError ? e.message : "Couldn't build the modpack. Please try again.");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="pack-dl">
      <button type="button" className="btn-primary" onClick={go} disabled={disabled || state === "building"}>
        {state === "building" ? "Building .mrpack…" : "⬇ Download as modpack (.mrpack)"}
      </button>
      {disabled && hint && <p className="pack-note">{hint}</p>}
      {msg && <p className="pack-note" role="status">{msg}</p>}
      {done && (
        <ServerCta
          compact
          heading="🎉 Pack ready — play it with friends?"
          body="Spin up an always-on server and drop your new modpack in. BisectHosting installs Modrinth packs in one click."
        />
      )}
    </div>
  );
}
