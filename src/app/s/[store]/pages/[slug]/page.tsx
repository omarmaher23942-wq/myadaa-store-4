import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStore, getBlueprint, getStoreBySubdomain, getBlueprintOrNull } from "@/lib/tenant";
import { Markdown } from "@/components/storefront/Markdown";
import { resolvePolicyPage } from "@/blueprint/policy-pages";

type Props = { params: Promise<{ store: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store: sub, slug } = await params;
  const store = await getStoreBySubdomain(sub);
  const bp = store ? await getBlueprintOrNull(store.id) : null;
  const page = bp ? resolvePolicyPage(bp, slug) : null;
  if (!page) return { robots: { index: false } };
  return { title: page.title, alternates: { canonical: `/pages/${encodeURIComponent(page.slug)}` } };
}

export default async function PolicyPage({ params }: Props) {
  const { store: sub, slug } = await params;
  const store = await requireStore(sub);
  const bp = await getBlueprint(store.id);
  const page = resolvePolicyPage(bp, slug);
  if (!page) notFound();
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl">{page.title}</h1>
      <Markdown text={page.body} />
    </article>
  );
}
