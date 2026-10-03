"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sigil, sigilRadius } from "@/components/sigil";
import type { LogoSurface, PageKind } from "@/lib/types";

// The Innerpedia globe: one tile per project, laid out on a Fibonacci sphere and turning
// slowly in 3D. Everything it shows arrives in its props from the server; it fetches
// nothing. Each frame writes only transforms, opacity and stacking order, and the loop
// sleeps while the globe is off screen, while the tab is hidden, and (unless someone is
// turning it by hand) whenever the reader prefers reduced motion.

export interface GlobeTile {
  slug: string;
  href: string;
  title: string;
  name: string;
  kind: PageKind;
  gloss: string;
  logo: string | null;
  logoSurface: LogoSurface | null;
}

export interface GlobeCore {
  href: string;
  title: string;
  logo: string;
}

const T = 112; // every tile is drawn at this size, then scaled into place
const PHONE_TILES = 44; // fewer, larger tiles on a phone
const PHONE = "(max-width: 639.98px)";
const REDUCE = "(prefers-reduced-motion: reduce)";
const AUTO = (2 * Math.PI) / 120; // a full turn every two minutes
const TILT = 0.36; // the north pole leans towards the reader, so the globe is seen from a little above
const TILT_MIN = -0.2;
const TILT_MAX = 0.95;
const YAW0 = 0.6;
const CAMERA = 3.4; // distance from the centre in radii: how strong the perspective is
const FLAT = 0.3; // how much of a tile resists lying flat on the sphere, so marks stay legible near the rim
const RADIUS = 0.42; // sphere radius as a share of the stage
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const LATITUDES = [-60, -30, 0, 30, 60].map((d) => (d * Math.PI) / 180);

type Vec = [number, number, number];

/** Rotate a point on the unit sphere by yaw (around the axis) and then tilt (towards the reader). */
function turn(p: Vec, yaw: number, tilt: number): Vec {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
  const x = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  return [x, p[1] * ct - z1 * st, p[1] * st + z1 * ct];
}

/** n points spread evenly over the sphere, ordered by how squarely they face the reader
 * at the start, so the most substantial projects are the first thing seen. */
function lattice(n: number): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    pts.push([Math.cos(i * GOLDEN) * r, y, Math.sin(i * GOLDEN) * r]);
  }
  return pts.sort((a, b) => turn(b, YAW0, TILT)[2] - turn(a, YAW0, TILT)[2]);
}

/** Where each tile sits: the best tiles take the points facing the reader first, but a
 * tile whose logo (or heavy dark tile) is already on the globe looks a few points further
 * on for the one farthest from its twins, so repeated marks do not cluster. */
function place(tiles: GlobeTile[], n: number): Vec[] {
  const free = lattice(n);
  const out: Vec[] = [];
  const kin = (a: GlobeTile, b: GlobeTile) => (a.logo && a.logo === b.logo ? 1 : a.logoSurface === "dark" && b.logoSurface === "dark" ? 0.7 : 0);
  for (let i = 0; i < n; i++) {
    let pick = 0;
    let best = Infinity;
    for (let k = 0; k < Math.min(8, free.length); k++) {
      let near = -Infinity;
      for (let j = 0; j < out.length; j++) {
        const w = kin(tiles[i], tiles[j]);
        if (w) near = Math.max(near, w * (out[j][0] * free[k][0] + out[j][1] * free[k][1] + out[j][2] * free[k][2]));
      }
      if (near === -Infinity) break; // nothing like it yet: take the best free point
      if (near < best - 1e-9) [best, pick] = [near, k];
    }
    out.push(free.splice(pick, 1)[0]);
  }
  return out;
}

/** Tile side as a share of the radius: fewer tiles, bigger tiles. */
const tileShare = (n: number) => 0.66 * Math.sqrt((4 * Math.PI) / Math.max(n, 12));

