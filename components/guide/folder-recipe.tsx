"use client";

import { useId, useState } from "react";
import { Sigil } from "@/components/sigil";
import { bytes } from "@/lib/format";
import type { PageKind } from "@/lib/types";
import { RECIPE_NAMES, type RecipeName, type RecipeProps } from "./recipe-shared";

// A folder recipe: pick what a folder holds and see what the indexer would make of it.
// Nothing is fetched. The rules below mirror scripts/build-index.ts (kind, article,
// summary, names, categories), lib/normalize.ts (summary) and lib/search.ts (tabs,
// operators, prior) line for line for the folders this recipe can describe; the small
// print under the card names the lines. Change those rules, change these.

type ReadmeOpt = "none" | "title" | "para";
type NotesOpt = "none" | "describes" | "instructs";
type Inside = "code" | "docs4" | "docs2" | "images" | "mix";

type Name = RecipeName;

const TEXT = {
  title: "Balcony sensor, work in progress.",
  para: "A small weather station for the balcony. It reads a sensor once a minute, keeps a week of readings in a file, and draws them as one calm line.",
  desc: "Reads a balcony sensor and charts the week",
  describes: "This folder holds the code and notes for a balcony weather station that logs a reading every minute.",
  instructs: "Always run the sensor reader through pnpm, and never commit the readings folder to git.",
};

const INSIDE: Record<Inside, { label: string; files: string[] }> = {
  code: { label: "Source code", files: ["chart.ts", "index.ts", "sensor.ts"] },
  docs4: { label: "Four documents", files: ["log.txt", "notes.md", "parts.csv", "wiring.pdf"] },
  docs2: { label: "Two documents", files: ["notes.md", "wiring.pdf"] },
  images: { label: "Only images", files: ["balcony.jpg", "chart.png", "sensor.png"] },
  mix: { label: "A mix", files: ["data.json", "notes.txt", "photo.jpg", "sketch.fig"] },
};

// What each file weighs, so the lead and the infobox can give a size the way they do
// for a real folder. The README, notes and manifest are measured from their text.
const SIZE: Record<string, number> = {
  "chart.ts": 2184,
  "index.ts": 642,
  "sensor.ts": 1318,
  "log.txt": 18240,
  "notes.md": 2906,
  "parts.csv": 512,
  "wiring.pdf": 148480,
  "balcony.jpg": 2411520,
  "chart.png": 84210,
  "sensor.png": 302118,
  "data.json": 6144,
  "notes.txt": 1380,
  "photo.jpg": 1984000,
  "sketch.fig": 412330,
};

/** package.json as `pnpm init` (pnpm 10) and `npm pkg set` leave it. */
const manifestText = (name: string) =>
  JSON.stringify(
    {
      name,
      version: "1.0.0",
      description: TEXT.desc,
      main: "index.js",
      scripts: { test: 'echo "Error: no test specified" && exit 1' },
      keywords: [],
      author: "",
      license: "ISC",
      packageManager: "pnpm@10.33.0",
      dependencies: { next: "^16.0.0", react: "^19.0.0" },
    },
    null,
    2,
  ) + "\n";

function fileBytes(f: string, s: State): number {
  if (f === "README.md") return `# ${s.name}\n\n${s.readme === "para" ? TEXT.para : TEXT.title}\n`.length;
  if (f === "CLAUDE.md") return `# ${s.name}\n\n${s.notes === "describes" ? TEXT.describes : TEXT.instructs}\n`.length;
  if (f === "package.json") return manifestText(s.name).length;
  return SIZE[f] ?? 0;
}

// The folders above it, nearest last. Plain folders, none a project.
const CHAIN = ["side-projects", "home", "sensors", "balcony", "drafts", "old"];

