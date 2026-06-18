import type { MetadataRoute } from "next";
import { TAGS } from "@/lib/curation/tags";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.app";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/quiz", "/explore", "/results", "/collections", "/install", "/privacy", "/terms"];
  const tagRoutes = TAGS.map((t) => `/explore/${t}`);
  return [...routes, ...tagRoutes].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7
  }));
}
