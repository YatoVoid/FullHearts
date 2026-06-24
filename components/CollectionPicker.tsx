"use client";

import type { Collection } from "@/lib/storage/collections";
import { useDialog } from "@/components/useDialog";

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
  const { prompt, dialog } = useDialog();

  async function handle(value: string) {
    if (value === NEW) {
      const name = await prompt({
        title: "Name your new collection",
        placeholder: "e.g. Cozy survival",
        confirmLabel: "Create",
        icon: "package"
      });
      if (name) onCreate(name);
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
      {dialog}
    </div>
  );
}
