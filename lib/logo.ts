import "server-only";

import { createHash } from "node:crypto";
import { getIndex } from "./data";
import type { Page } from "./types";

// Where a page's logo is drawn from. The index keeps each logo as a data URI (Page.logo),
// but inlining it would put every logo in a page twice, once in the HTML and once in
// React's payload, and a globe of ninety tiles carries a lot of them. So pages point at
// /api/logo/<id> instead (app/api/logo/[id]/route.ts): the id is a hash of the logo
// itself, so the same logo has one address however many projects share it, and the
// browser can keep it for good. The bytes come only from the index the server already
// reads; nothing here touches the disk.

interface Table {
  version: number;
  idOf: Map<string, string>; // data URI -> id
  byId: Map<string, string>; // id -> data URI
}

let table: Table | null = null;

export const LOGO_ID = /^[a-f0-9]{20}$/;

function logos(): Table {
  const { index, version } = getIndex();
  if (table && table.version === version) return table;
  const idOf = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const p of index.pages) {
    if (!p.logo || idOf.has(p.logo)) continue;
    const id = createHash("sha256").update(p.logo).digest("hex").slice(0, 20);
    idOf.set(p.logo, id);
    byId.set(id, p.logo);
  }
  table = { version, idOf, byId };
  return table;
}

/** The address of a page's logo, or null when it has none (the letter sigil stands in). */
export function logoSrc(page: Page | null | undefined): string | null {
  if (!page?.logo) return null;
  const id = logos().idOf.get(page.logo);
  return id ? `/api/logo/${id}` : null;
}

/** A logo's bytes and type, by its id. Null for an id the index does not hold. */
export function logoById(id: string): { type: string; body: Uint8Array } | null {
  if (!LOGO_ID.test(id)) return null;
  const uri = logos().byId.get(id);
  // lib/normalize.ts has already held every logo to a base64 data URI of an image type.
  const m = uri?.match(/^data:(image\/(?:svg\+xml|png|webp|jpeg|x-icon));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!m) return null;
  const body = Buffer.from(m[2], "base64");
  // The indexer never keeps an SVG that could act; an index edited by hand is checked again.
  if (m[1] === "image/svg+xml" && /<script|<foreignObject|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|javascript:)/i.test(body.toString("utf8"))) return null;
  return { type: m[1] === "image/svg+xml" ? "image/svg+xml; charset=utf-8" : m[1], body: new Uint8Array(body) };
}
