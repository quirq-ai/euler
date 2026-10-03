import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArticleView } from "@/components/wiki/article-view";
import { CategoryView } from "@/components/wiki/category-view";
import { DisambiguationView } from "@/components/wiki/disambiguation-view";
import { SpecialView } from "@/components/wiki/special-view";
import { StubView } from "@/components/wiki/stub-view";
import { WikiShell } from "@/components/wiki/wiki-shell";
import { randomArticle, resolveSlug } from "@/lib/data";
import { wikiHref } from "@/lib/links";

// One route for everything under /wiki/: articles, stubs, disambiguation lists,
// Category: pages and Special: pages, the way Wikipedia does it.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = resolveSlug((await params).slug);
  const title =
    r.type === "page" ? r.page.title
    : r.type === "disambiguation" ? `${r.name} (disambiguation)`
    : r.type === "category" ? `Category: ${r.name}`
    : r.type === "special" ? `Special: ${r.name}`
    : "Not found";
  return { title: `${title} · Innerpedia` };
}

export default async function WikiPage({ params }: Props) {
  const r = resolveSlug((await params).slug);

  if (r.type === "special" && r.name.toLowerCase() === "random") {
    const page = randomArticle();
    redirect(page ? wikiHref(page.slug) : "/wiki");
  }
  // Wikipedia keeps its help at Help:Contents; Innerpedia keeps it in the field guide.
  if (r.type === "missing" && /^help:(contents|guide)$/i.test(r.slug)) redirect("/#guide");
  if (r.type === "missing") notFound();

  return (
    <WikiShell>
      {r.type === "page" && (r.page.isArticle ? <ArticleView page={r.page} disambiguation={r.disambiguation} /> : <StubView page={r.page} />)}
      {r.type === "disambiguation" && <DisambiguationView name={r.name} primary={r.primary} pages={r.pages} />}
      {r.type === "category" && <CategoryView name={r.name} pages={r.pages} />}
      {r.type === "special" && <SpecialView name={r.name} />}
    </WikiShell>
  );
}
