// Runtime: one paused GSAP timeline for the whole film. Scene modules add their own
// tweens through the kit `k`; everything continuous (theme blend, HUD, counter, ruler,
// captions, cut effects, grain, flicker, aurora) is a pure function of time written by a
// single ticker. Seek-safe and deterministic: no clocks, no unseeded randomness.
(function () {
  const D = window.FILM_DATA;
  const root = document.getElementById("root");
  const tl = gsap.timeline({ paused: true });
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const segById = Object.fromEntries(D.segs.map((s) => [s.id, s]));

  // ------------------------------------------------------------------ theme
  // Paper by day, ink by night. The night factor rises across the chapter III card
  // (dusk) and falls at the close (dawn); every token is blended in linear space.
  const PAPER = { bg: [247, 245, 240], ink: [28, 27, 24], ink2: [70, 67, 60], muted: [95, 90, 82], link: [42, 82, 196], surface: [255, 254, 251] };
  const NIGHT = { bg: [15, 15, 14], ink: [236, 234, 227], ink2: [200, 197, 187], muted: [162, 157, 146], link: [157, 182, 255], surface: [26, 26, 24] };
  const dusk = D.segs.find((s) => s.card && s.theme === "night");
  const close = D.segs[D.segs.length - 1];
  // Dusk and dawn take about a second; text crosses from dark to light in the middle
  // fifth of that, so no line of type ever sits on a background of its own tone.
  const nightAt = (t) => (dusk ? smooth(dusk.start - 0.25, dusk.start + 0.75, t) - smooth(close.start - 0.15, close.start + 0.9, t) : 0);
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const rgb = (c, a) => (a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  let lastNight = -1;
  function applyTheme(n) {
    const q = Math.round(n * 200) / 200;
    if (q === lastNight) return;
    lastNight = q;
    const c = {};
    const tq = smooth(0.38, 0.62, q);
    for (const key in PAPER) c[key] = mix(PAPER[key], NIGHT[key], key === "bg" || key === "surface" ? q : tq);
    const s = root.style;
    s.setProperty("--bg", rgb(c.bg));
    s.setProperty("--ink", rgb(c.ink));
    s.setProperty("--ink2", rgb(c.ink2));
    s.setProperty("--muted", rgb(c.muted));
    s.setProperty("--link", rgb(c.link));
    s.setProperty("--surface", rgb(c.surface));
    s.setProperty("--line", rgb(c.ink, 0.17 + 0.05 * q));
    s.setProperty("--con", rgb(c.ink, 0.3 - 0.05 * q));
    s.setProperty("--night", String(q));
  }

  // ------------------------------------------------------------------ draw-on
  // Strokes are hidden at dashoffset HIDE (dasharray 100 110, film.css), one unit past the
  // end, so a round cap never leaves a dot before the draw starts. Chrome restarts the dash
  // pattern on every subpath, so a path with a few subpaths (an arrow and its head) is split
  // into pieces drawn one after another, and one with many (dashes, hatching, ticks) has all
  // its pieces grow together over the whole draw instead of popping in.
  const HIDE = 101;
  // Geometry (src/geo.js) is read once, synchronously, while the timeline is built.
  const geo = {
    len: (d) => window.FILM_GEO.len(d),
    plan(e) {
      if (e.tagName !== "path" || e.__planned) return null;
      const d = (e.getAttribute("d") || "").trim();
      const subs = d.split(/(?=M)/).map((x) => x.trim()).filter(Boolean);
      if (subs.length < 2) return null;
      e.__planned = true;
      if (subs.length <= 8) {
        const pieces = [e];
        e.setAttribute("d", subs[0]);
        let prev = e;
        for (const sd of subs.slice(1)) {
          const c = e.cloneNode(false);
          c.removeAttribute("id");
          c.setAttribute("d", sd);
          c.__planned = true;
          prev.after(c);
          prev = c;
          pieces.push(c);
        }
        return { pieces, lens: subs.map((sd) => this.len(sd) || 1) };
      }
      const total = this.len(d);
      if (!(total > 0)) return null;
      let mx = 0;
      for (const sd of subs) mx = Math.max(mx, this.len(sd));
      return { end: Math.max(0, 100 - (100 * mx) / total) };
    },
    /** Draw els on from `at`, element i starting at at + i * each. */
    drawOn(els, at, dur, each, ease) {
      const plain = [], idx = [];
      els.forEach((e, i) => {
        const t = at + i * each;
        const p = this.plan(e);
        if (!p) { plain.push(e); idx.push(i); return; }
        if (p.pieces) {
          const sum = p.lens.reduce((a, b) => a + b, 0) || 1;
          let cum = 0;
          p.pieces.forEach((q, j) => {
            const t0 = t + (dur * cum) / sum, d0 = Math.max(0.06, (dur * p.lens[j]) / sum);
            cum += p.lens[j];
            tl.fromTo(q, { strokeDashoffset: HIDE }, { strokeDashoffset: 0, duration: d0, ease: j === 0 ? ease : "power1.out" }, t0);
          });
        } else tl.fromTo(e, { strokeDashoffset: HIDE }, { strokeDashoffset: p.end, duration: dur, ease }, t);
      });
      if (plain.length) tl.fromTo(plain, { strokeDashoffset: HIDE }, { strokeDashoffset: 0, duration: dur, ease, stagger: (j) => idx[j] * each }, at);
    },
  };

  // ------------------------------------------------------------------ kit
  const SHAPES = "path,line,circle,ellipse,rect,polyline,polygon";
  const counterEvents = []; // { t, label, value, dur }
  const pulses = []; // HUD privacy-meter emphasis windows
  let lockAt = null; // when the HUD padlock closes (k.lockHud)
  const k = {
    tl, $, $$, D, seg: segById, clamp,
    /** Absolute time of the nth occurrence of a word in this scene's narration (case and punctuation ignored). */
    word(seg, w, nth = 0) {
      if (!seg.vo) return seg.start;
      const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
      const hits = seg.vo.words.filter((x) => norm(x.text) === norm(w));
      const hit = hits[Math.min(nth, hits.length - 1)];
      if (!hit) console.warn(`word "${w}" not in ${seg.id}`);
      return seg.voStart + (hit ? hit.start : 0);
    },
    /** Draw an inlined plate on, layer by layer, over `T` seconds from `S`. `acc: false`
     *  leaves the accent layer to the scene; `lblSpan` caps how long the labels take. */
    drawPlate(scope, S, T, o = {}) {
      const svg = scope && (scope.matches?.(".plate-svg") ? scope : $(".plate-svg", scope));
      if (!svg) return;
      const L = (c) => {
        const g = $("." + c, svg);
        return g ? $$(SHAPES, g) : [];
      };
      const on = (els, at, dur, spread, ease) => geo.drawOn(els, at, dur, spread / Math.max(1, els.length), ease);
      on(L("L-con"), S + 0.02, 0.8, Math.min(1.0, T * 0.2), "power1.inOut");
      on(L("L-main"), S + 0.2, 0.8, T * (o.mainSpread ?? 0.34), "power2.inOut");
      on(L("L-det"), S + 0.55, 0.5, T * (o.detSpread ?? 0.36), "power1.out");
      if (o.acc !== false) on(L("L-acc"), o.acc ?? S + T * 0.5, 0.7, o.accSpread ?? 0.45, "expo.out");
      const labels = $$(".L-lbl text", svg);
      const span = o.lblSpan ?? Math.min(T * 0.3, 1.6);
      if (labels.length) tl.fromTo(labels, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "none", stagger: Math.min(0.06, span / labels.length) }, S + (o.lbl ?? T * 0.28));
    },
    /** Draw arbitrary SVG strokes on (elements need pathLength="100"). */
    draw(els, at, dur = 0.8, spread = 0.3, ease = "power2.inOut") {
      els = Array.isArray(els) ? els : $$(SHAPES, els);
      if (els.length) geo.drawOn(els, at, dur, spread / els.length, ease);
    },
    /** Camera: settle in from `from`, then drift to `to` for the rest of the scene. */
    camera(el, S, T, o = {}) {
      if (!el) return;
      const from = o.from ?? { scale: 1.06, x: 0, y: 14 };
      const mid = o.mid ?? { scale: 1, x: 0, y: 0 };
      const to = o.to ?? { scale: 1.035, x: 0, y: -8 };
      const settle = o.settle ?? 1.0;
      tl.fromTo(el, { ...from }, { ...mid, duration: settle, ease: o.ease ?? "expo.out" }, S);
      tl.fromTo(el, { ...mid }, { ...to, duration: Math.max(0.1, T - settle), ease: "none", immediateRender: false }, S + settle);
    },
    /** The bottom-left caption block: #<p>-big, -unit, -rule, -title, -line. */
    capBlock(p, S) {
      tl.fromTo(`#${p}-big`, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, S + 0.1);
      tl.fromTo(`#${p}-unit`, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "none" }, S + 0.35);
      tl.fromTo(`#${p}-rule`, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "expo.inOut" }, S + 0.15);
      tl.fromTo(`#${p}-title`, { opacity: 0, y: 24, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.55, ease: "power3.out" }, S + 0.32);
      tl.fromTo(`#${p}-line`, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, S + 0.62);
    },
    /** Soft rise-in for one or more elements. */
    rise(els, at, o = {}) {
      tl.fromTo(els, { opacity: 0, y: o.y ?? 18 }, { opacity: 1, y: 0, duration: o.dur ?? 0.6, ease: o.ease ?? "power3.out", stagger: o.stagger ?? 0 }, at);
    },
    fade(els, at, dur = 0.5, from = 0, to = 1) {
      tl.fromTo(els, { opacity: from }, { opacity: to, duration: dur, ease: "none" }, at);
    },
    /** Type a text node on, character by character (needs data-text on the element). */
    typeOn(el, at, dur) {
      el = typeof el === "string" ? $(el) : el;
      if (!el) return;
      const text = el.dataset.text ?? el.textContent;
      el.textContent = "";
      const o = { n: 0 };
      tl.fromTo(o, { n: 0 }, { n: text.length, duration: dur, ease: "none", onUpdate: () => (el.textContent = text.slice(0, Math.round(o.n))) }, at);
    },
    /** Count a number up inside el. */
    countUp(el, at, dur, from, to, fmt = (v) => Math.round(v).toLocaleString("en-US")) {
      el = typeof el === "string" ? $(el) : el;
      if (!el) return;
      const o = { v: from };
      el.textContent = fmt(from);
      tl.fromTo(o, { v: from }, { v: to, duration: dur, ease: "power2.out", onUpdate: () => (el.textContent = fmt(o.v)) }, at);
    },
    /** Strike-through or underline: elements scale in from the left. */
    strike(els, at, dur = 0.45, stagger = 0.12) {
      tl.fromTo(els, { scaleX: 0 }, { scaleX: 1, duration: dur, ease: "power3.inOut", stagger, transformOrigin: "0% 50%" }, at);
    },
    /** Spring pop entrance. */
    pop(els, at, o = {}) {
      tl.fromTo(els, { opacity: 0, scale: o.from ?? 0.6 }, { opacity: 1, scale: 1, duration: o.dur ?? 0.55, ease: o.ease ?? "back.out(1.8)", stagger: o.stagger ?? 0 }, at);
    },
    /** Change the HUD running index at time t (label and value), counting over `dur`. */
    counter(t, label, value, dur = 1.2) {
      counterEvents.push({ t, label, value, dur });
    },
    /** Make the privacy meter glow for a moment (e.g. in the privacy scene). */
    pulseMeter(t, dur = 2.4) {
      pulses.push({ t, dur });
    },
    /** The HUD padlock joins the privacy meter and clicks shut at t (once, at F07). Before
     *  any scene calls it the meter shows its padlock from the start. */
    lockHud(t) {
      lockAt = t;
    },
  };
  window.FILM_KIT = k;

  // ------------------------------------------------------------------ scenes
  const motions = window.SCENE_MOTION || {};
  for (const seg of D.segs) {
    const el = document.getElementById("s" + seg.id);
    if (!el) continue;
    if (seg.card) {
      cardMotion(seg);
      continue;
    }
    const fn = motions[seg.id];
    if (fn) fn(tl, seg.start, seg.dur, k, seg, el);
    else tl.fromTo(el.querySelector(".scene-in"), { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "none" }, seg.start);
  }

  function cardMotion(seg) {
    const S = seg.start, T = seg.dur, p = "#s" + seg.id;
    tl.fromTo(`${p} .card-ghost`, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 1.4, ease: "power2.out" }, S);
    tl.fromTo(`${p} .card-ghost`, { y: 18 }, { y: -18, duration: T, ease: "none" }, S);
    tl.fromTo(`${p} .card-kicker`, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, S + 0.15);
    $$(`${p} .card-word .gl`).forEach((g, i, all) => {
      const mid = (all.length - 1) / 2;
      tl.fromTo(g, { x: (i - mid) * 22, opacity: 0 }, { x: 0, opacity: 1, duration: 1.0, ease: "expo.out" }, S + 0.1 + Math.abs(i - mid) * 0.025);
    });
    tl.fromTo(`${p} .card-rule`, { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: "expo.inOut" }, S + 0.35);
    tl.fromTo(`${p} .card-gloss`, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, S + 0.7);
    tl.fromTo(`${p} .card-in`, { scale: 1 }, { scale: 1.035, duration: T, ease: "none" }, S);
  }

  // ------------------------------------------------------------------ HUD data
  // Each scene's counter applies at its start, unless the scene scheduled its own change.
  for (const seg of D.segs) {
    const own = counterEvents.some((e) => !e.auto && e.t >= seg.start - 0.01 && e.t < seg.start + seg.dur);
    if (seg.counter && !own) counterEvents.push({ t: seg.start, label: seg.counter[0], value: seg.counter[1], dur: 1.2, auto: true });
  }
  counterEvents.sort((a, b) => a.t - b.t);
  // The opening counts up from nothing.
  if (counterEvents[0]) counterEvents[0].from = 0;

  // Captions: phrases of up to ~7 words, split at punctuation.
  const phrases = [];
  for (const seg of D.segs) {
    if (!seg.vo) continue;
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      phrases.push({ start: seg.voStart + cur[0].start - 0.08, end: seg.voStart + cur[cur.length - 1].end + 0.35, words: cur.map((w) => ({ text: w.text, t: seg.voStart + w.start })) });
      cur = [];
    };
    seg.vo.words.forEach((w) => {
      cur.push(w);
      if (/[.,:;?!]$/.test(w.text) && cur.length >= 3) flush();
      else if (cur.length >= 8) flush();
    });
    flush();
  }
  for (let i = 0; i < phrases.length - 1; i++) phrases[i].end = Math.min(phrases[i].end, phrases[i + 1].start);

  // Cuts drive the chroma spike, shake and light leaks.
  const cuts = D.cuts;

  // ------------------------------------------------------------------ ticker
  const hudCh = $("#hud-ch"), hudLab = $("#hud-lab"), hudVal = $("#hud-val"), meter = $("#hud-meter");
  const hudLock = $("#hud-meter .lock"), hudShackle = $("#hud-meter .lock .shackle");
  const rMark = $("#ruler-mark"), rProg = $("#ruler-prog");
  const cap = $("#caption");
  const caR = $("#ca-r"), caGB = $("#ca-gb"), content = $("#content"), grain = $("#grain"), flicker = $("#flicker"), leak = $("#leak"), flash = $("#flash");
  const auroras = $$(".aurora i");
  const clips = $$(".clip[data-start]");
  const standalone = !window.__hyperframes;
  let lastCh = null, lastVal = null, lastLab = null, lastPhrase = -1;

  const chapterAt = (t) => {
    let c = D.segs[0];
    for (const s of D.segs) if (t >= s.start) c = s;
    return c;
  };
  const fmtN = (v) => Math.round(v).toLocaleString("en-US");

  function render(t) {
    applyTheme(nightAt(t));

    // chapter line
    const seg = chapterAt(t);
    const chap = D.chapters[seg.ch];
    const chText = chap.roman ? `${chap.roman} · ${chap.word.toUpperCase()}` : chap.word.toUpperCase();
    if (chText !== lastCh) {
      hudCh.textContent = chText;
      lastCh = chText;
    }

    // running index
    let ev = null, prev = null;
    for (const e of counterEvents) if (t >= e.t) { prev = ev; ev = e; }
    if (ev) {
      const p = clamp((t - ev.t) / ev.dur, 0, 1), eased = 1 - Math.pow(1 - p, 3);
      const from = ev.from ?? (prev && prev.label === ev.label ? prev.value : ev.value);
      const v = from + (ev.value - from) * eased;
      const val = fmtN(v);
      if (ev.label !== lastLab) {
        hudLab.textContent = ev.label;
        lastLab = ev.label;
      }
      if (val !== lastVal) {
        hudVal.textContent = val;
        lastVal = val;
      }
    }

    // privacy meter emphasis
    let glow = 0;
    for (const pz of pulses) if (t >= pz.t && t < pz.t + pz.dur) glow = Math.max(glow, Math.sin(((t - pz.t) / pz.dur) * Math.PI));
    meter.style.setProperty("--glow", glow.toFixed(3));
    if (hudLock) {
      const lk = lockAt === null ? 1 : smooth(lockAt - 0.05, lockAt + 0.3, t);
      const shut = lockAt === null ? 1 : smooth(lockAt + 0.18, lockAt + 0.34, t);
      hudLock.style.opacity = lk.toFixed(3);
      hudLock.style.marginRight = ((lk - 1) * 24).toFixed(1) + "px";
      hudLock.style.transform = `scale(${(0.5 + 0.5 * lk).toFixed(3)})`;
      if (hudShackle) hudShackle.setAttribute("transform", `translate(0 ${(-3.2 * (1 - shut)).toFixed(2)})`);
    }

    // ruler
    const x = D.ruler.x0 + (D.ruler.x1 - D.ruler.x0) * clamp(t / D.total, 0, 1);
    rMark.setAttribute("transform", `translate(${x.toFixed(1)} 0)`);
    rProg.setAttribute("x2", x.toFixed(1));

    // captions
    let pi = -1;
    for (let i = 0; i < phrases.length; i++) if (t >= phrases[i].start && t < phrases[i].end) pi = i;
    if (pi !== lastPhrase) {
      cap.innerHTML = pi < 0 ? "" : phrases[pi].words.map((w) => `<span>${w.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join(" ");
      lastPhrase = pi;
    }
    if (pi >= 0) {
      const spans = cap.children, ph = phrases[pi];
      for (let i = 0; i < spans.length; i++) spans[i].style.opacity = t >= ph.words[i].t - 0.04 ? "1" : "0.38";
      const fade = Math.min(smooth(ph.start, ph.start + 0.2, t), 1 - smooth(ph.end - 0.2, ph.end, t));
      cap.style.opacity = fade.toFixed(3);
    } else cap.style.opacity = "0";

    // cut effects
    let spike = 0, sh = 0, lk = 0, lkx = 0, fl = 0, cutT = 0;
    for (const c of cuts) {
      const d = t - c.t;
      if (d < 0 || d > 2.6) continue;
      if (c.kind === "chroma" || c.kind === "whip") {
        const e = Math.exp(-d * 7);
        spike = Math.max(spike, (c.kind === "whip" ? 14 : 8) * e);
        sh = Math.max(sh, 2.2 * Math.exp(-d * 12));
        cutT = c.t;
      } else if (c.kind === "leak" || c.kind === "dawn" || c.kind === "dusk") {
        const env = Math.sin(clamp(d / 2.2, 0, 1) * Math.PI);
        lk = Math.max(lk, env * (c.kind === "leak" ? 0.85 : 0.7));
        lkx = -40 + 100 * clamp(d / 2.2, 0, 1);
        spike = Math.max(spike, 5 * Math.exp(-d * 6));
      } else if (c.kind === "pan") {
        spike = Math.max(spike, 2.5 * Math.exp(-d * 5));
      } else if (c.kind === "cross") {
        fl = Math.max(fl, 0.1 * Math.exp(-d * 4));
      }
    }
    const night = lastNight;
    const dx = (0.32 + 0.06 * night) + spike + Math.sin(t * 1.7) * 0.12;
    caR.setAttribute("dx", dx.toFixed(2));
    caGB.setAttribute("dx", (-dx).toFixed(2));
    caR.setAttribute("dy", (spike * 0.12).toFixed(2));
    const frame = Math.floor(t * 30);
    const jx = (hash(frame + cutT) - 0.5) * 2 * sh, jy = (hash(frame * 1.3 + 9) - 0.5) * 2 * sh;
    content.style.transform = sh > 0.05 ? `translate(${jx.toFixed(1)}px,${jy.toFixed(1)}px)` : "none";
    leak.style.opacity = lk.toFixed(3);
    leak.style.transform = `translateX(${lkx.toFixed(1)}%)`;
    flash.style.opacity = fl.toFixed(3);

    // film texture: grain jitter at 12 fps, a faint projector flicker
    const gf = Math.floor(t * 12);
    grain.style.transform = `translate(${((hash(gf) - 0.5) * 160).toFixed(0)}px,${((hash(gf + 50) - 0.5) * 160).toFixed(0)}px)`;
    flicker.style.opacity = (0.008 + 0.022 * hash(Math.floor(t * 24) + 3) + 0.03 * night).toFixed(3);

    // aurora light drifts slowly; it dims at night
    auroras.forEach((a, i) => {
      const ph = t * (0.05 + i * 0.013) + i * 2.1;
      a.style.transform = `translate(${(Math.sin(ph) * 6).toFixed(2)}vw,${(Math.cos(ph * 0.8) * 5).toFixed(2)}vh) scale(${(1 + Math.sin(ph * 0.6) * 0.06).toFixed(3)})`;
    });

    // Outside HyperFrames (standalone previews), emulate clip visibility.
    if (standalone)
      for (const c of clips) {
        const s = +c.dataset.start, d = +c.dataset.duration;
        c.style.visibility = t >= s && t < s + d ? "visible" : "hidden";
      }
  }

  tl.fromTo("#hud", { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power1.inOut" }, 0.25);
  tl.fromTo("#frame-lines path, #frame-lines rect", { strokeDashoffset: 101 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", stagger: 0.05 }, 0.1);
  tl.to({ v: 0 }, { v: 1, duration: D.total, ease: "none", onUpdate: () => render(tl.time()) }, 0);
  render(0);

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);

  // Standalone previews: ?t=12.5 seeks once fonts are ready (scripts/frame.mjs).
  const q = new URLSearchParams(location.search).get("t");
  window.__seek = (s) => {
    tl.seek(s, false); // run onUpdate callbacks (counters, typing) on the way
    render(s);
  };
  if (standalone && q !== null) document.fonts.ready.then(() => window.__seek(Number(q)));
})();
