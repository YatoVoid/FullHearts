import type { Collection } from "@/lib/storage/collections";

/** Pretty-printed JSON export of a collection. */
export function toJSON(collection: Collection): string {
  return JSON.stringify(
    {
      name: collection.name,
      modIds: collection.modIds,
      exportedAt: new Date().toISOString()
    },
    null,
    2
  );
}

/**
 * Human-readable text export. `nameById` resolves mod ids to display names;
 * unknown ids fall back to the raw id.
 */
export function toText(collection: Collection, nameById: Record<string, string> = {}): string {
  const lines = [
    `${collection.name}`,
    `${collection.modIds.length} mod${collection.modIds.length === 1 ? "" : "s"}`,
    ""
  ];
  for (const id of collection.modIds) {
    lines.push(`- ${nameById[id] ?? id}`);
  }
  return lines.join("\n");
}
