import { suggest } from "@/lib/search";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json(suggest(q.slice(0, 200)), { headers: { "Cache-Control": "no-store" } });
}
