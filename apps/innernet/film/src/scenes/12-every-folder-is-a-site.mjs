// 12 · Every folder is a site. Opens the add-site journey: one long clip (s12x, frames 12
// to 15) holds the add-site plate under a camera. The path and its five stations draw on
// left to right; the folder at station 1 engraves itself on "folder"; on "site" the path
// reaches localhost:3470 /wiki/tide-pool, "on this machine alone", and the lock; tide-pool
// gets its first sigil (muted, a plain folder for now). On "care" the camera pushes in
// to station 1. This module's motion drives the camera for the whole journey, arriving at
// each station on the word that names it.

import { CAM_CSS, camStyle, journey, sigilGradient } from "./_addsite.mjs";

export default {
  id: "12",
  css: CAM_CSS("#s12x") + `
#s12x { z-index: 0; }
#s12, #s13, #s14, #s15 { z-index: 1; }
#s12x .pw { position: absolute; left: 0; top: 0; width: 1600px; height: 1000px; }
#s12x .sp-snip, #s12x .sp-chips { opacity: 0; }
/* stations wait, invisible, until the camera reaches them (hidden strokes would show their round caps as dots) */
#s12x :is(.pg-st1, .pg-end, .pg-key, .pg-st2, .pg-st3, .pg-st4, .pg-st5t, .pg-st5a), #s12x :is(.acc, .sp-chiparr) :is(path, line, circle, ellipse, rect, polyline, polygon) { opacity: 0; }
#s12x .sig1 { position: absolute; display: grid; place-items: center; overflow: hidden; box-shadow: 0 0 0 4px var(--bg), 0 6px 14px -6px rgba(28,27,24,.35); }
#s12x .sig1 span { font: 400 26px/1 "Instrument Serif", serif; color: rgba(255,255,255,.95); text-shadow: 0 1px 2px rgba(0,0,0,.18); transform: translateY(4%); }
#s12x .fig .stw { display: inline-flex; gap: 12px; align-items: center; }
#s12x .fig .stn { position: relative; display: inline-block; width: 11px; height: 17px; margin-right: 4px; }
#s12x .fig .stn b { position: absolute; left: 0; top: 0; font-weight: 500; color: var(--ink); }
`,
  html() {
    return "";
  },
  extra(ctx) {
    const { svg, A, cams } = journey(ctx);
    const ids = ["12", "13", "14", "15"];
    const segs = ctx.segs.filter((s) => ids.includes(s.id));
    const start = segs[0].start;
    const dur = +(segs[segs.length - 1].start + segs[segs.length - 1].dur - start).toFixed(3);
    // tide-pool's first sigil: a plain folder, so muted, soft corners; pinned to the folder
    const size = 46, sx = A.crops[2] - size * 0.15, sy = A.crops[1] + size * 0.05;
    const sig = `<div class="sig1" id="s12x-sig" style="left:${sx - size / 2}px;top:${sy - size / 2}px;width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.18)}px;background:${sigilGradient("tide-pool", true)}"><span>T</span></div>`;
    const fig = `<div class="fig" id="s12x-fig"><span>FIG. 8</span><i></i><span>ADD A SITE</span><span class="stw" id="s12x-stw"><i></i><span>STATION</span><span class="stn">${[1, 2, 3, 4, 5].map((n) => `<b>${n}</b>`).join("")}</span><span>OF 5</span></span></div>`;
    return `<div id="s12x" data-layout-allow-overlap class="clip scene" data-start="${start}" data-duration="${dur}" data-track-index="2">
  <div class="vp12"><div class="cam12" id="s12x-cam" style="${camStyle(cams.ov)}" data-cams='${JSON.stringify(cams)}'>
    <div class="pw">${svg}</div>
    ${sig}
  </div></div>
  ${fig}
</div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const X = document.getElementById("s12x");
    if (!X) return;
    const $ = (s) => X.querySelector(s);
    const cams = JSON.parse($("#s12x-cam").dataset.cams);
    const camEls = Array.from(document.querySelectorAll(".cam12"));
    const s13 = k.seg["13"], s14 = k.seg["14"], s15 = k.seg["15"];
    const end = s15.start + s15.dur;
    const FX = 960, FY = 532;
    // a framing, scaled by f about its own centre (for slow drifts)
    const at = (c, f = 1) => ({ x: FX - c.scale * f * c.cx, y: FY - c.scale * f * c.cy, scale: c.scale * f });

    const care = k.word(seg, "care"), folder = k.word(seg, "folder"), site = k.word(seg, "site");
    const readme = k.word(s13, "README");
    const pkg = k.word(s14, "package"), git = k.word(s14, "git");
    const run = k.word(s15, "run"), appears = k.word(s15, "appears"), colours = k.word(s15, "colours");

    // ---- the camera, frames 12 to 15: [time, framing, ease of the move that ends there]
    // open close on the root as the path starts to draw, then pull back to the whole map
    const open = { scale: 1.3, x: FX - 1.3 * 470, y: FY - 1.3 * 480 };
    const keys = [
      [S, open],
      [S + 2.3, at(cams.ov), "power3.inOut"],
      [care - 0.15, at(cams.ov, 1.012), "none"],
      [care + 1.55, at(cams.s1), "power3.inOut"],
      [s13.start - 0.1, at(cams.s1, 1.018), "none"],
      [readme + 0.08, at(cams.s2), "power3.inOut"],
      [s14.start - 0.4, at(cams.s2, 1.014), "none"],
      [pkg + 0.05, at(cams.s3), "power3.inOut"],
      [git - 0.85, at(cams.s3, 1.012), "none"],
      [git + 0.1, at(cams.s4), "power3.inOut"],
      [s15.start - 0.3, at(cams.s4, 1.012), "none"],
      [run + 0.3, at(cams.s5), "power3.inOut"],
      [appears - 0.4, at(cams.s5, 1.012), "none"],
      [appears + 1.05, at(cams.s5b), "power2.inOut"],
      [colours - 0.45, at(cams.s5b, 1.01), "none"],
      [colours + 1.1, at(cams.s5c), "power2.inOut"],
      [end, at(cams.s5c, 1.015), "none"],
    ];
    for (let i = 1; i < keys.length; i++) {
      const [t0, a] = keys[i - 1], [t1, b, ease] = keys[i];
      tl.fromTo(camEls, { ...a }, { ...b, duration: Math.max(0.05, t1 - t0), ease, immediateRender: i === 1 }, t0);
    }

    // ---- the plate: the path first, then station 1, then the end of the line
    const pg = (g) => $(`.pg-${g}`);
    const show = (e, t) => tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, t);
    k.drawPlate(pg("path"), S, 2.6, { acc: S + 0.05, accSpread: 1.9, lbl: 0.3, mainSpread: 0.22, detSpread: 0.3 });
    show(pg("st1"), folder - 0.25);
    k.drawPlate(pg("st1"), folder - 0.25, 2.4, { acc: site - 0.12, accSpread: 0.35, lbl: 0.45 });
    show(pg("end"), site - 0.3);
    k.drawPlate(pg("end"), site - 0.3, 1.6, { lbl: 0.35, mainSpread: 0.2, detSpread: 0.25 });
    k.pulseMeter(site + 0.2, 2.2);
    // the folder's first sigil, pinned on "site"
    tl.fromTo($("#s12x-sig"), { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.65, ease: "back.out(1.8)" }, site + 0.02);

    // ---- FIG line: the station indicator appears with the push-in, then counts stations
    k.rise($("#s12x-stw"), care + 0.9, { y: 6, dur: 0.5 });
    const arrive = [care + 1.0, readme, pkg, git, k.word(s15, "command")];
    const bs = Array.from(X.querySelectorAll(".stn b"));
    bs.forEach((b, i) => {
      tl.fromTo(b, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, arrive[i] - 0.1);
      if (i < 4) tl.fromTo(b, { opacity: 1, y: 0 }, { opacity: 0, y: -10, duration: 0.3, ease: "power2.in", immediateRender: false }, arrive[i + 1] - 0.3);
    });
  },
  sfx(ctx) {
    return [{ name: "lock", at: ctx.word("site") + 0.45, vol: 0.3 }];
  },
};
