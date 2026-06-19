"use client";

import { useEffect, useRef, useState } from "react";
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
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const floor = useRef(0); // real phase progress; the bar creeps but never drops below it

  // Creep the bar up a hair every tick so it always looks alive between phases,
  // staying at least at the real floor and short of 100 until the pack is ready.
  useEffect(() => {
    if (state !== "building") return;
    const t = setInterval(() => {
      setPct((p) => Math.min(96, Math.max(floor.current, p + 0.5)));
    }, 220);
    return () => clearInterval(t);
  }, [state]);

  async function go() {
    floor.current = 4;
    setPct(4);
    setLabel("Starting up");
    setState("building");
    setMsg("");
    try {
      const { blob, included, skipped, depCount, removedConflicts } = await buildMrpack({
        name,
        mods,
        loader,
        mcVersion,
        onProgress: (p, l) => {
          floor.current = p;
          setPct((cur) => Math.max(cur, p));
          setLabel(l);
        }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(name)}.mrpack`;
      a.click();
      URL.revokeObjectURL(url);
      const deps = depCount > 0 ? ` + ${depCount} required ${depCount === 1 ? "dependency" : "dependencies"} (auto-included)` : "";
      const loaderLabel = loader.charAt(0).toUpperCase() + loader.slice(1);
      const left =
        skipped.length > 0
          ? ` ${skipped.length} mod(s) were left out. No stable ${loaderLabel} ${mcVersion} build, or a required dependency was missing: ${skipped.map((m) => m.name).join(", ")}.`
          : "";
      const conflicts =
        removedConflicts.length > 0
          ? ` Removed ${removedConflicts.length} conflicting mod(s) so it'll launch: ${removedConflicts.map((c) => `${c.name} (${c.reason})`).join("; ")}.`
          : "";
      setMsg(`Packed ${included.length} mods${deps}. Import the file into Modrinth App, Prism, or ATLauncher.${left}${conflicts}`);
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
      {state === "building" && (
        <div className="pack-progress" role="status" aria-live="polite">
          <div className="quiz-progress" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="pack-note">
            {label} <span className="pack-pct">{Math.round(pct)}%</span>
            <br />
            We&apos;re cross-checking every mod against Modrinth so your pack actually launches. That careful checking is why this takes a moment.
          </p>
        </div>
      )}
      {disabled && hint && <p className="pack-note">{hint}</p>}
      {msg && <p className="pack-note" role="status">{msg}</p>}
    </div>
  );
}
