import "server-only";

import { DEMO } from "./mode";

// The two checks every route a page of Innernet's own calls makes before it reads a
// body: the request came from one of this app's pages, and it is small.
//
// Same origin means the Origin header names the very host the request was sent to, and
// Sec-Fetch-Site, which browsers set and pages cannot, says "same-origin" whenever it is
// there. On this machine the host must also be localhost (proxy.ts refuses the rest
// before this runs). On the demo a host Vercel forwards (X-Forwarded-Host) counts as
// well: a page cannot set either header, which is all this check is for. A browser
// sends Origin with every POST and DELETE, so those require it; a same-origin GET
// carries none, so a GET is checked on what it does carry.

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.localhost)(:\d+)?$/i;

export function sameOrigin(req: Request, { requireOrigin = true }: { requireOrigin?: boolean } = {}): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (!host || (!DEMO && !LOCAL_HOST.test(host))) return false;
  const hosts = [host, DEMO ? (req.headers.get("x-forwarded-host") ?? "").toLowerCase() : ""].filter(Boolean);
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const u = new URL(origin);
      if ((u.protocol !== "http:" && u.protocol !== "https:") || !hosts.includes(u.host.toLowerCase())) return false;
    } catch {
      return false;
    }
  } else if (requireOrigin) return false;
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}

/** The body as text, or null once it passes `cap` bytes: a body is never read further than that. */
export async function readCapped(req: Request, cap: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > cap) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
