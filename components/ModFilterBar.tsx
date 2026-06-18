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

/** Loader + MC version filter so a category only shows mods that will work. */
export default function ModFilterBar({
  filter,
  versions,
  onChange
}: {
  filter: ModFilter;
  versions: string[];
  onChange: (f: ModFilter) => void;
}) {
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <span className="filter-label">Loader</span>
        {LOADERS.map((l) => (
          <button
            key={l}
            type="button"
            className={`filter-chip${filter.loader === l ? " on" : ""}`}
            aria-pressed={filter.loader === l}
            onClick={() => onChange({ ...filter, loader: l })}
          >
            {LABEL[l]}
          </button>
        ))}
      </div>
      <div className="filter-group">
        <span className="filter-label">Version</span>
        <select
          className="filter-select"
          value={filter.version}
          onChange={(e) => onChange({ ...filter, version: e.target.value })}
          aria-label="Minecraft version"
        >
          <option value="all">All</option>
          {versions.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
