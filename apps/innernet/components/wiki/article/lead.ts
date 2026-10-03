import { workspaces } from "@/components/wiki/main/insights";
import { ancestors, getIndex, getPage, getPages } from "@/lib/data";
import { bytes, monthYear, num, plural, timeAgo } from "@/lib/format";
import { isRemote, wikiHref } from "@/lib/links";
import { isListableName } from "@/lib/text";
import type { GitInfo, Page } from "@/lib/types";

// The encyclopedia voice. Turns index metadata into sentences ("linear-clone is a
// TypeScript Next.js application in the experiments collection of the XO workspace.")
// as a list of segments, so the view can render links and bold without any HTML.

export interface Seg {
  text: string;
  href?: string;
  strong?: boolean;
}

/** Data and markup formats: they describe a folder's files, never its kind. */
const NON_CODE = new Set(["Markdown", "MDX", "JSON", "YAML", "TOML", "HTML", "CSS"]);

/** The index lists at most this many authors per repository. */
export const AUTHORS_CAP = 8;

/** How many people wrote a repository, and whether that is only a lower bound (older
 * indexes kept the top eight without a total). */
export function authorTotal(g: GitInfo): { n: number; atLeast: boolean } {
  if (g.authorCount != null) return { n: g.authorCount, atLeast: false };
  return { n: g.authors.length, atLeast: g.authors.length >= AUTHORS_CAP };
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** Encyclopedia style: small counts in words, the rest in figures. */
export const count = (n: number) => (n <= 10 ? WORDS[n] : num(n));
const countOf = (n: number, one: string, many = `${one}s`) => `${n === 1 ? "a single" : count(n)} ${n === 1 ? one : many}`;

export function article(word: string): "a" | "an" {
  if (/^(uni|use|usa|uti|eu|one)/i.test(word)) return "a";
  if (/^[aeiou]/i.test(word)) return "an";
  // Acronyms read letter by letter: "an HTML", "an MDX", "an SQL".
  if (/^[A-Z]{2,}/.test(word) && /^[AEFHILMNORSX]/.test(word)) return "an";
  return "a";
}

export function codeLanguages(p: Page): string[] {
  const code = p.languages.filter((l) => !NON_CODE.has(l.name)).map((l) => l.name);
  if (code.length) return code;
  // A static site is still an HTML project.
  return p.languages.filter((l) => l.name === "HTML" || l.name === "CSS").map((l) => l.name);
}

// What a framework makes a project into, most specific first. `implies` drops the
// language adjective when the noun already says it.
const NOUNS: { fw: string; noun: string; implies?: boolean }[] = [
  { fw: "Fumadocs", noun: "documentation site" },
  { fw: "Tauri", noun: "Tauri desktop app" },
  { fw: "Electron", noun: "Electron desktop app" },
  { fw: "Remotion", noun: "Remotion video project" },
  { fw: "Expo", noun: "React Native app" },
  { fw: "React Native", noun: "React Native app" },
  { fw: "Flutter", noun: "Flutter app", implies: true },
  { fw: "Next.js", noun: "Next.js application" },
  { fw: "Vue", noun: "Vue application" },
  { fw: "Streamlit", noun: "Streamlit app" },
  { fw: "FastAPI", noun: "FastAPI service" },
  { fw: "Flask", noun: "Flask application" },
  { fw: "Express", noun: "Express server" },
  { fw: "Hardhat", noun: "Hardhat smart-contract project" },
  { fw: "Foundry", noun: "Foundry smart-contract project" },
  { fw: "Three.js", noun: "Three.js project" },
  { fw: "React Three Fiber", noun: "Three.js project" },
  { fw: "Claude Agent SDK", noun: "Claude Agent SDK project" },
  { fw: "Vite", noun: "Vite application" },
  { fw: "React", noun: "React project" },
];

/** "TypeScript Next.js application", "Rust workspace", "collection of documents". */
export function descriptor(p: Page): string {
  if (p.kind === "docs") return p.isArticle ? "collection of documents" : "folder of documents";
  if (p.kind === "assets") return "media folder";
  if (p.kind === "code" && !p.isArticle) return "source folder";
  if (p.kind === "folder" && !p.isArticle && p.depth > 0) return "folder";
  const lang = codeLanguages(p)[0];
  const fw = NOUNS.find((n) => p.frameworks.includes(n.fw));
  if (fw) {
    if (fw.fw === "Vite" && p.frameworks.includes("React")) return [lang, "React application"].filter(Boolean).join(" ");
    return fw.implies || !lang ? fw.noun : `${lang} ${fw.noun}`;
  }
  const m = p.manifest;
  if (m?.file === "Cargo.toml") return m.name ? "Rust crate" : "Rust workspace";
  if (m?.file === "go.mod") return "Go module";
  if (m?.file === "pyproject.toml") return "Python package";
  if (m?.file === "package.json" && m.name && !lang) return "JavaScript package";
  if (lang) return `${lang} project`;
  if (p.kind === "repo") return "Git repository";
  if (p.kind === "folder") return "folder";
  return "project";
}

/** Infobox "Type": the descriptor with a capital, minus a language the Language row repeats. */
export function typeLabel(p: Page): string {
  if (p.depth === 0) return "Root folder";
  const d = descriptor(p);
  const lang = codeLanguages(p)[0];
  // "Next.js application" says more than "TypeScript Next.js application" next to a
  // Language row; "Rust workspace" needs its language to mean anything.
  const fw = NOUNS.some((n) => d.endsWith(n.noun));
  const label = fw && lang && d.startsWith(lang + " ") ? d.slice(lang.length + 1) : d;
  return label[0].toUpperCase() + label.slice(1);
}

/** Short kind for lists: "repository", "Next.js app", "source folder". */
export function shortKind(p: Page): string {
  switch (p.kind) {
    case "repo":
      return "repository";
    case "docs":
      return "documents";
    case "assets":
      return "media";
    case "code":
      return p.isArticle ? "project" : "source folder";
    case "folder":
      return "folder";
    default: {
      const fw = NOUNS.find((n) => p.frameworks.includes(n.fw));
      return fw ? fw.noun.replace(/ application$/, " app") : "project";
    }
  }
}

const isCollection = (p: Page) => !p.isArticle && getPages(p.children).filter((c) => c.isArticle).length >= 3;
const link = (q: Page): Seg => ({ text: q.name, href: wikiHref(q.slug) });

/** The place phrase before namesakes are told apart. */
function basicPlace(p: Page): Seg[] {
  const chain = ancestors(p);
  const parent = chain[chain.length - 1];
  if (!parent) return [];
  const root = chain[0];
  const top = chain[1];
  const enclosing = getPage(p.partOf);
  // Only a folder that holds several projects of its own reads as a workspace.
  const isWorkspace = (q: Page) => workspaces().has(q.slug);

  if (enclosing) {
    if (enclosing.slug === parent.slug) return [{ text: "within " }, link(enclosing)];
    if (!parent.isArticle) return [{ text: `in the ` }, link(parent), { text: " folder of " }, link(enclosing)];
    // "within docs, part of docs" says nothing twice.
    if (parent.name === enclosing.name) return [{ text: "within " }, link(parent)];
    return [{ text: "within " }, link(parent), { text: ", part of " }, link(enclosing)];
  }
  if (parent.depth === 0) return [{ text: "at the top level of " }, { text: root.root, href: wikiHref(root.slug) }];
  if (parent.depth === 1 && isWorkspace(parent)) return [{ text: "in the " }, link(parent), { text: " workspace" }];

  const out: Seg[] = parent.isArticle
    ? [{ text: "within " }, link(parent)]
    : [{ text: "in the " }, link(parent), { text: isCollection(parent) ? " collection" : " folder" }];
  if (top && top.slug !== parent.slug) {
    if (isWorkspace(top)) out.push({ text: parent.isArticle ? ", in the " : " of the " }, link(top), { text: " workspace" });
    else if (parent.isArticle) out.push({ text: ", in " }, link(top));
    else if (top.isArticle) out.push({ text: " of " }, link(top));
    else out.push({ text: " under " }, link(top));
  }
  return out;
}

const segText = (segs: Seg[]) => segs.map((s) => s.text).join("");

/** Where a page sits, as segments: "in the experiments collection of the XO workspace".
 * When a namesake would read the same, the nearest ancestor that tells them apart is
 * added ("…, under inbox-workspace"). */
export function placeSegs(p: Page): Seg[] {
  const segs = basicPlace(p);
  const mine = segText(segs);
  const twins = (getIndex().byName.get(p.name.toLowerCase()) ?? []).filter((q) => q.slug !== p.slug && segText(basicPlace(q)) === mine);
  if (!twins.length) return segs;
  // Skip ancestors already named, or named alike ("within docs, under docs").
  const named = new Set(segs.filter((s) => s.href).map((s) => s.text));
  for (const a of ancestors(p).reverse()) {
    if (a.depth === 0 || named.has(a.name)) continue;
    if (twins.every((t) => !ancestors(t).some((x) => x.slug === a.slug))) return [...segs, { text: ", under " }, link(a)];
  }
  return segs;
}

/** Plain-text place for glosses: "in experiments", "within linear-clone". */
export function placeText(p: Page): string {
  return placeSegs(p)
    .map((s) => s.text)
    .join("");
}

export function descendants(p: Page): Page[] {
  const out: Page[] = [];
  const stack = [...p.children];
  while (stack.length) {
    const q = getPage(stack.pop());
    if (!q) continue;
    out.push(q);
    stack.push(...q.children);
  }
  return out;
}

/** A list of linked names joined the way prose does: "a, b and c". Names that repeat
 * use their full titles, so two space_ui folders are told apart. */
function listSegs(pages: Page[]): Seg[] {
  const out: Seg[] = [];
  const repeated = (q: Page) => pages.filter((x) => x.name === q.name).length > 1;
  pages.forEach((q, i) => {
    if (i > 0) out.push({ text: i === pages.length - 1 ? " and " : ", " });
    out.push({ text: repeated(q) ? q.title : q.name, href: wikiHref(q.slug) });
  });
  return out;
}

/** Document files under a page: counted by the indexer, or estimated from its
 * languages for indexes built before that. */
function documents(p: Page): number {
  if (p.docFiles != null) return p.docFiles;
  return p.languages.filter((l) => l.name === "Markdown" || l.name === "MDX" || l.name === "HTML").reduce((s, l) => s + l.files, 0);
}

export type Beyond = { folders: number; files: number } | "unknown" | null;

/** What lies past the indexer's depth limit under a page: counted folders and files,
 * "unknown" for indexes built before the indexer counted them, or null when the whole
 * subtree was indexed. */
export function beyond(p: Page): Beyond {
  const { meta } = getIndex().index;
  const tree = [p, ...descendants(p)];
  if (!meta.deeperCounted) return tree.some((q) => q.depth >= meta.maxDepth) ? "unknown" : null;
  let folders = 0;
  let files = 0;
  for (const q of tree) {
    folders += q.deeper?.folders ?? 0;
    files += q.deeper?.files ?? 0;
  }
  return folders ? { folders, files } : null;
}

/** "six levels", the depth Innerpedia reads to. */
const levels = () => `${count(getIndex().index.meta.maxDepth)} levels`;

/** The generated lead paragraph. */
export function leadSegs(p: Page): Seg[] {
  const out: Seg[] = [{ text: p.name, strong: true }];
  const { index } = getIndex();
  const desc = descendants(p);

  const past = beyond(p);
  // A collection is "of documents" only when documents are nearly all it holds.
  const docNoun = documents(p) >= p.totalFiles * 0.8 ? "document" : "file";

  // 1. What and where.
  if (p.depth === 0) {
    // In the demo the root is a GitHub organization rather than a folder on disk.
    const where = isRemote(p.path) ? `the GitHub organization at ${p.root},` : `the folder at ${p.root}`;
    out.push({ text: ` is the root of Innerpedia: ${where} from which all ${num(index.meta.counts.pages)} indexed folders descend.` });
  } else {
    const d = descriptor(p);
    const what = p.kind === "docs" && p.totalFiles > 0 ? `collection of ${countOf(p.totalFiles, docNoun)}` : d;
    const place = placeSegs(p);
    out.push({ text: ` is ${article(what)} ${what}` });
    if (place.length) out.push({ text: " " }, ...place);
    out.push({ text: "." });
  }

  // 2. When.
  out.push({ text: whenText(p) });

  // 3. How big. Folders past the depth limit are counted when the index knows them.
  const folders = desc.length + 1 + (past && past !== "unknown" ? past.folders : 0);
  if (p.kind === "docs" && p.totalFiles > 0 && p.depth > 0) {
    const noun = docNoun === "document" ? "documents" : "files";
    out.push({ text: folders > 1 ? ` The ${noun} fill ${count(folders)} folders, ${bytes(p.totalBytes)} in all.` : ` The ${noun} come to ${bytes(p.totalBytes)}.` });
  } else if (p.totalFiles > 0) {
    const across = folders > 1 ? ` across ${count(folders)} folders` : "";
    out.push({ text: p.totalFiles === 1 && folders === 1 ? ` It holds a single file of ${bytes(p.totalBytes)}.` : ` It holds ${countOf(p.totalFiles, "file")}${across}, ${bytes(p.totalBytes)} in all.` });
  } else if (p.children.length) {
    out.push({ text: past === "unknown" ? ` It holds ${countOf(p.children.length, "subfolder")}.` : ` It holds no files, only ${countOf(p.children.length, "subfolder")}.` });
  } else if (p.depth > 0 && past !== "unknown") {
    out.push({ text: " The index found no files in it." });
  }
  if (past === "unknown") out.push({ text: ` Innerpedia reads ${levels()} deep, so anything below that is not counted here.` });
  else if (past) out.push({ text: ` Of its folders, ${count(past.folders)} ${past.folders === 1 ? "lies" : "lie"} past the ${levels()} Innerpedia reads: ${past.folders === 1 ? "its files are counted, but it has no page" : "their files are counted, but they have no pages"} of ${past.folders === 1 ? "its" : "their"} own.` });

  // 4. History, for repositories.
  const g = p.git;
  if (g && g.commitCount > 0) {
    const { n: authors, atLeast } = authorTotal(g);
    const by = atLeast ? ` by at least ${count(authors)} authors` : authors > 1 ? ` by ${count(authors)} authors` : g.authors[0] ? ` by ${g.authors[0].name}` : "";
    if (g.commitCount === 1) {
      out.push({ text: ` Its Git history is a single commit${by}${g.lastCommit ? `, made in ${monthYear(g.lastCommit)}` : ""}.` });
    } else {
      const span =
        g.firstCommit && g.lastCommit && monthYear(g.firstCommit) !== monthYear(g.lastCommit)
          ? `, from ${monthYear(g.firstCommit)} to ${monthYear(g.lastCommit)}`
          : g.lastCommit
            ? `, all in ${monthYear(g.lastCommit)}`
            : "";
      out.push({ text: ` Its Git history runs to ${count(g.commitCount)} commits${by}${span}.` });
    }
  }

  // 5. What lives inside, for collections and workspaces.
  const inner = desc.filter((q) => q.isArticle);
  if (inner.length >= 3) {
    const direct = getPages(p.children).filter((q) => q.isArticle);
    const pool = direct.length >= 3 ? direct : inner;
    const largest = [...pool].sort((a, b) => b.totalFiles - a.totalFiles).slice(0, 3);
    out.push({ text: ` Innerpedia has ${count(inner.length)} articles on folders inside it, the largest being ` }, ...listSegs(largest), { text: "." });
  }

  // 6. A small courtesy to the agents.
  const notes = ["CLAUDE.md", "AGENTS.md"].filter((m) => p.markers.includes(m));
  if (notes.length) out.push({ text: ` It keeps instructions for coding agents in ${notes.join(" and ")}.` });

  return out;
}

/** When it was made and last touched, as one sentence (with a leading space). */
function whenText(p: Page): string {
  if (p.created && p.modified) {
    const sameMonth = monthYear(p.created) === monthYear(p.modified);
    const ageDays = (Date.now() - Date.parse(p.modified)) / 86_400_000;
    if (sameMonth && Math.abs(Date.parse(p.modified) - Date.parse(p.created)) < 2 * 86_400_000) {
      return ` It was created in ${monthYear(p.created)}${ageDays > 3 ? " and has not been touched since" : ""}.`;
    }
    if (sameMonth && ageDays >= 45) return ` It was created and last touched in ${monthYear(p.created)}.`;
    return ` Created in ${monthYear(p.created)}, it was last touched ${ageDays < 45 ? timeAgo(p.modified) : `in ${monthYear(p.modified)}`}.`;
  }
  return p.created ? ` It was created in ${monthYear(p.created)}.` : "";
}

/** "a, b and c" */
const andList = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The lead for a stub: what fallbackDescription says, voiced as encyclopedia prose with
 * the place linked, then when it was made and what its code is written in. */
export function stubLeadSegs(p: Page): Seg[] {
  const past = beyond(p);
  const deeper = p.deeper?.names.length ?? 0;
  const empty = p.totalFiles === 0 && p.children.length === 0 && !deeper && past !== "unknown";
  const noun = p.kind === "code" ? "source folder" : p.kind === "assets" ? "media folder" : p.kind === "docs" ? "folder of documents" : "folder";
  const what = empty ? `empty ${noun}` : noun;
  const place = placeSegs(p);
  const out: Seg[] = [{ text: p.name, strong: true }, { text: ` is ${article(what)} ${what}` }];
  if (place.length) out.push({ text: " " }, ...place);
  out.push({ text: "." });

  // What is in it, in words for small counts, naming the files when that is all of them.
  const holds: string[] = [];
  const subfolders = p.children.length + deeper;
  if (subfolders) holds.push(countOf(subfolders, "subfolder"));
  if (p.fileCount) holds.push(countOf(p.fileCount, "file"));
  if (holds.length) {
    let s = ` It holds ${holds.join(" and ")}`;
    const files = p.files.filter(isListableName);
    if (files.length && files.length === p.fileCount && p.fileCount <= 4) s += `${p.fileCount === 1 ? "," : ":"} ${andList(files)}`;
    else if (files.length) s += `, including ${andList(files.slice(0, 4))}`;
    else if (p.totalFiles === 0 && past !== "unknown") s += subfolders === 1 ? ", which holds no files" : ", none of which holds a single file";
    out.push({ text: `${s}.` });
  } else if (past === "unknown") {
    out.push({ text: " It holds no files of its own." });
  }
  if (past === "unknown") {
    out.push({ text: ` Innerpedia reads ${levels()} deep, so any folders ${p.children.length ? "further down" : "inside it"} are not indexed.` });
  } else if (past) {
    const files = past.files === 0 ? "" : past.files === 1 ? "the one file inside is" : `the ${count(past.files)} files inside are`;
    out.push({
      text: p.children.length
        ? ` Of the folders below it, ${count(past.folders)} ${past.folders === 1 ? "lies" : "lie"} past the ${levels()} Innerpedia reads and ${past.folders === 1 ? "has no page of its own" : "have no pages of their own"}.`
        : deeper === 1
          ? ` That subfolder lies past the ${levels()} Innerpedia reads${files ? `: ${files} counted here, but the folder has` : " and has"} no page of its own.`
          : ` These subfolders lie past the ${levels()} Innerpedia reads${files ? `: ${files} counted here, but the folders have` : " and have"} no pages of their own.`,
    });
  }


  out.push({ text: whenText(p) });
  const total = p.languages.reduce((s, l) => s + l.files, 0);
  const code = p.languages.filter((l) => !NON_CODE.has(l.name));
  const codeTotal = code.reduce((s, l) => s + l.files, 0);
  if (code.length === 1 && p.languages.length === 1 && total === p.totalFiles && total >= 2) out.push({ text: ` Every file in it is ${code[0].name}.` });
  else if (code.length === 1) out.push({ text: ` Its code is all ${code[0].name}.` });
  else if (code.length > 1 && code[0].files / codeTotal >= 0.6) out.push({ text: ` Its code is mostly ${code[0].name}.` });
  else if (code.length > 1) out.push({ text: ` Its code is a mix of ${andList(code.slice(0, 3).map((l) => l.name))}.` });
  return out;
}

/** Summaries copied from agent instructions read as orders, not descriptions. */
export function leadSummary(p: Page): string | null {
  if (!p.summary) return null;
  if (p.summary === p.agentNotes && !p.readme) return null;
  return p.summary;
}

/** "github.com/makepad/makepad" and a browsable https URL for a git remote. */
export function remoteLink(remote: string | null): { href: string; label: string } | null {
  if (!remote) return null;
  let url = remote.trim();
  const ssh = url.match(/^[\w.-]+@([\w.-]+):(.+)$/);
  if (ssh) url = `https://${ssh[1]}/${ssh[2]}`;
  url = url.replace(/^ssh:\/\/(?:[\w.-]+@)?/, "https://").replace(/\.git$/, "");
  if (!/^https?:\/\//.test(url)) return null;
  return { href: url, label: url.replace(/^https?:\/\//, "").replace(/\/$/, "") };
}

/** "~/Programming/XO/ClaudeWorkspace/experiments/linear-clone" */
export function fullPath(p: Page): string {
  return [p.root, ...p.relPath.split(/[\\/]/).filter(Boolean)].join("/");
}

/** Splits "components (linear-clone)" into the name and its qualifier. The qualifier may
 * hold parentheses of its own: "src (Oasis MVP - Binary v2 FE (1))". */
export function splitTitle(title: string): [string, string | null] {
  if (!title.endsWith(")")) return [title, null];
  let depth = 0;
  for (let i = title.length - 1; i > 0; i--) {
    if (title[i] === ")") depth++;
    else if (title[i] === "(" && --depth === 0) {
      const name = title.slice(0, i).trimEnd();
      return name && name.length < i ? [name, title.slice(i)] : [title, null];
    }
  }
  return [title, null];
}

