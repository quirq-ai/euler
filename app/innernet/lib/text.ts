// Text clean-up shared by the indexer (scripts/build-index.ts) and the server. Plain
// functions with no imports, so the indexer can use them outside Next.

/** Closes the gaps stripped markup leaves before punctuation ("create-next-app ." or
 * "head.onnx )."), but only before punctuation that ends a word, so "copy .env" keeps
 * its space. */
export function tidyGaps(s: string): string {
  return s.replace(/\s+([.,;:!?)\]])(?=[\s.,;:!?)\]]|$)/g, "$1").replace(/([(\[])\s+/g, "$1");
}

/** Innerpedia's house style has no em or en dashes, so quoted summaries and commit
 * subjects are set with commas and hyphens instead. */
export function undash(s: string): string {
  return s
    .replace(/\s+[\u2014\u2013]\s+/g, ", ")
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/\u2013/g, "-");
}

// Stands in for a list marker until the text is one line, then becomes " · ".
const ITEM = "\u0001";

/** Markdown to one line of plain text: no code, HTML, images or link targets, and
 * emphasis markers removed without leaving a space ("**D**eep" reads "Deep"). List
 * items run on as "a · b", and home paths ("~/.claude") keep their tilde. */
export function markdownToText(md: string): string {
  const text = md
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    // Autolinks keep their address; any other tag goes.
    .replace(/<((?:https?|mailto):[^>\s]+)>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, " ")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+/gm, ITEM)
    .replace(/(?<!\d)(\*\*|\*|~~)(?=\S)(.+?)(?<=\S)\1/g, "$2")
    // Underscore emphasis only at word edges, so snake_case names survive.
    .replace(/(?<![\p{L}\p{N}_])(__|_)(?=[^\s_])([^_]+?)(?<=[^\s_])\1(?![\p{L}\p{N}_]|\.[\p{L}\p{N}])/gu, "$2")
    .replace(/`/g, "")
    .replace(/~(?!\/)/g, " ")
    .replace(/[*|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(new RegExp(`^\\s*${ITEM}\\s*`), "")
    .replace(new RegExp(`([:;,.!?])\\s*${ITEM}\\s*`, "g"), "$1 ")
    .replace(new RegExp(`\\s*${ITEM}\\s*`, "g"), " · ")
    .trim();
  return tidyGaps(text);
}

/** A markdown block made only of links, e.g. a language switcher or a row of badges. */
export function isLinkRow(block: string): boolean {
  const links = block.match(/\[[^\]]*\]\([^)]*\)/g)?.length ?? 0;
  const rest = block.replace(/!?\[[^\]]*\]\([^)]*\)/g, "").replace(/[\s|·•,/-]+/g, "");
  return links >= 2 && rest.length < 12;
}

/** Cuts at a sentence end when one falls late enough, else at a word, with an ellipsis. */
export function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (end > n * 0.55 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}

/** Drops a closing sentence that introduces something else ("It ships with two bugs:"),
 * leaving "" when that sentence is all there is. */
export function dropLeadIn(text: string): string {
  if (!text.endsWith(":")) return text;
  const end = Math.max(text.lastIndexOf(". "), text.lastIndexOf("! "), text.lastIndexOf("? "));
  return end > 0 ? text.slice(0, end + 1) : "";
}

/** The first real prose paragraph of a markdown document, as plain text. Skips
 * headings, lists, tables, badges, lines that introduce something else ("Run:") and
 * anything that held a credential, so a summary is never a secret. */
export function firstParagraph(md: string, max = 420): string | null {
  const blocks = md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/);
  const letters = (t: string) => t.replace(/\S+:\/\/\S+/g, "").match(/\p{L}/gu)?.length ?? 0;
  for (const block of blocks) {
    const b = block.trim();
    if (!b || /^#/.test(b) || /^[-*+] |^\d+\. |^\||^>|^!\[|^\[!\[|^<|^---|^===/.test(b) || isLinkRow(b)) continue;
    if (redactSecrets(b) !== b) continue;
    // Prose that runs into a list: the prose alone, unless it only names the project.
    const intro = markdownToText(b.split(/\n[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+/)[0]);
    const text = dropLeadIn(letters(intro) >= 40 || intro.endsWith(":") ? intro : markdownToText(b));
    if (letters(text) < 40) continue;
    return clip(text, max);
  }
  return null;
}

/** Text from CLAUDE.md or AGENTS.md that gives orders to an agent instead of describing
 * the project: fine to quote as such, wrong as a summary. */
export function readsAsInstructions(text: string): boolean {
  return (
    /^(this file provides guidance|you\b|always\b|never\b|read (these|this|it)\b|parent:|before (you|touching|writing)|operating contract|conventions (any|for)|if \S+\.md exists|for each\b)/i.test(text) ||
    // Unfilled template placeholders: "A [type] application that [does what]".
    (text.match(/\[[a-z][a-z ]{1,20}\]/gi)?.length ?? 0) >= 2
  );
}

/** File names worth listing in prose: not data blobs saved as names, not essays. */
export function isListableName(name: string): boolean {
  return name.length <= 40 && !/[{}"<>\n]/.test(name);
}

// ------------------------------------------------------------------ secrets
// READMEs sometimes carry real credentials: a token in a curl example, a database URL
// with its password, a live payment key. Innernet quotes READMEs on many surfaces, so
// every credential-shaped value is replaced before it is stored or shown.

const REDACTED = "[redacted]";

function entropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) h -= (n / s.length) * Math.log2(n / s.length);
  return h;
}

/** Template values and examples: "<token>", "${API_KEY}", "your_key_here", "xxxx". */
function placeholder(v: string): boolean {
  return (
    /^(?:<.*>|\{.*\}|\[.*\]|\$.*|%.*%|(.)\1*)$/.test(v) ||
    /your|example|sample|placeholder|changeme|dummy|redacted|insert|replace|xxx|\*\*\*|\.\.\./i.test(v)
  );
}

/** Reads like a generated credential: long, letters and digits, high entropy, and not a
 * template, a path, a URL, an address or a reference such as process.env.API_KEY. */
function secretLike(v: string): boolean {
  return (
    v.length >= 16 &&
    /\d/.test(v) &&
    /[a-z]/i.test(v) &&
    !placeholder(v) &&
    !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+(?:\(|$)/.test(v) &&
    !/^[./~]|:\/\//.test(v) &&
    !/^0x[0-9a-f]{40}$/i.test(v) &&
    entropy(v) >= 3.3
  );
}

// Formats that are credentials whatever they are called. The prefix stays, so the
// reader still sees what kind of key it was.
const KEY_FORMATS: { re: RegExp; digit?: boolean }[] = [
  { re: /\b(rzp_(?:live|test)_)[A-Za-z0-9]{8,}/g },
  { re: /\b((?:sk|rk)_(?:live|test)_|pk_live_)[A-Za-z0-9]{10,}/g },
  { re: /\b(sk-ant-)[\w-]{20,}/g },
  { re: /\b(sk-)(?!ant-)[\w-]{20,}/g, digit: true },
  { re: /\b(gh[pousr]_)[A-Za-z0-9]{30,}/g },
  { re: /\b(github_pat_)\w{30,}/g },
  { re: /\b(xox[abprs]-)[\w-]{10,}/g },
  { re: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { re: /\b(AIza)[\w-]{35}/g },
];

const PEM = /-----BEGIN ((?:[A-Z0-9]+ )*)PRIVATE KEY-----([\s\S]*?)(?:-----END \1PRIVATE KEY-----|$)/g;
const JWT = /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g;
const URL_USERINFO = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s:/@]*):([^\s/@]+)@/gi;
const WEAK_PASSWORD = /^(?:pass(?:word|wd)?|pwd|secret|admin|root|postgres|mysql|guest|test|user(?:name)?)$/i;
// NAME=value, NAME: value, "name": "value", and headers such as Access-Token: value.
const NAMED = /\b([\w.-]*?(?:key|secret|token|passw(?:or)?d|pwd|authorization|auth[_-]?token)[\w.-]*)(["']?[ \t]*[:=][ \t]*["']?)([^\s"'`,;<>(){}[\]]+)/gi;
const NOT_SECRET_NAME = /(?:address|addr|[_-]id|url|uri|endpoint|name|path|file|count|length|size|type)$/i;
const SCHEME = /\b(Bearer|Basic)([ \t]+)([\w.~+/=-]{16,})/gi;

