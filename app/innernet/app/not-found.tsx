import Link from "next/link";
import { connection } from "next/server";
import { WikiShell } from "@/components/wiki/wiki-shell";

export default async function NotFound() {
  // Rendered per request, so the footer's "Indexed N ago" stays true.
  await connection();
  return (
    <WikiShell>
      <main className="mx-auto max-w-[720px] py-16 sm:py-20">
        <h1 className="rise font-display text-[44px] leading-[1.05] tracking-[-0.015em] sm:text-[52px]">Nothing here, yet</h1>
        <p className="rise mt-4 font-serif text-[18px] leading-[1.68] text-ink-2" style={{ animationDelay: "40ms" }}>
          Innerpedia does not have a page with this name. The folder may live deeper than the index reaches, or it may not exist at all.
        </p>
        <p className="rise mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px]" style={{ animationDelay: "80ms" }}>
          <Link href="/wiki" className="link">
            Go to the Main page
          </Link>
          <Link href="/" className="link">
            Search your internet
          </Link>
        </p>
      </main>
    </WikiShell>
  );
}
