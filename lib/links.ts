// URL builders. Slugs can hold spaces, parentheses, commas and other characters,
// so every link goes through here.

export const wikiHref = (slug: string) => `/wiki/${encodeURIComponent(slug)}`;

export const categoryHref = (name: string) => `/wiki/${encodeURIComponent(`Category:${name.replace(/ /g, "_")}`)}`;

export const searchHref = (q: string, extra: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams({ q });
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "" && !(k === "p" && v === 1)) params.set(k, String(v));
  return `/search?${params.toString()}`;
};

/** Opens the folder in VS Code. Handled entirely by the OS; no request leaves the browser. */
export const vscodeHref = (absPath: string) => `vscode://file${encodeURI(absPath)}`;

/** Where a page's folder lives: a GitHub URL in the demo index, a local path otherwise. */
export const isRemote = (p: string) => /^https?:\/\//.test(p);

/** The link to a page's folder: GitHub in the demo, VS Code on this machine. */
export const sourceHref = (p: string) => (isRemote(p) ? p : vscodeHref(p));

/** What that link says. */
export const sourceLabel = (p: string) => (isRemote(p) ? "View on GitHub" : "Open in VS Code");
