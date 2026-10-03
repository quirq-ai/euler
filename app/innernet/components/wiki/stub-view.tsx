import { getPage } from "@/lib/data";
import { plural } from "@/lib/format";
import { sourceHref, sourceLabel } from "@/lib/links";
import type { Page } from "@/lib/types";
import { Infobox } from "./article/infobox";
import { stubLeadSegs } from "./article/lead";
import { LocationRail, Notice, PageFoot, PageHeader, PartOf, Section, Segs, Sub, Tool } from "./article/parts";
import { Deeper, Excluded, FileList, FolderTree } from "./article/structure";

// A stub: a folder with no README or manifest of its own. Same chrome as an article,
// much shorter: what it is, what is in it, and a polite request for a README.

export function StubView({ page }: { page: Page }) {
  const enclosing = getPage(page.partOf);
  const kids = page.children.length + (page.deeper?.names.length ?? 0);
  // An empty folder says so in its lead; a Contents heading over nothing adds no news.
  const hasContents = kids > 0 || page.files.length > 0 || page.hiddenChildren.length > 0;

  return (
    <main className="xl:grid xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-12">
      <div className="hidden pt-1 xl:block">
        <LocationRail page={page} />
      </div>

      <article className="mx-auto min-w-0 max-w-[640px] lg:max-w-[944px] xl:mx-0">
        <PageHeader
          page={page}
          title={page.title}
          tools={
            <Tool href={sourceHref(page.path)} external>
              {sourceLabel(page.path)}
            </Tool>
          }
        />

        <div className="flow-root">
          {enclosing && <PartOf page={enclosing} className="rise mt-5" />}

          <Infobox page={page} compact className="rise mx-auto mt-7 w-full max-w-[420px] lg:float-right lg:mb-8 lg:ml-11 lg:w-[300px]" />

          <div className="lg:max-w-[600px]">
            <div className="prose-wiki rise mt-7">
              <p>
                <Segs segs={stubLeadSegs(page)} />
              </p>
            </div>

            {hasContents && (
              <Section id="contents" title="Contents" className="!mt-10">
                {kids > 0 && (
                  <Sub label="Folders" aside={plural(kids, "subfolder")}>
                    <FolderTree page={page} limit={40} />
                    <Deeper page={page} />
                    <Excluded page={page} />
                  </Sub>
                )}
                {kids === 0 && <Excluded page={page} />}
                {page.files.length > 0 && (
                  <Sub label="Files" aside={plural(page.fileCount, "file")}>
                    <FileList page={page} />
                  </Sub>
                )}
              </Section>
            )}

            <Notice page={page} className={hasContents ? "mt-12" : "mt-4"}>
              This folder is a stub. You can help Innerpedia by{" "}
              <a href={sourceHref(page.path)} className="link whitespace-nowrap not-italic">
                adding a README
              </a>
              .
            </Notice>
          </div>
        </div>

        <PageFoot page={page} />
      </article>
    </main>
  );
}