/** Replaces credential values with "[redacted]". Idempotent, and quiet on prose: the
 * name-based rules only fire on values that look generated. */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text.replace(PEM, (m, kind: string, body: string) =>
    /[A-Za-z0-9+/=]{40,}/.test(body) ? `-----BEGIN ${kind}PRIVATE KEY-----\n${REDACTED}\n-----END ${kind}PRIVATE KEY-----` : m,
  );
  out = out.replace(URL_USERINFO, (m, scheme: string, user: string, pass: string) =>
    placeholder(pass) || WEAK_PASSWORD.test(pass) ? m : `${scheme}${user}:${REDACTED}@`,
  );
  for (const { re, digit } of KEY_FORMATS) {
    out = out.replace(re, (m, prefix: string) => (digit && !/\d/.test(m.slice(prefix.length)) ? m : prefix + REDACTED));
  }
  out = out.replace(JWT, REDACTED);
  out = out.replace(NAMED, (m, name: string, sep: string, value: string) =>
    !NOT_SECRET_NAME.test(name) && secretLike(value) ? name + sep + REDACTED : m,
  );
  out = out.replace(SCHEME, (m, scheme: string, gap: string, value: string) => (secretLike(value) ? scheme + gap + REDACTED : m));
  return out;
}

/** Redaction, dash-free house style and tidy punctuation, for one-line text from the index. */
export function cleanLine(s: string): string {
  return undash(tidyGaps(redactSecrets(s)));
}
