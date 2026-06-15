import { NextResponse } from "next/server";
import { CATALOG } from "@/lib/curation/catalog";
import { enrichCatalog } from "@/lib/sources/index";

// Cache the enriched response at the edge for an hour; refresh in the background.
export const revalidate = 3600;

export async function GET() {
  try {
    const mods = await enrichCatalog(CATALOG);
    return NextResponse.json({ mods, count: mods.length });
  } catch {
    // Last-resort fallback: serve curated data with empty live fields.
    const mods = CATALOG.map((m) => ({
      ...m,
      loaders: [],
      gameVersions: [],
      dependencies: [],
      links: {}
    }));
    return NextResponse.json({ mods, count: mods.length, degraded: true }, { status: 200 });
  }
}
