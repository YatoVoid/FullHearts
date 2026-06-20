import type { Mod } from "@/lib/sources/types";

const RARITY = ["r-epic", "r-rare", "r-uncommon", "r-common"];

/** Shared mod card used by Explore, the per-tag browser and search results. */
export default function ModCard({
  mod,
  i,
  added,
  disabled,
  onAdd,
  onRemove
}: {
  mod: Mod;
  i: number;
  added: boolean;
  disabled?: boolean;
  onAdd: (id: string) => void;
  /** When provided, an added mod's button becomes a Remove button on hover. */
  onRemove?: (id: string) => void;
}) {
  return (
    <article className={`tip ${RARITY[i % RARITY.length]}`}>
      <div className="row1">
        {mod.iconUrl && <img className="tip-icon" src={mod.iconUrl} alt="" loading="lazy" />}
        <span className="title">{mod.name}</span>
      </div>
      <div className="badges">
        {mod.loaders.slice(0, 3).map((l) => <span className="badge" key={l}>{l.toUpperCase()}</span>)}
      </div>
      <p className="desc">{mod.summary}</p>
      <div className="tip-links">
        {added ? (
          <button
            type="button"
            className="add-btn added"
            onClick={() => onRemove?.(mod.id)}
            disabled={!onRemove}
          >
            <span className="lbl-added">Added ✓</span>
            <span className="lbl-remove">Remove ✕</span>
          </button>
        ) : (
          <button
            type="button"
            className="add-btn"
            onClick={() => onAdd(mod.id)}
            disabled={disabled}
            title={disabled ? "Does not match this collection's loader/version." : undefined}
          >
            + Add
          </button>
        )}
        {mod.links.modrinth && (
          <a href={mod.links.modrinth} target="_blank" rel="noopener noreferrer">Modrinth</a>
        )}
      </div>
    </article>
  );
}
