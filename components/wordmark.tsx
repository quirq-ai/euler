import Link from "next/link";

// "innernet" and "Innerpedia" share one lockup: the display serif with the "inner"
// half in italic, a quiet nod to the thing being searched being you.

export function Wordmark({ size = 28, href = "/", className = "" }: { size?: number; href?: string | null; className?: string }) {
  const mark = (
    <span className={`font-display tracking-[-0.01em] text-ink ${className}`} style={{ fontSize: size, lineHeight: 1 }}>
      <em className="italic">inner</em>net
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Innernet home" className="inline-flex items-baseline">
      {mark}
    </Link>
  ) : (
    mark
  );
}

export function PediaMark({ size = 24, href = "/wiki", className = "" }: { size?: number; href?: string | null; className?: string }) {
  const mark = (
    <span className={`font-display tracking-[-0.01em] text-ink ${className}`} style={{ fontSize: size, lineHeight: 1 }}>
      <em className="italic">Inner</em>pedia
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Innerpedia main page" className="inline-flex items-baseline">
      {mark}
    </Link>
  ) : (
    mark
  );
}
