import type { Segment } from "@/lib/search";

/** Snippet text with the matched runs wrapped in <mark>. Plain React text, never HTML. */
export function Snippet({ segments }: { segments: Segment[] }) {
  return <>{segments.map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>;
}
