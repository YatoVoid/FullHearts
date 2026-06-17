import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TAGS, TAG_LABELS, isTag } from "@/lib/curation/tags";
import TagBrowser from "@/components/TagBrowser";

// Pre-render one static page per tag (required for output: export).
export function generateStaticParams() {
  return TAGS.map((tag) => ({ tag }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  const label = isTag(tag) ? TAG_LABELS[tag] : "Mods";
  return {
    title: `${label} mods | Full Hearts`,
    description: `Every hand-tested ${label.toLowerCase()} Minecraft mod in the Full Hearts catalog.`,
    alternates: { canonical: `/explore/${tag}` }
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  if (!isTag(tag)) notFound();
  return <TagBrowser tag={tag} />;
}
