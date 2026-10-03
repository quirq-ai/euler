import { SiteFooter } from "@/components/site-footer";
import { TopBar } from "@/components/top-bar";
import { wikiHref } from "@/lib/links";

// Chrome shared by every Innerpedia page: header, a centred column, and the footer
// with the special pages, held to the bottom of the window on short pages. Each view
// renders its own <main>.

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/wiki", label: "Main page" },
  { href: wikiHref("Special:Random"), label: "Random article", prefetch: false },
  { href: wikiHref("Special:AllPages"), label: "All pages" },
  { href: wikiHref("Special:Categories"), label: "Categories" },
  { href: wikiHref("Special:Statistics"), label: "Statistics" },
  { href: "/#guide", label: "Field guide" },
];

export function WikiShell({ children, q = "" }: { children: React.ReactNode; q?: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar variant="wiki" q={q} />
      {/* The skip link's target. */}
      <div id="content" tabIndex={-1} className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-24 pt-8 focus:outline-none sm:px-6">
        {children}
      </div>
      <SiteFooter links={LINKS} />
    </div>
  );
}
