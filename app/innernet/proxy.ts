import { NextResponse, type NextRequest } from "next/server";
import { DEMO } from "@/lib/mode";

// Innernet serves this machine's folders, so it answers only to this machine. The dev
// server binds to loopback (package.json), and this check covers the rest: a page that
// rebinds its own DNS name to 127.0.0.1 still sends that name as its Host, and is
// refused here before anything is read. The demo (lib/mode.ts) holds only public
// repositories and reads nothing from the machine it runs on, so it answers every host.

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.localhost)(:\d+)?$/i;

export function proxy(request: NextRequest) {
  if (DEMO || LOCAL.test(request.headers.get("host") ?? "")) return NextResponse.next();
  return new NextResponse("Innernet only answers to localhost.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
