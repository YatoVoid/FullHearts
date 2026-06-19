"use client";

import type { Collection } from "@/lib/storage/collections";

const NEW = "__new__";

/** Sticky little tab to choose which collection the "+ Add" buttons drop into. */
export default function CollectionPicker({
  collections,
  targetId,
  onSelect,
  onCreate
}: {
  collections: Collection[];
  targetId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  function handle(value: string) {
    if (value === NEW) {
      const name = window.prompt("Name your new collection:", "");
      if (name && name.trim()) onCreate(name.trim());
      return;
    }
    onSelect(value);
  }

  return (
    <div className="coll-picker">
      <label htmlFor="coll-target">Adding to</label>
      <select id="coll-target" value={targetId} onChange={(e) => handle(e.target.value)}>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.modIds.length})
          </option>
        ))}
        <option value={NEW}>+ New collection…</option>
      </select>
    </div>
  );
}