/** A ring of latitude, split into the arcs in front of and behind the sphere's centre. */
function ringPaths(lat: number, tilt: number, r: number): { front: string; back: string } {
  let front = "", back = "";
  let prev: boolean | null = null;
  for (let i = 0; i <= 96; i++) {
    const th = (i / 96) * 2 * Math.PI;
    const p = turn([Math.cos(lat) * Math.cos(th), Math.sin(lat), Math.cos(lat) * Math.sin(th)], 0, tilt);
    const isFront = p[2] >= 0;
    const pt = `${(p[0] * r).toFixed(1)} ${(-p[1] * r).toFixed(1)}`;
    if (isFront) front += `${prev === true ? "L" : "M"}${pt}`;
    else back += `${prev === false ? "L" : "M"}${pt}`;
    // Join the halves where they meet, so neither ends short of the rim.
    if (prev !== null && prev !== isFront) {
      if (isFront) back += `L${pt}`;
      else front += `L${pt}`;
    }
    prev = isFront;
  }
  return { front, back };
}

// An orbit around the globe: a ring nearly edge on, leaning a little, with three glints
// travelling round it, behind the sphere on the far side and in front on the near side.
const ORBITS = [
  { r: 1.17, lean: -0.3, open: 0.26, speed: 0.11, glints: [0, 2.2, 4.1] },
  { r: 1.32, lean: 0.2, open: 0.17, speed: -0.07, glints: [1.1, 3.9] },
];

function orbitPoint(o: (typeof ORBITS)[number], t: number, r: number): Vec {
  // On the orbit's own circle, opened towards the reader by `open`, then leaned.
  const x = Math.cos(t) * o.r, y0 = -Math.sin(t) * o.r * Math.sin(o.open), z = Math.sin(t) * o.r * Math.cos(o.open);
  const cl = Math.cos(o.lean), sl = Math.sin(o.lean);
  return [(x * cl - y0 * sl) * r, (x * sl + y0 * cl) * r, z];
}

/** The near half of an orbit (sin t >= 0) and the far half, each drawn end to end. */
function orbitPaths(o: (typeof ORBITS)[number], r: number): { front: string; back: string } {
  let front = "", back = "";
  for (let i = 0; i <= 96; i++) {
    const [x, y] = orbitPoint(o, (i / 96) * 2 * Math.PI, r);
    const pt = `${x.toFixed(1)} ${(-y).toFixed(1)}`;
    if (i <= 48) front += `${i === 0 ? "M" : "L"}${pt}`;
    if (i >= 48) back += `${i === 48 ? "M" : "L"}${pt}`;
  }
  return { front, back };
}