// From the indexer: document and media extensions, the language map for the files
// this recipe can hold, and the markup languages that never name a project.
const DOC_EXT = new Set(["md", "mdx", "html", "pdf", "txt", "docx", "doc", "rtf", "pages", "key", "pptx", "numbers", "csv", "xlsx"]);
const MEDIA_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif", "mp4", "mov", "webm", "mp3", "wav", "m4a", "aac", "ico", "psd", "fig", "zip"]);
const LANG: Record<string, string> = { ts: "TypeScript", md: "Markdown", json: "JSON" };
const NON_CODE = new Set(["Markdown", "MDX", "JSON", "YAML", "TOML", "HTML", "CSS"]);
const CODE_DIRS = new Set(["src", "lib", "app", "apps", "components", "public", "scripts", "templates"]);
const SECRET_DIR = /cred|secret|private|keys?$/i;
const PRUNED = new Set(["build"]);

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n: number) => (n <= 10 ? WORDS[n] : String(n));
const countOf = (n: number, one: string) => `${n === 1 ? "a single" : count(n)} ${n === 1 ? one : one + "s"}`;
const an = (w: string) => (/^(uni|use|eu|one)/i.test(w) ? "a" : /^[aeiou]/i.test(w) ? "an" : "a");
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const ext = (f: string) => f.slice(f.lastIndexOf(".") + 1).toLowerCase();

interface State {
  name: Name;
  readme: ReadmeOpt;
  pkg: boolean;
  git: boolean;
  notes: NotesOpt;
  inside: Inside;
  depth: number;
}

type InfoRow = [string, string] | [string, string, string];

interface Outcome {
  none: null | "deep" | "dot" | "pruned";
  path: string;
  files: string[];
  secret: boolean;
  kind: PageKind;
  isArticle: boolean;
  slug: string;
  title: string;
  primary: boolean;
  others: number;
  typeLabel: string;
  lead: string;
  summary: string | null;
  summaryFrom: string | null;
  summaryInLead: boolean;
  /** Label, value, and a muted second line under the value. */
  infobox: { head?: string; rows: InfoRow[] }[];
  readme: boolean;
  sections: { label: string; on: boolean; note?: string }[];
  notice: string;
  categories: string[];
  tabs: string[];
  ops: string[];
  prior: number;
}

