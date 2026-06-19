"use client";

import type { Loader } from "@/lib/sources/types";
import type { ModFilter } from "@/lib/catalog/filter";

const LOADERS: (Loader | "all")[] = ["all", "fabric", "forge", "neoforge", "quilt"];
const LABEL: Record<string, string> = {
  all: "All",
  fabric: "Fabric",
  forge: "Forge",
  neoforge: "NeoForge",
  quilt: "Quilt"
};

/**
 * Loader + MC version filter so a category only shows mods that will work.
 * When a collection is the add-target it can LOCK the loader/version (other
 * options gray out, unpickable) or, before a choice is made, PULSE green to
 * tell the user they must pick a loader + version for the collection first.
 */
export default function ModFilterBar({
  filter,
  versions,
  onChange,
  lockLoader,
  lockVersion,
  needLoader,
  needVersion
}: {
  filter: ModFilter;
  versions: string[];
  onChange: (f: ModFilter) => void;
  /** When set, only this loader is pickable (others grayed/disabled). */
  lockLoader?: Loader;
  /** When set, the version is fixed and the select is disabled. */
  lockVersion?: string;
  /** Pulse the loader group to prompt a required choice. */
  needLoader?: boolean;
  /** Pulse the version group to prompt a required choice. */
  needVersion?: boolean;
}) {
  const versionOpts = lockVersion && !versions.includes(lockVersion) ? [lockVersion, ...versions] : versions;

  return (
    <div className="filter-bar">
      <div className={`filter-group${needLoader ? " filter-need" : ""}`}>
        <span className="filter-label">Loader</span>
        {LOADERS.map((l) => {
          const disabled = lockLoader != null && l !== lockLoader;
          return (
            <button
              key={l}
              type="button"
              className={`filter-chip${filter.loader === l ? " on" : ""}${disabled ? " filter-locked" : ""}`}
              aria-pressed={filter.loader === l}
              disabled={disabled}
              onClick={() => onChange({ ...filter, loader: l })}
            >
              {LABEL[l]}
            </button>
          );
        })}
      </div>
      <div className={`filter-group${needVersion ? " filter-need" : ""}`}>
        <span className="filter-label">Version</span>
        <select
          className="filter-select"
          value={lockVersion ?? filter.version}
          disabled={lockVersion != null}
          onChange={(e) => onChange({ ...filter, version: e.target.value })}
          aria-label="Minecraft version"
        >
          {lockVersion == null && <option value="all">All</option>}
          {versionOpts.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
