import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStore, getBlueprint, getStoreBySubdomain, getBlueprintOrNull } from "@/lib/tenant";
import { Markdown } from "@/components/storefront/Markdown";
import { resolvePolicyPage } from "@/blueprint/policy-pages";
import { groundedText, truthfulBlueprint } from "@/blueprint/facts";
import { getStoreFacts } from "@/server/repos/facts";

// الصفحات القانونية تُكتب من سياسة المتجر نفسها؛ غيرها (عن المتجر، تواصل) نص حر يُفحص عند كل عرض.
const LEGAL = new Set(["shipping", "returns", "privacy", "terms"]);

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
  const raw = await getBlueprint(store.id);
  const facts = await getStoreFacts(store.id, raw);
  const page = resolvePolicyPage(truthfulBlueprint(raw, facts), slug);
  if (!page) notFound();
  const body = LEGAL.has(page.slug)
    ? page.body
    : page.body
        .split("\n")
        .map((line) => {
          if (line.startsWith("#")) return line;
          const bullet = /^\s*[-*]\s+/.exec(line)?.[0] ?? "";
          const text = groundedText(line.slice(bullet.length), facts);
          return text ? `${bullet}${text}` : "";
        })
        .filter((l, i, a) => l || a[i - 1])
        .join("\n");
  return (
    <article className="container-x max-w-3xl py-12">
      <h1 className="mb-6 text-3xl">{page.title}</h1>
      <Markdown text={body} />
    </article>
  );
}
