"use client";

import { useEffect } from "react";

// The guide's calm motion, in one observer pair: blocks rise in as they reach the
// reader, and each plate draws itself on, layer by layer, the first time it is seen.
// Construction lines first, then the main strokes, the detail, the blue accent, and
// last the labels. Nothing moves for readers who ask for less motion, and without
// JavaScript everything is simply there.

const SHAPES = "path, line, polyline, polygon, circle, ellipse, rect";

// Layer timing in seconds: when a layer starts, how long one stroke takes, the gap
// between strokes, and the most that gap may add up to.
const LAYERS: { cls: string; start: number; dur: number; step: number; spread: number }[] = [
  { cls: "L-con", start: 0, dur: 0.9, step: 0.012, spread: 0.35 },
  { cls: "L-main", start: 0.25, dur: 1.4, step: 0.03, spread: 0.6 },
  { cls: "L-det", start: 0.7, dur: 0.9, step: 0.012, spread: 0.4 },
  { cls: "L-acc", start: 1.0, dur: 1.0, step: 0.06, spread: 0.4 },
  { cls: "L-lbl", start: 1.2, dur: 0.7, step: 0.015, spread: 0.5 },
];

/** Marks every stroke of a plate for drawing (or fading, when it cannot be drawn). */
function prepare(host: HTMLElement) {
  // Read every computed style first, then write, so the browser styles the plate once.
  const plan = LAYERS.flatMap((layer) =>
    [...host.querySelectorAll<SVGElement>(`.${layer.cls} :is(${SHAPES}, text, use, image)`)].map((el, i) => {
      const cs = getComputedStyle(el);
      const drawable = layer.cls !== "L-lbl" && el.matches(SHAPES) && cs.stroke !== "none" && cs.strokeDasharray === "none";
      return { el, drawable, delay: layer.start + Math.min(i * layer.step, layer.spread), dur: layer.dur };
    }),
  );
  for (const { el, drawable, delay, dur } of plan) {
    el.style.setProperty("--fg-delay", `${delay.toFixed(3)}s`);
    el.style.setProperty("--fg-dur", `${dur}s`);
    if (drawable) el.setAttribute("pathLength", "1");
    el.dataset.fg = drawable ? "draw" : "fade";
  }
}

export function GuideMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Rise: only what is still below the fold is hidden, so nothing on screen blinks.
    const fold = window.innerHeight * 0.94;
    const pending = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter((el) => el.getBoundingClientRect().top > fold);
    for (const el of pending) el.dataset.reveal = "pending";
    const rise = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = "in";
          rise.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    pending.forEach((el) => rise.observe(el));

    // Draw: every plate waits, then draws when a quarter of it is in view.
    // Prepared once: a second run (React runs effects twice in development) would read
    // the hidden strokes' styles and take them for undrawable.
    const plates = [...document.querySelectorAll<HTMLElement>("[data-draw]")].filter((p) => p.dataset.draw !== "go");
    for (const p of plates) {
      if (p.dataset.draw === "ready") continue;
      prepare(p);
      p.dataset.draw = "ready";
    }
    const draw = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.draw = "go";
          draw.unobserve(e.target);
        }
      },
      { threshold: 0.25 },
    );
    plates.forEach((p) => draw.observe(p));

    return () => {
      rise.disconnect();
      draw.disconnect();
    };
  }, []);

  return null;
}
