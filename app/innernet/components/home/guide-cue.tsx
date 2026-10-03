import "./home.css";

// The foot of the home page's first screen: a quiet way down to the field guide, which
// begins just below. A hairline with a drop of ink running down it (still for readers
// who ask for less motion).

export function GuideCue({ delay = 0 }: { delay?: number }) {
  return (
    <a
      href="#guide"
      className="rise group mx-auto mt-8 flex flex-col items-center gap-3 px-6 pb-6 pt-3 text-muted transition-colors hover:text-ink sm:mt-10"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]">The field guide</span>
      <span aria-hidden className="home-cue-line" />
    </a>
  );
}
