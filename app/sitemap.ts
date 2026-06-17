import type { MetadataRoute } from "next";
import { TAGS } from "@/lib/curation/tags";
import { PACKS } from "@/lib/packs/packs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.app";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/quiz", "/explore", "/packs", "/results", "/collections", "/install", "/privacy"];
  const tagRoutes = TAGS.map((t) => `/explore/${t}`);
  const packRoutes = PACKS.map((p) => `/packs/${p.slug}`);
  return [...routes, ...tagRoutes, ...packRoutes].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7
  }));
}