function simulate(s: State, p: RecipeProps): Outcome {
  const above = CHAIN.slice(0, Math.max(0, s.depth - 1));
  const path = [p.rootLabel, ...above, s.name].join("/");
  const base = {
    path,
    files: [] as string[],
    secret: false,
    kind: "folder" as PageKind,
    isArticle: false,
    slug: "",
    title: s.name,
    primary: false,
    others: 0,
    typeLabel: "",
    lead: "",
    summary: null,
    summaryFrom: null,
    summaryInLead: false,
    infobox: [],
    readme: false,
    sections: [],
    notice: "",
    categories: [],
    tabs: [],
    ops: [],
    prior: 0,
  };
  // A pruned name is skipped at any depth, even by the tally below the limit.
  if (s.name.startsWith(".")) return { ...base, none: "dot" };
  if (PRUNED.has(s.name)) return { ...base, none: "pruned" };
  if (s.depth > p.maxDepth) return { ...base, none: "deep" };

  // What the crawler sees.
  const files = [...INSIDE[s.inside].files];
  if (s.readme !== "none") files.push("README.md");
  if (s.pkg) files.push("package.json");
  if (s.notes !== "none") files.push("CLAUDE.md");
  files.sort((a, b) => a.localeCompare(b));
  const secret = SECRET_DIR.test(s.name);
  const readme = secret || s.readme === "none" ? null : s.readme === "para" ? { words: 30, para: TEXT.para } : { words: 6, para: null };
  const manifest = !secret && s.pkg;
  const notes = secret || s.notes === "none" ? null : s.notes === "describes" ? TEXT.describes : TEXT.instructs;
  const instructs = s.notes === "instructs";
  const visible = secret ? [] : files;
  const hidden = s.git ? [".git"] : [];
  const markers = [...(s.git ? ["git"] : []), ...(s.pkg ? ["package.json"] : []), ...(s.notes !== "none" ? ["CLAUDE.md"] : []), ...(readme ? ["README"] : [])];

  // Kind, first match wins, then agent notes promote; article or stub.
  const direct = files.length;
  const share = (set: Set<string>) => files.filter((f) => set.has(ext(f))).length / direct;
  const codeShare = files.filter((f) => LANG[ext(f)] && !NON_CODE.has(LANG[ext(f)])).length / direct;
  let kind: PageKind = "folder";
  if (s.git) kind = "repo";
  else if (manifest || (readme && readme.words >= 25)) kind = "project";
  else if (direct >= 2 && share(DOC_EXT) >= 0.6) kind = "docs";
  else if ((direct >= 3 && share(MEDIA_EXT) >= 0.6) || (direct > 0 && share(MEDIA_EXT) === 1)) kind = "assets";
  else if (CODE_DIRS.has(s.name.toLowerCase()) || codeShare >= 0.5) kind = "code";
  if (notes && kind !== "repo") kind = "project";
  const isArticle = kind === "repo" || kind === "project" || (kind === "docs" && direct >= 4) || !!notes;

  // Summary: README paragraph, else manifest description, else notes that describe.
  const summary = readme?.para ?? (manifest ? TEXT.desc : null) ?? (notes && !instructs ? notes : null);
  const summaryFrom = readme?.para ? "README.md" : manifest ? "package.json" : summary ? "CLAUDE.md" : null;
  const summaryInLead = !!summary && !(summary === notes && !readme);

  // Languages over its files, most first; frameworks from its own manifest.
  const langCount = new Map<string, number>();
  for (const f of files) if (LANG[ext(f)]) langCount.set(LANG[ext(f)], (langCount.get(LANG[ext(f)]) ?? 0) + 1);
  const languages = [...langCount].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const codeLang = languages.find((l) => !NON_CODE.has(l)) ?? null;
  const frameworks = manifest ? ["Next.js", "React"] : [];

  // Names: a bare slug when the name is free or this folder is the primary topic.
  const near = p.namesakes[s.name] ?? { depths: [], slugs: [], rootPrimary: false };
  const others = near.depths.length;
  let slug: string = s.name;
  let title: string = s.name;
  let primary = false;
  if (others > 0) {
    primary = !near.rootPrimary && isArticle && near.depths.every((d) => d.depth > s.depth);
    if (!primary) {
      const anc = [...[p.rootName, ...above]].reverse();
      const taken = new Set(near.slugs.map((x) => x.toLowerCase()));
      for (let n = 1; n <= anc.length; n++) {
        const q = anc.slice(0, n).join(", ");
        slug = `${s.name}_(${q.replace(/\s+/g, "_")})`;
        title = `${s.name} (${q})`;
        if (!taken.has(slug.toLowerCase())) break;
      }
    }
  }

  // The type line and the opening of the lead.
  let desc: string;
  if (kind === "docs") desc = isArticle ? "collection of documents" : "folder of documents";
  else if (kind === "assets") desc = "media folder";
  else if (kind === "code" && !isArticle) desc = "source folder";
  else if (kind === "folder" && !isArticle) desc = "folder";
  else if (frameworks.includes("Next.js")) desc = codeLang ? `${codeLang} Next.js application` : "Next.js application";
  else if (codeLang) desc = `${codeLang} project`;
  else if (kind === "repo") desc = "Git repository";
  else desc = "project";
  const label = frameworks.includes("Next.js") ? "Next.js application" : desc;
  const typeLabel = label[0].toUpperCase() + label.slice(1);
  // Where it sits, as components/wiki/article/lead.ts says it for plain folders.
  const parent = above[above.length - 1];
  const place = s.depth === 1 ? `at the top level of ${p.rootLabel}` : `in the ${parent} folder${above.length > 1 ? ` under ${above[0]}` : ""}`;
  const size = bytes(files.reduce((n, f) => n + fileBytes(f, s), 0)).replace(" ", "\u00a0");
  let lead: string;
  if (isArticle) {
    // What and where, when, how big, its history, the courtesy to agents.
    const docs = files.filter((f) => DOC_EXT.has(ext(f))).length;
    const docNoun = docs >= direct * 0.8 ? "document" : "file";
    const what = kind === "docs" ? `collection of ${countOf(direct, docNoun)}` : desc;
    lead = `${s.name} is ${an(what)} ${what} ${place}. It was created in ${p.today}.`;
    lead += kind === "docs" ? ` The ${docNoun}s come to ${size}.` : ` It holds ${countOf(direct, "file")}, ${size} in all.`;
    if (s.git) lead += ` Its Git history is a single commit${p.author ? ` by ${p.author}` : ""}, made in ${p.today}.`;
    if (markers.includes("CLAUDE.md")) lead += " It keeps instructions for coding agents in CLAUDE.md.";
  } else {
    // What and where, what is in it, when, and what its code is written in.
    lead = `${s.name} is ${an(desc)} ${desc} ${place}. It holds ${countOf(direct, "file")}`;
    if (visible.length === direct && direct <= 4) lead += `: ${andList(visible)}.`;
    else if (visible.length) lead += `, including ${andList(visible.slice(0, 4))}.`;
    else lead += ".";
    lead += ` It was created in ${p.today}.`;
    const counted = [...langCount.values()].reduce((n, c) => n + c, 0);
    const code = languages.filter((l) => !NON_CODE.has(l));
    if (code.length === 1 && languages.length === 1 && counted === direct && counted >= 2) lead += ` Every file in it is ${code[0]}.`;
    else if (code.length === 1) lead += ` Its code is all ${code[0]}.`;
  }

  // The infobox, as the article (or the stub's compact box) would show it.
  const langRow: InfoRow[] = languages.length ? [["Language", codeLang ?? languages[0]]] : [];
  const contents: InfoRow[] = [["Files", String(direct)], ["Size", size]];
  const touched: InfoRow = ["Last touched", p.todayLong, "just now"];
  const infobox: Outcome["infobox"] = isArticle
    ? [
        { rows: [["Type", typeLabel], ["Location", [p.rootLabel, ...above].join("/")], ...langRow, ...(frameworks.length ? [["Frameworks", frameworks.join(", ")] as InfoRow] : [])] },
        ...(manifest ? [{ head: "Package", rows: [["Name", s.name], ["Version", "1.0.0"], ["Manifest", "package.json"]] as InfoRow[] }] : []),
        { head: "Activity", rows: [["Created", p.todayLong], touched] },
        { head: "Contents", rows: contents },
        ...(s.git ? [{ head: "Git", rows: [["Commits", "1"], ["Branch", "main"]] as InfoRow[] }] : []),
      ]
    : [
        { rows: [["Type", typeLabel], ...langRow] },
        { head: "Activity", rows: [touched] },
        { head: "Contents", rows: contents },
      ];

  const sections: Outcome["sections"] = isArticle
    ? [
        { label: "Overview", on: !!readme || (!!notes && !instructs), note: readme ? "the README" : notes && !instructs ? "a quote from CLAUDE.md" : undefined },
        { label: "Structure", on: visible.length > 0 || hidden.length > 0 },
        { label: "Technology", on: languages.length > 0 || frameworks.length > 0 || manifest },
        { label: "History", on: s.git, note: s.git ? "commits and authors" : undefined },
        { label: "See also", on: false, note: "when another article shares its frameworks, categories or name words" },
        { label: "External links", on: true },
      ]
    : [{ label: "Contents", on: visible.length > 0 || hidden.length > 0 }];

  const notice = isArticle
    ? readme
      ? ""
      : "This article was written from the folder alone. You can help Innerpedia by adding a README."
    : "This folder is a stub. You can help Innerpedia by adding a README.";

  const categories: string[] = [];
  if (isArticle) {
    if (codeLang && kind !== "docs") categories.push(`${codeLang} projects`);
    categories.push(...frameworks);
    if (kind === "repo") categories.push("Git repositories");
    if (kind === "docs") categories.push("Document collections");
    if (kind !== "folder") categories.push(`Started in ${p.year}`);
    if (markers.includes("CLAUDE.md")) categories.push("Agent-ready projects");
    if (!readme) categories.push("Articles lacking a README");
  }

  const tabs = ["All"];
  if (isArticle && kind !== "docs") tabs.push("Projects");
  if (kind === "repo") tabs.push("Repositories");
  if (kind === "docs") tabs.push("Documents");
  if (!isArticle) tabs.push("Folders");
  const ops = [
    `kind:${kind}`,
    isArticle ? "is:article" : "is:stub",
    ...languages.slice(0, 3).map((l) => `lang:${l.toLowerCase()}`),
    ...(manifest ? ["fw:next", "fw:react"] : []),
    ...(parent ? [`in:${parent}`] : []),
  ];

  let prior = isArticle ? 1.8 : 1;
  if (kind === "repo") prior *= 1.25;
  if (kind === "code" && !isArticle) prior *= 0.55;
  prior *= 1 / (1 + 0.05 * s.depth);
  prior *= 1.25; // touched today

  return {
    none: null,
    path,
    files: visible.length ? visible : files,
    secret,
    kind,
    isArticle,
    slug,
    title,
    primary,
    others,
    typeLabel,
    lead,
    summary,
    summaryFrom,
    summaryInLead,
    infobox,
    readme: !!readme,
    sections,
    notice,
    categories,
    tabs,
    ops,
    prior,
  };
}