export function Globe({ tiles, core, label }: { tiles: GlobeTile[]; core: GlobeCore | null; label: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const ringBack = useRef<SVGSVGElement>(null);
  const ringFront = useRef<SVGSVGElement>(null);
  const orbitFront = useRef<SVGSVGElement>(null);
  const glintRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipTitle = useRef<HTMLSpanElement>(null);
  const tipGloss = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const glintCount = (core ? ORBITS : ORBITS.slice(0, 1)).reduce((n, o) => n + o.glints.length, 0);
  const orbits = core ? ORBITS : ORBITS.slice(0, 1);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const els = tileRefs.current;
    const phoneMq = window.matchMedia(PHONE);
    const reduceMq = window.matchMedia(REDUCE);

    const s = {
      yaw: YAW0,
      tilt: TILT,
      vel: reduceMq.matches ? 0 : AUTO,
      clock: 0,
      size: 0,
      r: 0,
      n: 0,
      points: [] as Vec[],
      share: 0,
      ringTilt: Number.NaN,
      ringR: 0,
      hover: -1, // tile under the pointer
      focus: -1, // tile with keyboard focus
      goal: null as { yaw: number; tilt: number } | null, // turning a focused tile to the front
      drag: null as null | { id: number; x0: number; y0: number; x: number; y: number; t: number; moved: boolean; touch: boolean },
      flick: 0, // velocity of the last drag, carried into the spin
      eatClick: false,
      visible: true,
      raf: 0,
      last: 0,
      cache: [] as { t: string; o: string; z: number; pe: string }[],
    };

    const setup = () => {
      s.n = Math.min(tiles.length, phoneMq.matches ? PHONE_TILES : tiles.length);
      s.points = place(tiles, s.n);
      s.share = tileShare(s.n);
      s.cache = [];
    };

    const measure = () => {
      const box = stage.getBoundingClientRect();
      s.size = Math.min(box.width, box.height);
      s.r = s.size * RADIUS;
      s.ringTilt = Number.NaN;
    };

    const weight = (i: number) => (i < 8 ? 1.12 : i < s.n * 0.6 ? 1 : 0.9);

    const drawRings = () => {
      if (Math.abs(s.tilt - s.ringTilt) < 0.002 && s.ringR === s.r) return;
      s.ringTilt = s.tilt;
      s.ringR = s.r;
      const back = ringBack.current?.querySelectorAll<SVGPathElement>("path[data-lat]");
      const front = ringFront.current?.querySelectorAll<SVGPathElement>("path[data-lat]");
      LATITUDES.forEach((lat, i) => {
        const { front: f, back: b } = ringPaths(lat, s.tilt, s.r);
        back?.[i]?.setAttribute("d", b);
        front?.[i]?.setAttribute("d", f);
      });
      const ob = ringBack.current?.querySelectorAll<SVGPathElement>("path[data-orbit]");
      const of = orbitFront.current?.querySelectorAll<SVGPathElement>("path[data-orbit]");
      orbits.forEach((o, i) => {
        const { front: f, back: b } = orbitPaths(o, s.r);
        ob?.[i]?.setAttribute("d", b);
        of?.[i]?.setAttribute("d", f);
      });
    };

    const layout = () => {
      if (!s.r) return;
      drawRings();
      const ct = Math.cos(s.tilt), st = Math.sin(s.tilt);
      for (let i = 0; i < s.n; i++) {
        const el = els[i];
        if (!el) continue;
        const [x, y, z] = turn(s.points[i], s.yaw, s.tilt);
        // The tile lies on the sphere: its sides run along the lines of latitude and
        // longitude, so it foreshortens towards the rim. East is the axis crossed with the point.
        let ex = ct * z - st * y, ey = st * x, ez = -ct * x;
        const len = Math.hypot(ex, ey, ez);
        if (len < 1e-4) [ex, ey, ez] = [1, 0, 0];
        else [ex, ey, ez] = [ex / len, ey / len, ez / len];
        const nx = y * ez - z * ey, ny = z * ex - x * ez;
        // Seen from behind, the tile is turned round so its mark is never mirrored.
        const flip = z < 0 ? -1 : 1;
        const persp = (CAMERA / (CAMERA - z)) * 0.84;
        const k = (s.r * s.share * weight(i) * persp) / T;
        const a = ((1 - FLAT) * ex * flip + FLAT) * k;
        const b = (1 - FLAT) * -ey * flip * k;
        const c = (1 - FLAT) * -nx * k;
        const d = ((1 - FLAT) * ny + FLAT) * k;
        const t = `matrix(${a.toFixed(4)},${b.toFixed(4)},${c.toFixed(4)},${d.toFixed(4)},${(x * s.r).toFixed(2)},${(-y * s.r).toFixed(2)})`;
        // Opacity and stacking in coarse steps: fewer style writes, the same picture.
        const o = (z >= 0 ? 0.6 + 0.4 * Math.min(1, z * 1.7) : 0.08 + 0.52 * (1 + z) ** 2).toFixed(2);
        const zi = 500 + Math.round(z * 120);
        const pe = z > 0.08 ? "auto" : "none";
        const prev = s.cache[i];
        if (!prev || prev.t !== t) el.style.transform = t;
        if (!prev || prev.o !== o) el.style.opacity = o;
        if (!prev || prev.z !== zi) el.style.zIndex = String(zi);
        if (!prev || prev.pe !== pe) el.style.pointerEvents = pe;
        s.cache[i] = { t, o, z: zi, pe };
      }
      // The glints on the orbits.
      let g = 0;
      orbits.forEach((o) => {
        for (const start of o.glints) {
          const el = glintRefs.current[g++];
          if (!el) continue;
          const [x, y, z] = orbitPoint(o, start + s.clock * o.speed * (reduceMq.matches ? 0 : 1), s.r);
          el.style.transform = `translate(${x.toFixed(1)}px,${(-y).toFixed(1)}px) scale(${(0.7 + 0.3 * (z + 1) / 2).toFixed(3)})`;
          el.style.zIndex = z >= 0 ? "1002" : "2";
          el.style.opacity = (z >= 0 ? 1 : 0.35).toFixed(2);
        }
      });
      placeTip();
    };

    const placeTip = () => {
      const tip = tipRef.current;
      const i = s.focus >= 0 ? s.focus : s.hover;
      if (!tip) return;
      if (i < 0 || i >= s.n) {
        tip.dataset.on = "";
        return;
      }
      const [x, y, z] = turn(s.points[i], s.yaw, s.tilt);
      const half = (s.r * s.share * weight(i) * (CAMERA / (CAMERA - z)) * 0.84) / 2;
      const lim = s.size / 2 - 8;
      tip.style.transform = `translate(${Math.max(-lim, Math.min(lim, x * s.r)).toFixed(1)}px, ${(-y * s.r - half - 10).toFixed(1)}px)`;
      tip.dataset.on = "1";
    };

    const showTip = (i: number) => {
      const t = tiles[i];
      if (!t || !tipTitle.current || !tipGloss.current) return;
      tipTitle.current.textContent = t.title;
      tipGloss.current.textContent = t.gloss;
    };

    const still = () => reduceMq.matches && !s.drag && !s.goal && Math.abs(s.flick) < 0.002;

    const frame = (now: number) => {
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0;
      s.last = now;
      s.clock += dt;
      if (s.goal) {
        // Bring the focused tile round to face the reader.
        const e = 1 - Math.exp(-dt * (reduceMq.matches ? 1000 : 5));
        s.yaw += (s.goal.yaw - s.yaw) * e;
        s.tilt += (s.goal.tilt - s.tilt) * e;
        s.vel = 0;
        if (Math.abs(s.goal.yaw - s.yaw) < 0.001 && Math.abs(s.goal.tilt - s.tilt) < 0.001) s.goal = null;
      } else if (!s.drag) {
        // Spin: a flick carries on and settles back into the slow turn; hovering stops it.
        const target = s.hover >= 0 || s.focus >= 0 || reduceMq.matches ? 0 : AUTO;
        s.flick *= Math.exp(-dt * 1.6);
        s.vel += (target - s.vel) * (1 - Math.exp(-dt * 2.2));
        s.yaw += (s.vel + s.flick) * dt;
        // Left alone, the globe slowly settles back to its resting lean.
        if (s.focus < 0 && !reduceMq.matches) s.tilt += (TILT - s.tilt) * (1 - Math.exp(-dt * 0.5));
        if (reduceMq.matches) s.flick = Math.abs(s.flick) < 0.002 ? 0 : s.flick;
      }
      layout();
      if (s.visible && !still()) s.raf = requestAnimationFrame(frame);
      else {
        s.raf = 0;
        s.last = 0;
      }
    };

    const wake = () => {
      if (!s.raf && s.visible) s.raf = requestAnimationFrame(frame);
    };

    setup();
    measure();
    layout();
    setReady(true);
    wake();

    const ro = new ResizeObserver(() => {
      measure();
      s.cache = [];
      layout();
    });
    ro.observe(stage);
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting;
      if (s.visible) wake();
    });
    io.observe(stage);
    const onPhone = () => {
      setup();
      layout();
    };
    phoneMq.addEventListener("change", onPhone);
    const onReduce = () => {
      s.vel = reduceMq.matches ? 0 : AUTO;
      wake();
    };
    reduceMq.addEventListener("change", onReduce);

    // ------------------------------------------------ turning it by hand
    const indexOf = (target: EventTarget | null) => {
      const a = (target as HTMLElement | null)?.closest?.("a[data-tile]");
      return a ? Number((a as HTMLElement).dataset.tile) : -1;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || s.drag) return;
      s.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false, touch: e.pointerType !== "mouse" };
      s.flick = 0;
    };
    const move = (e: PointerEvent) => {
      const d = s.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 5) {
        d.moved = true;
        s.goal = null;
        stage.setPointerCapture(e.pointerId);
        stage.dataset.grabbing = "1";
      }
      if (!d.moved) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      const dt = Math.max(1, e.timeStamp - d.t) / 1000;
      s.yaw += dx / s.r;
      // On a touch screen up and down scroll the page; only a mouse tips the globe.
      if (!d.touch) s.tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, s.tilt + dy / s.r));
      s.flick = reduceMq.matches ? 0 : Math.max(-4, Math.min(4, (dx / s.r / dt) * 0.6 + s.flick * 0.4));
      s.vel = 0;
      d.x = e.clientX;
      d.y = e.clientY;
      d.t = e.timeStamp;
      wake();
    };
    const up = (e: PointerEvent) => {
      const d = s.drag;
      if (!d || e.pointerId !== d.id) return;
      if (d.moved) {
        s.eatClick = true;
        if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
        // A drag that stops before letting go does not fling.
        if (e.timeStamp - d.t > 80) s.flick = 0;
      }
      s.drag = null;
      delete stage.dataset.grabbing;
      wake();
    };
    const cancel = (e: PointerEvent) => {
      if (s.drag?.id !== e.pointerId) return;
      s.drag = null;
      delete stage.dataset.grabbing;
      wake();
    };
    const click = (e: MouseEvent) => {
      if (!s.eatClick) return;
      s.eatClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || s.drag?.moved) return;
      const i = indexOf(e.target);
      if (i === s.hover) return;
      s.hover = i;
      if (i >= 0) showTip(i);
      else if (s.focus >= 0) showTip(s.focus);
      wake();
    };
    const leave = () => {
      s.hover = -1;
      if (s.focus >= 0) showTip(s.focus);
      wake();
    };

    // ------------------------------------------------ keyboard: one stop, arrows between tiles
    const focusIn = (e: FocusEvent) => {
      const i = indexOf(e.target);
      if (i < 0) return;
      els.forEach((el, j) => el && (el.tabIndex = j === i ? 0 : -1));
      if (!(e.target as HTMLElement).matches(":focus-visible")) return;
      s.focus = i;
      showTip(i);
      // The nearest turn that brings this tile to the front, tipped to its latitude.
      const p = s.points[i];
      if (p) {
        const want = Math.atan2(-p[0], p[2]);
        const yaw = s.yaw + ((((want - s.yaw) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        // Tipping the globe by a tile's latitude brings that latitude to the middle.
        const lat = Math.asin(Math.max(-1, Math.min(1, p[1])));
        s.goal = { yaw, tilt: Math.max(-0.8, Math.min(TILT_MAX, lat * 0.9 + TILT * 0.1)) };
      }
      wake();
    };
    const focusOut = (e: FocusEvent) => {
      if (stage.contains(e.relatedTarget as Node | null)) return;
      s.focus = -1;
      s.goal = null;
      if (s.hover >= 0) showTip(s.hover);
      wake();
    };
    const key = (e: KeyboardEvent) => {
      const i = indexOf(e.target);
      if (i < 0) return;
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      const to = e.key === "Home" ? 0 : e.key === "End" ? s.n - 1 : step ? (i + step + s.n) % s.n : -1;
      if (to < 0) return;
      e.preventDefault();
      els[to]?.focus();
    };
    const noDrag = (e: DragEvent) => e.preventDefault();

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", cancel);
    stage.addEventListener("click", click, true);
    stage.addEventListener("pointerover", over);
    stage.addEventListener("pointerleave", leave);
    stage.addEventListener("focusin", focusIn);
    stage.addEventListener("focusout", focusOut);
    stage.addEventListener("keydown", key);
    stage.addEventListener("dragstart", noDrag);
    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      io.disconnect();
      phoneMq.removeEventListener("change", onPhone);
      reduceMq.removeEventListener("change", onReduce);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", cancel);
      stage.removeEventListener("click", click, true);
      stage.removeEventListener("pointerover", over);
      stage.removeEventListener("pointerleave", leave);
      stage.removeEventListener("focusin", focusIn);
      stage.removeEventListener("focusout", focusOut);
      stage.removeEventListener("keydown", key);
      stage.removeEventListener("dragstart", noDrag);
    };
    // The tiles come from the server and do not change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={stageRef}
      role="group"
      aria-label={label}
      data-ready={ready ? "1" : undefined}
      className="relative isolate aspect-square w-full touch-pan-y select-none opacity-0 transition-opacity duration-[900ms] ease-out data-[ready]:opacity-100 data-[grabbing]:cursor-grabbing cursor-grab"
    >
      {/* A soft shadow on the paper beneath, so the globe floats. */}
      <span aria-hidden className="pointer-events-none absolute bottom-[1%] left-1/2 h-[7%] w-[58%] -translate-x-1/2 rounded-[50%] bg-ink/10 blur-2xl" />
      {/* The sphere's body: a faint volume the far tiles show through. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1] size-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 36% 30%, color-mix(in oklab, var(--surface) 85%, transparent) 0%, color-mix(in oklab, var(--bg-sunk) 55%, transparent) 58%, color-mix(in oklab, var(--ink) 7%, transparent) 100%)",
          boxShadow: "inset 0 0 0 1px var(--line), 0 30px 120px -30px var(--aurora-2)",
        }}
      />
      <svg ref={ringBack} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[2] overflow-visible" width="1" height="1">
        {LATITUDES.map((lat) => (
          <path key={lat} data-lat fill="none" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="2 5" />
        ))}
        {orbits.map((o) => (
          <path key={o.r} data-orbit fill="none" stroke="var(--line-strong)" strokeWidth="1" />
        ))}
      </svg>
      {core && (
        <Link
          href={core.href}
          prefetch={false}
          tabIndex={-1}
          aria-hidden
          draggable={false}
          className="absolute left-1/2 top-1/2 z-[500] block size-[30%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
          style={{
            boxShadow:
              "0 0 0 1px var(--line-strong), 0 0 40px 6px color-mix(in oklab, var(--aurora-1) 80%, transparent), 0 0 120px 30px color-mix(in oklab, var(--aurora-2) 70%, transparent)",
          }}
          title={core.title}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a small same-origin logo (lib/logo.ts) */}
          <img src={core.logo} alt="" draggable={false} className="size-full object-cover" />
        </Link>
      )}
      <svg ref={ringFront} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[501] overflow-visible" width="1" height="1">
        {LATITUDES.map((lat) => (
          <path key={lat} data-lat fill="none" stroke="var(--line-strong)" strokeWidth={lat === 0 ? 1.25 : 1} />
        ))}
      </svg>
      {/* The near half of each orbit passes in front of the tiles. */}
      <svg ref={orbitFront} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[1002] overflow-visible" width="1" height="1">
        {orbits.map((o) => (
          <path key={o.r} data-orbit fill="none" stroke="var(--line-strong)" strokeWidth="1" />
        ))}
      </svg>

      {tiles.map((t, i) => (
        <Link
          key={t.slug}
          ref={(el) => {
            tileRefs.current[i] = el;
          }}
          href={t.href}
          prefetch={false}
          draggable={false}
          data-tile={i}
          tabIndex={i === 0 ? 0 : -1}
          aria-label={t.gloss ? `${t.title}, ${t.gloss}` : t.title}
          className={`absolute left-1/2 top-1/2 block will-change-transform focus-visible:outline-offset-4 ${i >= PHONE_TILES ? "max-sm:hidden" : ""}`}
          style={{ width: T, height: T, marginLeft: -T / 2, marginTop: -T / 2, borderRadius: sigilRadius(t.kind, T), opacity: 0 }}
        >
          <Sigil seed={t.slug} name={t.name} kind={t.kind} size={T} logo={t.logo} logoSurface={t.logoSurface} className="shadow-soft" />
        </Link>
      ))}

      {Array.from({ length: glintCount }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            glintRefs.current[i] = el;
          }}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-[6px] rounded-full"
          style={{ background: `var(--aurora-${(i % 3) + 1})`, boxShadow: `0 0 10px 2px var(--aurora-${(i % 3) + 1})` }}
        />
      ))}

      {/* Light from the upper left: a soft highlight and a rim on the far edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1001] size-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 24%, light-dark(color-mix(in oklab, var(--surface) 55%, transparent), color-mix(in oklab, var(--ink) 10%, transparent)) 0%, transparent 38%)",
          boxShadow:
            "inset -18px -22px 60px -36px color-mix(in oklab, var(--aurora-2) 90%, transparent), inset 10px 12px 40px -30px light-dark(color-mix(in oklab, var(--surface) 90%, transparent), color-mix(in oklab, var(--ink) 30%, transparent))",
        }}
      />

      <div
        ref={tipRef}
        aria-hidden
        data-on=""
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1100] opacity-0 transition-opacity duration-150 data-[on='1']:opacity-100"
      >
        <div className="-translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-line bg-surface/95 px-3 py-1.5 text-center shadow-lift backdrop-blur">
          <span ref={tipTitle} className="block font-display text-[19px] leading-tight text-ink" />
          <span ref={tipGloss} className="block text-[11.5px] leading-snug text-muted" />
        </div>
      </div>
    </div>
  );
}
