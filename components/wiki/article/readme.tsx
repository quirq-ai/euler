import Markdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Page } from "@/lib/types";

// README rendering for the Overview section. The markdown is tidied first (the h1 that
// repeats the page name and the paragraph already shown as the summary are dropped),
// then rendered with raw HTML skipped, images hidden, headings demoted below the
// section heading, outside links opened in a new tab and relative links left inert.

export interface ReadmeHeading {
  id: string;
  text: string;
  line: number;
}

export interface PreparedReadme {
  markdown: string;
  title: string | null; // a leading h1 that names the project differently, shown as a subtitle
  shift: number; // levels to add so the README's top heading renders as h3
  headings: ReadmeHeading[]; // top-level headings, for the contents list
  ids: Map<number, string>; // source line -> id
  levels: Map<number, number>; // source line -> rendered heading level, never skipping one
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Inline markdown to plain text, for comparisons and labels. */
function plain(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BADGES = /^\s*(\[?!\[[^\]]*\]\([^)]*\)\]?(\([^)]*\))?\s*)+$/;

function slugify(s: string): string {
  return (
    plain(s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 48) || "section"
  );
}

export function prepareReadme(page: Page, reserved: string[]): PreparedReadme | null {
  if (!page.readme) return null;
  const lines = page.readme.replace(/\r\n?/g, "\n").split("\n");

  // Lines inside fenced code blocks never count as headings or paragraphs.
  const fenced = new Array<boolean>(lines.length).fill(false);
  let fence: string | null = null;
  lines.forEach((l, i) => {
    const m = l.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      fenced[i] = true;
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
    } else if (m) {
      fence = m[1];
      fenced[i] = true;
    }
  });

  // YAML front matter would render as a rule and a stray paragraph.
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) for (let i = 0; i <= end; i++) lines[i] = "";
  }

  // GitHub alerts ("> [!NOTE]") would show their marker as text; voice it as a label.
  lines.forEach((l, i) => {
    if (fenced[i]) return;
    lines[i] = l.replace(/^(\s{0,3}>\s*)\[!(note|tip|important|warning|caution)\]\s*/i, (_, q: string, kind: string) => `${q}**${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()}.** `);
  });

  // A leading h1 is the README's own title: dropped when it only repeats the name, kept
  // as a subtitle when it says something more. A README made of several h1 sections is
  // left alone.
  const names = new Set([page.name, page.title, page.manifest?.name ?? ""].filter(Boolean).map(norm));
  const h1s = lines.filter((l, i) => !fenced[i] && /^#\s/.test(l)).length;
  let title: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (fenced[i]) break;
    if (!l || l.startsWith("<") || BADGES.test(l)) continue;
    const atx = l.match(/^#\s+(.+?)\s*#*$/);
    const setext = !atx && /^=+$/.test(lines[i + 1]?.trim() ?? "") ? l : null;
    const text = atx ? plain(atx[1]) : setext ? plain(setext) : null;
    if (text && (names.has(norm(text)) || (atx ? h1s === 1 : true))) {
      if (!names.has(norm(text))) title = text;
      lines[i] = "";
      if (setext) lines[i + 1] = "";
    }
    break;
  }

  // Drop the paragraph the index already used as the summary.
  if (page.summary) {
    const want = norm(page.summary.replace(/…$/, ""));
    let start = -1;
    for (let i = 0; i <= lines.length; i++) {
      const blank = i === lines.length || !lines[i].trim() || fenced[i];
      if (!blank && start < 0) start = i;
      if (blank && start >= 0) {
        const block = lines.slice(start, i).join("\n").trim();
        const skip = /^#/.test(block) || /^[-*+] |^\d+\. |^\||^>|^!\[|^\[!\[|^<|^---|^===/.test(block);
        if (!skip && (plain(block).match(/[a-z]/gi)?.length ?? 0) >= 40) {
          const got = norm(plain(block));
          if (want.length > 20 && (got.startsWith(want) || want.startsWith(got))) for (let j = start; j < i; j++) lines[j] = "";
          break;
        }
        start = -1;
      }
    }
  }

  const markdown = lines.join("\n").trim() ? lines.join("\n") : "";
  if (plain(markdown.replace(/```[\s\S]*?```/g, " x ")).length < 24) return null;

  // Heading levels outside code, to demote everything under the section's h2.
  const found: { level: number; text: string; line: number }[] = [];
  lines.forEach((l, i) => {
    if (fenced[i]) return;
    const m = l.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) found.push({ level: m[1].length, text: m[2], line: i + 1 });
  });
  const top = found.length ? Math.min(...found.map((h) => h.level)) : 2;
  const used = new Set(reserved);
  const ids = new Map<number, string>();
  const levels = new Map<number, number>();
  const headings: ReadmeHeading[] = [];
  // READMEs skip levels (# then ###); rendered, each heading is at most one below the
  // one before it, starting under the section's h2.
  let prev = 2;
  for (const h of found) {
    const level = Math.min(6, prev + 1, Math.max(3, h.level + 3 - top));
    levels.set(h.line, level);
    prev = level;
    let id = slugify(h.text);
    for (let n = 2; used.has(id); n++) id = `${slugify(h.text)}-${n}`;
    used.add(id);
    ids.set(h.line, id);
    if (h.level === top) headings.push({ id, line: h.line, text: plain(h.text).replace(/^[^\p{L}\p{N}]+/u, "") || plain(h.text) });
  }
  return { markdown, title, shift: 3 - top, headings, ids, levels };
}

type Node = ExtraProps["node"];
type Child = NonNullable<Node>["children"][number];

/** True when an element holds nothing but images (badges, logos) and whitespace. */
function onlyImages(node: Node): boolean {
  if (!node) return false;
  const visible = (c: Child): boolean => {
    if (c.type === "text") return c.value.trim() !== "";
    if (c.type !== "element") return false;
    if (c.tagName === "img") return false;
    if (c.tagName === "a" || c.tagName === "span") return c.children.some(visible);
    return true;
  };
  return node.children.length > 0 && !node.children.some(visible);
}

export function Readme({ doc }: { doc: PreparedReadme }) {
  const heading = (level: number) =>
    function Heading({ node, children }: { node?: Node; children?: React.ReactNode }) {
      const line = node?.position?.start.line;
      const Tag = `h${(line && doc.levels.get(line)) || Math.min(6, Math.max(3, level + doc.shift))}` as "h3" | "h4" | "h5" | "h6";
      const id = line ? doc.ids.get(line) : undefined;
      return (
        <Tag id={id} className="scroll-mt-24">
          {children}
        </Tag>
      );
    };

  return (
    <div className="prose-wiki">
      {doc.title && <p className="!mb-5 font-display text-[25px] italic leading-[1.25] text-ink-2">{doc.title}</p>}
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: heading(1),
          h2: heading(2),
          h3: heading(3),
          h4: heading(4),
          h5: heading(5),
          h6: heading(6),
          img: () => null,
          p: ({ node, children }) => (onlyImages(node) ? null : <p>{children}</p>),
          a: ({ node, href, children }) => {
            if (onlyImages(node)) return null;
            if (href && /^https?:\/\//i.test(href))
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            return <span>{children}</span>;
          },
        }}
      >
        {doc.markdown}
      </Markdown>
    </div>
  );
}