// ------------------------------------------------------------------ controls

function Choice<T extends string>({ name, value, options, onChange, label }: { name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-[10px] bg-bg-sunk p-[3px]">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-[7px] px-2.5 py-[5px] text-[12.5px] leading-none text-muted transition-colors hover:text-ink has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-[var(--shadow-sm)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--ring)]"
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] rounded-full">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" aria-label={label} />
      <span className="h-[22px] w-[38px] rounded-full bg-line-strong transition-colors peer-checked:bg-ink" />
      <span className="absolute left-[3px] top-[3px] size-4 rounded-full bg-surface shadow-[var(--shadow-sm)] transition-transform peer-checked:translate-x-4 motion-reduce:transition-none" />
    </label>
  );
}

/** One ingredient: its name and a hint, over its control; a switch sits at the end of
 * the line instead. Side by side on a tablet, where the column is wide. */
function Row({ file, hint, inline = false, children }: { file: string; hint: string; inline?: boolean; children: React.ReactNode }) {
  const layout = inline
    ? "flex items-center justify-between gap-4"
    : "grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-2.5 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center lg:grid-cols-[minmax(0,1fr)]";
  return (
    <div className={`border-t border-line py-3.5 first:border-t-0 ${layout}`}>
      <div className="min-w-0">
        <div className="font-mono text-[12.5px] text-ink">{file}</div>
        <div className="text-[11.5px] leading-snug text-muted">{hint}</div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ the recipe

export function FolderRecipe(props: RecipeProps) {
  const id = useId();
  const [s, setS] = useState<State>({ name: "weather-station", readme: "para", pkg: true, git: false, notes: "none", inside: "code", depth: 2 });
  const set = <K extends keyof State>(k: K) => (v: State[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const o = simulate(s, props);
  const { maxDepth } = props;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      {/* Ingredients */}
      <div className="min-w-0 border-line px-4 pb-5 pt-4 sm:px-6 lg:border-r">
        <div className="fg-smallcaps">Ingredients</div>
        <p className="mt-2 break-all font-mono text-[12px] leading-relaxed text-muted">
          {o.path}
          <span className="text-faint">/</span>
        </p>

        <div className="mt-3">
          <Row file="Folder name" hint="Some names are never read">
            <Choice
              name={`${id}-name`}
              label="Folder name"
              value={s.name}
              onChange={set("name")}
              options={RECIPE_NAMES.map((n) => ({ value: n, label: n }))}
            />
          </Row>
          <Row file="README.md" hint="25 words make a project">
            <Choice
              name={`${id}-readme`}
              label="README.md"
              value={s.readme}
              onChange={set("readme")}
              options={[
                { value: "none", label: "None" },
                { value: "title", label: "A title only" },
                { value: "para", label: "A paragraph" },
              ]}
            />
          </Row>
          <Row inline file="package.json" hint="A description, next and react">
            <Switch checked={s.pkg} onChange={set("pkg")} label="package.json" />
          </Row>
          <Row inline file=".git" hint="Its own history, one commit">
            <Switch checked={s.git} onChange={set("git")} label=".git" />
          </Row>
          <Row file="CLAUDE.md" hint="Notes for coding agents">
            <Choice
              name={`${id}-notes`}
              label="CLAUDE.md"
              value={s.notes}
              onChange={set("notes")}
              options={[
                { value: "none", label: "None" },
                { value: "describes", label: "Describes it" },
                { value: "instructs", label: "Gives orders" },
              ]}
            />
          </Row>
          <Row file="Also inside" hint="The rest of its files">
            <Choice
              name={`${id}-inside`}
              label="Also inside"
              value={s.inside}
              onChange={set("inside")}
              options={(Object.keys(INSIDE) as Inside[]).map((k) => ({ value: k, label: INSIDE[k].label }))}
            />
          </Row>
          <Row file="Depth" hint={`Pages go ${maxDepth} folders down`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={maxDepth + 1}
                step={1}
                value={s.depth}
                onChange={(e) => set("depth")(Number(e.target.value))}
                aria-label="Depth below the root"
                aria-valuetext={s.depth > maxDepth ? `${s.depth}, past the limit` : String(s.depth)}
                className="fg-range min-w-0 flex-1"
              />
              <span className={`w-[92px] shrink-0 text-right font-mono text-[12px] tabular-nums ${s.depth > maxDepth ? "text-ink" : "text-muted"}`}>
                depth {s.depth}
                {s.depth > maxDepth ? " · past" : ""}
              </span>
            </div>
          </Row>
        </div>

        {/* The folder as the crawler lists it. */}
        <div className="mt-2 rounded-xl border border-line bg-bg/60 px-4 py-3 font-mono text-[12px] leading-[1.75]">
          <div className="text-ink">{s.name}/</div>
          {[...(s.git ? [".git/"] : []), ...[...INSIDE[s.inside].files, ...(s.readme !== "none" ? ["README.md"] : []), ...(s.pkg ? ["package.json"] : []), ...(s.notes !== "none" ? ["CLAUDE.md"] : [])].sort((a, b) => a.localeCompare(b))].map(
            (f, i, all) => (
              <div key={f} className="flex gap-2 text-ink-2">
                <span aria-hidden className="text-faint">
                  {i === all.length - 1 ? "└─" : "├─"}
                </span>
                <span className={f === ".git/" ? "text-muted" : ""}>{f}</span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* What the indexer makes of it */}
      <div className="min-w-0 border-t border-line bg-bg/40 px-4 pb-5 pt-4 sm:px-6 lg:border-t-0">
        <div className="fg-smallcaps">What the indexer makes of it</div>
        {/* One line for screen readers on each change, not the whole card. */}
        <p className="sr-only" aria-live="polite">
          {o.none ? `${s.name}: no page.` : `${o.title}: ${o.isArticle ? "an article" : "a stub"}, kind ${o.kind}, at /wiki/${o.slug}.`}
        </p>
        {o.none ? <NoPage o={o} s={s} props={props} /> : <Preview o={o} s={s} />}
      </div>

      <p className="fg-fine border-t border-line px-4 py-3 sm:px-6 lg:col-span-2">
        Rules mirrored from {props.cites.kind} (kind), {props.cites.article} (article or stub), {props.cites.summary} and {props.cites.normalize} (summary),{" "}
        {props.cites.names} (names), {props.cites.categories} (categories), {props.cites.lead} (the lead) and {props.cites.prior} (prior). The recipe assumes a
        folder with no subfolders, in plain folders that are not a project and hold fewer than three articles, touched today, and namesakes that keep the
        names they have now.
      </p>
    </div>
  );
}

function Verdict({ o }: { o: Outcome }) {
  if (o.none) return <span className="rounded-full border border-dashed border-line-strong px-2.5 py-[3px] text-[12px] text-muted">No page</span>;
  return o.isArticle ? (
    <span className="rounded-full border border-line-strong bg-surface px-2.5 py-[3px] text-[12px] text-ink">Article</span>
  ) : (
    <span className="rounded-full border border-notice-line bg-notice px-2.5 py-[2px] font-serif text-[13px] italic text-ink-2">stub</span>
  );
}

function NoPage({ o, s, props }: { o: Outcome; s: State; props: RecipeProps }) {
  const text =
    o.none === "deep"
      ? `Past the ${props.maxDepth} levels Innerpedia reads, a folder gets no page. Its files, size and languages are counted into the tally of its depth ${props.maxDepth} parent, which names what lies below; a .git down here is never read.`
      : o.none === "pruned"
        ? `${s.name} is a pruned name, like node_modules, dist and vendor: the crawler never enters it. Its parent lists it among the folders left out.`
        : `A name that starts with a dot is pruned and never mentioned, not even among the folders left out.`;
  return (
    <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <Verdict o={o} />
      <div className="mt-4 font-display text-[30px] leading-tight text-ink-2">Nothing to read here</div>
      <p className="mt-3 max-w-[380px] font-serif text-[15.5px] leading-[1.6] text-ink-2">{text}</p>
      <p className="fg-fine mt-3">{o.none === "deep" ? props.cites.depth : props.cites.prune}</p>
    </div>
  );
}

function Preview({ o, s }: { o: Outcome; s: State }) {
  const [name, qualifier] = o.title === s.name ? [o.title, ""] : [s.name, o.title.slice(s.name.length + 1)];
  return (
    <div className="mt-4">
      <div className="flex items-start gap-3.5">
        <Sigil seed={o.slug} name={s.name} kind={o.kind} muted={!o.isArticle} size={46} className="shadow-soft" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="font-display text-[28px] leading-[1.05] text-ink [overflow-wrap:anywhere]">
              {name}
              {qualifier && <span className="text-muted"> {qualifier}</span>}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <span>{o.typeLabel}</span>
            <span aria-hidden className="text-faint">·</span>
            <span className="font-mono text-[11.5px]">kind {o.kind}</span>
          </div>
        </div>
        <Verdict o={o} />
      </div>

      <p className="mt-3 break-all font-mono text-[11.5px] text-muted">
        /wiki/{o.slug}
        {o.others > 0 && (
          <span className="ml-2 break-normal font-sans text-[11.5px] text-faint">
            {o.primary ? `primary topic over ${o.others} namesakes` : `${o.others} other folders share the name`}
          </span>
        )}
      </p>

      <div className="mt-3 font-serif text-[15.5px] leading-[1.6] text-ink">
        <p>{o.lead}</p>
        {o.summary && o.summaryInLead && <p className="mt-2">{o.summary}</p>}
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 text-[12.5px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="fg-label">Summary</dt>
          <dd className="mt-1 leading-snug text-ink-2">
            {o.summary ? (
              <>
                From <span className="font-mono text-[11.5px] text-ink">{o.summaryFrom}</span>
                {o.summaryInLead ? ", shown in the lead, snippets and the knowledge panel." : ": used in snippets, quoted under Overview, left out of the lead."}
              </>
            ) : o.secret ? (
              "None. A secret-looking folder is never opened."
            ) : o.readme ? (
              "None: no README paragraph has forty letters. Snippets quote the README's text instead."
            ) : s.notes === "instructs" ? (
              "None. Notes that give orders never become a summary."
            ) : (
              "None. Snippets fall back to a sentence about the folder."
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="fg-label">Sections</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {o.sections.map((x) => (
              <span
                key={x.label}
                title={x.note}
                className={`rounded-md px-1.5 py-[2px] text-[11.5px] ${x.on ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : x.label === "See also" ? "border border-dashed border-line-strong text-muted" : "text-faint line-through decoration-faint"}`}
              >
                {x.label}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        <div className="fg-label mb-1">{o.isArticle ? "Infobox" : "Infobox, compact"}</div>
        {o.infobox.map((g, i) => (
          <div key={i} className={i > 0 ? "mt-1.5 border-t border-line pt-1.5" : ""}>
            {g.head && <div className="fg-label !text-[9.5px] text-faint">{g.head}</div>}
            {g.rows.map(([k, v, sub]) => (
              <div key={k} className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 py-[2px] text-[12.5px]">
                <span className="text-muted">{k}</span>
                <span className={`text-ink [overflow-wrap:anywhere] ${k === "Location" || k === "Name" || k === "Manifest" || k === "Branch" ? "font-mono text-[11.5px]" : ""}`}>
                  {v}
                  {sub && <span className="block text-[11.5px] text-muted">{sub}</span>}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {o.notice && (
        <p className="mt-3 rounded-xl border border-notice-line bg-notice px-3.5 py-2 font-serif text-[14px] italic leading-snug text-ink-2">{o.notice}</p>
      )}

      <dl className="mt-4 space-y-2.5 text-[12.5px]">
        <div>
          <dt className="fg-label">Categories</dt>
          <dd className="mt-1 leading-relaxed text-link">
            {o.categories.length ? o.categories.join("  ·  ") : <span className="text-muted">None. Only articles are filed in categories.</span>}
          </dd>
        </div>
        <div>
          <dt className="fg-label">In search</dt>
          <dd className="mt-1 leading-relaxed text-ink-2">
            Tabs {o.tabs.join(", ")}. Found by{" "}
            {o.ops.map((op, i) => (
              <span key={op}>
                {i > 0 && " "}
                <code className="rounded bg-bg-sunk px-1 font-mono text-[11px] text-ink">{op}</code>
              </span>
            ))}
            . Ranking prior <span className="font-mono text-[11.5px] tabular-nums text-ink">×{o.prior.toFixed(2)}</span>, and ×4 when its name is the query.
          </dd>
        </div>
      </dl>
    </div>
  );
}
