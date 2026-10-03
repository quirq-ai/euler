import { logoById } from "@/lib/logo";
import { DEMO } from "@/lib/mode";

// A project's logo, by the hash of the logo itself (lib/logo.ts), so an address never
// changes what it holds and the browser keeps it for good. Read from the index the
// server already holds; nothing else is served here. Drawn with <img>, but held to the
// strictest policy anyway (next.config.ts), so an SVG opened on its own can run nothing.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const logo = logoById(id);
  if (!logo) return new Response("No such logo.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  return new Response(logo.body as BodyInit, {
    headers: {
      "Content-Type": logo.type,
      // This machine's logos stay in this browser; the demo's are public, so its CDN may keep them too.
      "Cache-Control": `${DEMO ? "public" : "private"}, max-age=31536000, immutable`,
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
