import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PACKS, getPack } from "@/lib/packs/packs";
import PackDetail from "@/components/PackDetail";

export function generateStaticParams() {
  return PACKS.map((p) => ({ slug: p.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack) return { title: "Modpack | Full Hearts" };
  return {
    title: `${pack.name}: a curated Minecraft modpack | Full Hearts`,
    description: pack.description,
    alternates: { canonical: `/packs/${pack.slug}` }
  };
}

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack) notFound();
  return <PackDetail pack={pack} />;
}
