import type { Mod } from "@/lib/sources/types";

const RARITY = ["r-epic", "r-rare", "r-uncommon", "r-common"];

/** Shared mod card used by Explore, the per-tag browser and search results. */
export default function ModCard({
  mod,
  i,
  added,
  onAdd
}: {
  mod: Mod;
  i: number;
  added: boolean;
  onAdd: (id: string) => void;
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
        <button
          type="button"
          className={`add-btn${added ? " added" : ""}`}
          onClick={() => onAdd(mod.id)}
          disabled={added}
        >
          {added ? "Added ✓" : "+ Add"}
        </button>
        {mod.links.modrinth && (
          <a href={mod.links.modrinth} target="_blank" rel="noopener noreferrer">Modrinth</a>
        )}
      </div>
    </article>
  );
}
