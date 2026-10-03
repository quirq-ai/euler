// 07 · Stays on your machine. The privacy plate, full and grand: the machine draws on, its
// blue wall traces all the way round on "stays here", each reader is named as Lily names
// it, and on "nothing, ever, is sent away" the outward arrows reach the wall and are struck,
// the outside world is crossed out, and the gate seals. Then the frame holds still.
//
// The plate is choreographed by meaning, not by pixel: the wall is the chain of accent
// strokes, the strikes are the accent strokes that touch nothing, the gate is the gap the
// chain leaves open, and labels are found by their words. If the plate changes, anything
// not found simply draws on with the rest of the plate.

export default {
  id: "07",
  css: `
#s07 .cam { position: absolute; inset: 0; transform-origin: 1240px 520px; }
#s07 .plate-wrap { position: absolute; left: 587px; top: 140px; width: 1232px; height: 770px; }
#s07 .cap { width: 500px; }
#s07 .cap-top { position: relative; }
#s07 .s07-zero { position: absolute; left: 0; top: 0; font: 400 150px/0.86 "Instrument Serif", serif; letter-spacing: -0.01em; color: var(--link); text-shadow: 0 0 26px color-mix(in oklab, var(--link) 30%, transparent); opacity: 0; }
`,
  html(ctx) {
    const cap = ctx
      .cap("s07c", { big: "0", unit: "BYTES SENT", title: "Private by design", line: "Secrets are never read. Only this machine is served." })
      .replace("read. Only", "read.<br>Only")
      .replace('<span class="cap-big" id="s07c-big"', '<span class="cap-big" id="s07c-big" data-layout-allow-overlap')
      .replace('<span class="cap-unit"', '<span class="s07-zero" id="s07-zero" aria-hidden="true" data-layout-allow-overlap>0</span><span class="cap-unit"');
    return `${ctx.fig(4, "PRIVATE BY DESIGN")}
<div class="cam" id="s07-cam"><div class="plate-wrap" id="s07-plate">${ctx.plate("privacy")}</div></div>
${cap}`;
  },
  motion(tl, S, T, k, seg, el) {
    const NS = "http://www.w3.org/2000/svg";
    const SH = "path,line,circle,ellipse,rect,polyline,polygon";
    const $ = (s) => el.querySelector(s);
    const W = (w, n) => k.word(seg, w, n);
    const tStay = W("stays"), tNo = W("nothing"), tEver = W("ever"), tSent = W("sent");
    const tSeal = W("away") + 0.1;

    // Camera: one slow push toward the machine, from inside the frame, that stops dead on
    // the seal. Nothing moves after it.
    tl.fromTo($("#s07-cam"), { scale: 0.972, y: 8 }, { scale: 1.014, y: 0, duration: tSeal + 0.3 - S, ease: "power1.inOut" }, S);

    // Caption block: the 0 lands on "stays"; on "sent" it turns link blue with the meter.
    k.capBlock("s07c", tStay - 0.35);
    k.pulseMeter(tStay, 2.4);
    k.pulseMeter(tSent, 3.2);
    // A beat after the seal stamps, the padlock joins the HUD meter and clicks shut; it stays
    // there for the rest of the film.
    k.lockHud(tSeal + 0.45);
    tl.fromTo("#s07-zero", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, tSent - 0.05);

    const svg = $(".plate-svg");
    if (!svg) return;
    const layer = (c) => svg.querySelector("." + c);
    const con = layer("L-con"), main = layer("L-main"), acc = layer("L-acc"), lbl = layer("L-lbl");
    const COLOR = { "L-con": "var(--con)", "L-main": "var(--ink)", "L-det": "var(--ink2)", "L-acc": "var(--link)", "L-lbl": "var(--ink2)" };
    const bb = (e) => {
      try {
        const b = e.getBBox();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      } catch (_) {
        return null;
      }
    };
    const mk = (tag, attrs, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const a in attrs) e.setAttribute(a, attrs[a]);
      if (parent) parent.appendChild(e);
      return e;
    };
    // Scene-owned groups never carry an L-* class, so k.drawPlate leaves them alone.
    const group = (cls) => mk("g", { class: cls }, svg);
    const adopt = (e, into, color) => {
      const from = e.parentNode;
      for (const a of ["stroke-width", "stroke-linecap", "stroke-linejoin", "stroke"]) if (from.hasAttribute && from.hasAttribute(a) && !e.hasAttribute(a)) e.setAttribute(a, from.getAttribute(a));
      const cls = ((from.getAttribute && from.getAttribute("class")) || "").split(" ").find((c) => COLOR[c]);
      e.style.color = color || COLOR[cls] || "";
      into.appendChild(e);
      return e;
    };
    const texts = lbl ? Array.from(lbl.querySelectorAll("text")) : [];
    const find = (re) => texts.filter((t) => re.test(t.textContent.trim()));

    // The plate's corner crosshairs sit under the HUD; the film frame has its own marks.
    if (con)
      Array.from(con.querySelectorAll(SH)).forEach((e) => {
        const b = bb(e);
        if (b && (b.x + b.w < 90 || b.x > 1510) && (b.y + b.h < 90 || b.y > 910)) e.remove();
      });

    // Accent strokes: the wall is a chain; the strikes are strokes whose ends touch nothing.
    // The plate's own data-part hooks (wall, strike, attempt) win when present.
    const part = (name) => Array.from(svg.querySelectorAll('[data-part="' + name + '"]'));
    const ends = (e) => {
      if (e.tagName === "line") return [[+e.getAttribute("x1"), +e.getAttribute("y1")], [+e.getAttribute("x2"), +e.getAttribute("y2")]];
      try {
        const L = e.getTotalLength(), a = e.getPointAtLength(0), b = e.getPointAtLength(L);
        return [[a.x, a.y], [b.x, b.y]];
      } catch (_) {
        return null;
      }
    };
    const info = acc ? Array.from(acc.querySelectorAll("path,line")).map((e) => ({ e, p: ends(e), b: bb(e) })) : [];
    const near = (a, b) => Math.abs(a[0] - b[0]) < 1.5 && Math.abs(a[1] - b[1]) < 1.5;
    const linked = (o, pt) => info.some((q) => q !== o && q.p && (near(q.p[0], pt) || near(q.p[1], pt)));
    const tagged = part("strike");
    const free = tagged.length ? info.filter((o) => o.b && tagged.includes(o.e)) : info.filter((o) => o.p && o.b && !linked(o, o.p[0]) && !linked(o, o.p[1]));
    const jambs = [];
    info.filter((o) => o.p && !free.includes(o)).forEach((o) => o.p.forEach((pt) => { if (!linked(o, pt)) jambs.push(pt); }));
    const xs = [];
    free.forEach((o) => {
      const c = [o.b.x + o.b.w / 2, o.b.y + o.b.h / 2];
      let x = xs.find((q) => Math.abs(q.c[0] - c[0]) < 8 && Math.abs(q.c[1] - c[1]) < 8);
      if (!x) xs.push((x = { c, b: o.b, els: [] }));
      x.els.push(o.e);
    });
    xs.sort((a, b) => a.c[1] - b.c[1]);

    const gOut = group("s07-out"), gAcc = group("s07-acc"), gKey = group("s07-key");
    const mainEls = main ? Array.from(main.querySelectorAll(SH)) : [];
    const attempts = part("attempt");
    xs.forEach((x) => {
      x.els.forEach((e) => adopt(e, gAcc));
      // The outward arrow is the flat main stroke running into the strike.
      const xb = x.b;
      const hits = (e) => {
        const b = bb(e);
        return b && b.h < xb.h * 0.7 && b.w > xb.w && b.x < xb.x + xb.w + 4 && b.x + b.w > xb.x - 4 && b.y < xb.y + xb.h + 4 && b.y + b.h > xb.y - 4;
      };
      const arrow = attempts.find(hits) || mainEls.find(hits);
      if (arrow) {
        const ab = bb(arrow);
        x.arrow = adopt(arrow, gOut);
        // Chrome dashes each subpath on its own, so the head would arrive before the shaft:
        // split the head off and land it when the shaft reaches the wall.
        const subs = (arrow.getAttribute("d") || "").match(/[Mm][^Mm]*/g) || [];
        if (subs.length > 1) {
          arrow.setAttribute("d", subs[0]);
          x.head = subs.slice(1).map((d) => {
            const h = arrow.cloneNode(false);
            h.setAttribute("d", d);
            gOut.appendChild(h);
            return h;
          });
        }
        x.lab = texts.find((t) => {
          const tx = +t.getAttribute("x"), ty = +t.getAttribute("y");
          return tx > ab.x - 30 && tx < ab.x + ab.w + 30 && ty > ab.y - 40 && ty < ab.y + ab.h + 12;
        });
        if (x.lab) adopt(x.lab, gKey);
      }
    });

    // Labels that land on their words.
    const readers = [[/^index\.json$/i, "index"], [/^search$/i, "search"], [/^innerpedia$/i, "page"]];
    readers.forEach(([re, w]) => {
      const t = find(re)[0];
      if (t) k.rise(adopt(t, gKey, "var(--ink)"), W(w) - 0.08, { y: 10, dur: 0.55 });
    });
    const here = find(/^this machine$/i)[0];
    if (here) k.rise(adopt(here, gKey, "var(--ink)"), W("machine") - 0.1, { y: 10, dur: 0.7 });
    const gate = [find(/^127\.0\.0\.1/)[0], find(/only this machine/i)[0], find(/any other host/i)[0]].filter(Boolean).map((t, i) => adopt(t, gKey, i === 0 ? "var(--ink)" : null));

    // The plate draws on; its accent (now only the wall) traces round on "stays here".
    k.drawPlate(svg, S, T, { acc: tStay - 0.3, accSpread: 0.9, lbl: 1.9, mainSpread: 0.2, detSpread: 0.22 });

    // "nothing, ever": each outward arrow reaches the wall and is struck at the moment it lands.
    xs.forEach((x, i) => {
      const t0 = tNo - 0.05 + i * 0.26;
      if (x.arrow) k.draw([x.arrow], t0, 0.42, 0, "power2.in");
      if (x.head) k.draw(x.head, t0 + 0.36, 0.12, 0, "power1.out");
      if (x.lab) k.fade(x.lab, t0, 0.3);
      k.draw(x.els, t0 + 0.4, 0.22, 0.12, "expo.out");
    });

    // ... and the outside world is crossed out, one name at a time.
    find(/^(the cloud|telemetry|third parties)$/i).forEach((t, i) => {
      const fs = +t.getAttribute("font-size") || 22, ls = +t.getAttribute("letter-spacing") || 0, n = t.textContent.trim().length;
      const w = n * (0.6 * fs + ls) - ls, anchor = t.getAttribute("text-anchor") || "start", x0 = +t.getAttribute("x");
      const left = anchor === "middle" ? x0 - w / 2 : anchor === "end" ? x0 - w : x0;
      const y = +t.getAttribute("y") - fs * 0.36;
      const s = mk("line", { x1: left - 10, y1: y, x2: left + w + 10, y2: y, pathLength: 100, "stroke-width": 2.6, "stroke-linecap": "round" }, gAcc);
      s.style.color = "var(--link)";
      k.draw([s], tEver + 0.1 + i * 0.2, 0.45, 0, "power2.inOut");
    });

    // "sent away": the gate seals. The address of the only door is written under it, two
    // bolts close the gap the wall left open, and a ruled seal with a closed padlock stamps
    // down over the gate. Then nothing moves.
    if (gate.length) k.rise(gate, tSent - 0.2, { y: 10, dur: 0.55, stagger: 0.1 });
    if (jambs.length === 2) {
      const [a, b] = jambs[0][0] <= jambs[1][0] ? jambs : [jambs[1], jambs[0]];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], gap = Math.max(20, Math.hypot(b[0] - a[0], b[1] - a[1]));
      const sw = (acc && acc.getAttribute("stroke-width")) || 3.4;
      const bolts = [a, b].map((p) => mk("path", { d: `M${p[0]},${p[1]}L${m[0]},${m[1]}`, pathLength: 100, "stroke-width": sw, "stroke-linecap": "round" }, gAcc));
      bolts.forEach((e) => (e.style.color = "var(--link)"));
      k.draw(bolts, tSeal - 0.32, 0.32, 0, "power3.in");
      const [cx, cy] = m, r = Math.max(36, gap * 0.85);
      const f = (v) => v.toFixed(1);
      const seal = mk("g", { class: "s07-seal" }, gAcc);
      seal.style.color = "var(--link)";
      const disc = mk("circle", { cx, cy, r: f(r + 22), stroke: "none" }, seal);
      disc.style.fill = "var(--bg)";
      mk("circle", { cx, cy, r: f(r), "stroke-width": 2.6, pathLength: 100 }, seal);
      mk("circle", { cx, cy, r: f(r + 9), "stroke-width": 1.2, pathLength: 100 }, seal);
      let ticks = "";
      for (let i = 0; i < 60; i++) {
        const q = (i / 60) * Math.PI * 2, c1 = Math.cos(q), s1 = Math.sin(q);
        ticks += `M${f(cx + c1 * (r + 2.5))},${f(cy + s1 * (r + 2.5))}L${f(cx + c1 * (r + 6.5))},${f(cy + s1 * (r + 6.5))}`;
      }
      mk("path", { d: ticks, "stroke-width": 1, pathLength: 100 }, seal);
      // the closed padlock, drawn in the seal's own line
      const bw = r * 0.78, bh = r * 0.6, by = cy - r * 0.12;
      mk("path", { d: `M${f(cx - bw * 0.3)},${f(by)}V${f(by - r * 0.2)}A${f(bw * 0.3)} ${f(bw * 0.3)} 0 0 1 ${f(cx + bw * 0.3)},${f(by - r * 0.2)}V${f(by)}`, "stroke-width": 2.6, pathLength: 100 }, seal);
      mk("rect", { x: f(cx - bw / 2), y: f(by), width: f(bw), height: f(bh), rx: f(r * 0.08), "stroke-width": 2.6, pathLength: 100 }, seal);
      mk("path", { d: `M${f(cx)},${f(by + bh * 0.32)}V${f(by + bh * 0.68)}`, "stroke-width": 2.6, pathLength: 100 }, seal);
      tl.fromTo(seal, { opacity: 0, scale: 1.4, rotation: -14, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, rotation: 0, duration: 0.42, ease: "power4.out" }, tSeal);
    }
  },
  sfx(ctx) {
    // A soft tick as each strike lands, the stamp of the seal on the gate, and the HUD
    // padlock clicking shut a beat later (times mirror motion: tSeal = "away" + 0.1, and the
    // HUD shackle drops at lockHud + 0.18 to + 0.34).
    const no = ctx.word("nothing"), seal = ctx.word("away") + 0.1;
    return [
      ...[0, 1, 2].map((i) => ({ name: "tick", at: no - 0.05 + i * 0.26 + 0.4, vol: 0.2 })),
      { name: "seal", at: seal + 0.06, vol: 0.4 },
      { name: "lock", at: seal + 0.45 + 0.2, vol: 0.45 },
    ];
  },
};
