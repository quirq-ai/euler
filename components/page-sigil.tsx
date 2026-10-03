import "server-only";

import { Sigil } from "@/components/sigil";
import { getPage } from "@/lib/data";
import { logoSrc } from "@/lib/logo";
import type { Page } from "@/lib/types";

// A page's identity as a server component: its own logo where the index found one
// (drawn with <img> from /api/logo, see lib/logo.ts), its letter sigil otherwise. Takes
// the page or its slug. Use it wherever a server component shows a page. Client
// components keep <Sigil> and are handed a logo's address only on purpose (the
// Innerpedia globe, the search box's suggestions), never a whole page by accident.

export function PageSigil({
  page,
  size,
  muted,
  className,
}: {
  page: Page | string;
  size?: number;
  /** Defaults to the page being a stub. */
  muted?: boolean;
  className?: string;
}) {
  const p = typeof page === "string" ? getPage(page) : page;
  if (!p) return null;
  return (
    <Sigil
      seed={p.slug}
      name={p.name}
      kind={p.kind}
      muted={muted ?? !p.isArticle}
      size={size}
      className={className}
      logo={logoSrc(p)}
      logoSurface={p.logoSurface}
    />
  );
}
