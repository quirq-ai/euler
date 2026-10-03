import type { LogoSurface, PageKind } from "@/lib/types";

// Every folder gets a deterministic "sigil": a small aurora of three hues derived from
// its slug, with its initial set in the display serif. Repos are round, projects are
// soft squares, plain folders are muted. The same sigil appears in search results,
// suggestions, the knowledge panel and the article infobox, so a project is
// recognisable by colour before its name is read.
//
// A project that keeps a logo of its own shows that instead, in the same tile shape on
// a quiet surface. Server components pass a page through <PageSigil> (page-sigil.tsx),
// which fills in the logo; the letter sigil stands in wherever there is none.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function sigilHues(seed: string): [number, number, number] {
  const h = hash(seed);
  const a = h % 360;
  const b = (a + 35 + ((h >>> 9) % 90)) % 360;
  const c = (a + 180 + ((h >>> 17) % 60) - 30) % 360;
  return [a, b, c];
}

export function sigilGradient(seed: string, muted = false): string {
  const [a, b, c] = sigilHues(seed);
  const chroma = muted ? 0.035 : 0.14;
  const x1 = 18 + (hash(seed + "x") % 30);
  const y1 = 14 + (hash(seed + "y") % 30);
  return [
    `radial-gradient(circle at ${x1}% ${y1}%, oklch(0.88 ${chroma} ${a}) 0%, transparent 58%)`,
    `radial-gradient(circle at ${100 - x1}% ${100 - y1 / 2}%, oklch(0.74 ${chroma * 1.1} ${b}) 0%, transparent 62%)`,
    `linear-gradient(135deg, oklch(0.68 ${chroma} ${c}), oklch(0.58 ${chroma * 0.9} ${b}))`,
  ].join(", ");
}

/** The sigil of dense lists, drawn by CSS (.ix-entry in globals.css): only the three
 * hues travel with each entry, so a page listing a thousand folders does not carry a
 * thousand gradients. Returns the class and style to put on the entry itself. */
export function sigilDot(seed: string, kind: PageKind, muted = false): { className: string; style: React.CSSProperties } {
  const [a, b, c] = sigilHues(seed);
  const shape = kind === "repo" ? " is-repo" : kind === "project" || kind === "docs" ? " is-proj" : "";
  return { className: `${shape}${muted ? " sigil-muted" : ""}`, style: { "--a": a, "--b": b, "--c": c } as React.CSSProperties };
}

/** The tile beneath a logo. A mark in light ink gets a dark tile in both themes, one in
 * dark ink a light tile; light-dark() follows the theme's color-scheme, so the manual
 * theme toggle is honoured too. Everything else sits on the raised surface. */
const LOGO_TILE: Record<LogoSurface | "quiet", string> = {
  quiet: "var(--surface)",
  dark: "light-dark(color-mix(in oklab, var(--ink) 90%, var(--surface)), var(--bg-sunk))",
  light: "light-dark(var(--surface), var(--ink))",
  none: "var(--bg-sunk)",
};

export const sigilRadius = (kind: PageKind, size: number) =>
  kind === "repo" ? "9999px" : kind === "project" || kind === "docs" ? `${Math.round(size * 0.3)}px` : `${Math.round(size * 0.18)}px`;

export function Sigil({
  seed,
  name,
  kind,
  muted,
  size = 28,
  className = "",
  logo,
  logoSurface,
}: {
  seed: string;
  name: string;
  kind: PageKind;
  muted?: boolean;
  size?: number;
  className?: string;
  /** Where the logo is served (logoSrc in lib/logo.ts, same origin). Drawn with <img>, never as markup. */
  logo?: string | null;
  logoSurface?: LogoSurface | null;
}) {
  const radius = sigilRadius(kind, size);
  if (logo) {
    const full = logoSurface === "none";
    // A circle holds less than a square of the same width, so round tiles pad more; the
    // smallest tiles pad least, or the mark would shrink to a speck.
    const share = kind === "repo" ? (size < 24 ? 0.7 : 0.6) : size < 24 ? 0.8 : 0.68;
    const inner = full ? size : Math.round(size * share);
    return (
      <span
        aria-hidden
        className={`sigil relative inline-grid shrink-0 place-items-center overflow-hidden ${className}`}
        style={{ width: size, height: size, borderRadius: radius, background: LOGO_TILE[logoSurface ?? "quiet"] }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a small same-origin logo, cached for good: nothing to optimise */}
        <img
          src={logo}
          alt=""
          width={inner}
          height={inner}
          decoding="async"
          draggable={false}
          className={`block select-none ${full ? "object-cover" : "object-contain"}`}
          style={{ width: inner, height: inner }}
        />
        {!full && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_var(--line-strong)]" />}
      </span>
    );
  }
  const letter = (name.replace(/^[^\p{L}\p{N}]+/u, "")[0] ?? "·").toUpperCase();
  return (
    <span
      aria-hidden
      className={`sigil relative inline-grid shrink-0 place-items-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: sigilGradient(seed, muted),
      }}
    >
      <span
        className="font-display leading-none text-white/95"
        style={{ fontSize: size * 0.56, textShadow: "0 1px 2px rgb(0 0 0 / 0.18)", transform: "translateY(4%)" }}
      >
        {letter}
      </span>
    </span>
  );
}
