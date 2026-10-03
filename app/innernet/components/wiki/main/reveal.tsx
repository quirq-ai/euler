"use client";

import { useEffect, useRef } from "react";

// Main page boxes below the globe ease in as they scroll into view. The server renders
// them visible; only once this script runs, and only for a box still below the window,
// is it hidden to be revealed, so nothing is lost without JavaScript and nothing in view
// ever blinks. Reduced motion: everything simply stays put.

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.reveal = "waiting";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`min-w-0 empty:hidden data-[reveal=waiting]:translate-y-5 data-[reveal=waiting]:opacity-0 data-[reveal=shown]:transition-[opacity,translate] data-[reveal=shown]:duration-700 data-[reveal=shown]:ease-[cubic-bezier(0.2,0.7,0.2,1)] ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
