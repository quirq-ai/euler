// 10 · Namesakes. The names plate: two hundred src folders pour in from a loose scatter and
// settle into their depth bands while the numeral counts to 204 on "four"; on "handled"
// the five qualified names step out of the crowd; on "one tidy page" the blue
// leaders gather them into the disambiguation page, row by row. Then a full second (and
// more) of complete stillness.
//
// Choreographed by meaning, not by pixel: the field is every small "src" label with the
// folder glyph to its left, the page is the largest box on the plate, the numeral and
// the notes are found by their words. Anything not found draws on with the rest.

export default {
  id: "10",
  css: `
#s10 .cam { position: absolute; inset: 0; transform-origin: 1180px 560px; }
#s10 .plate-wrap { position: absolute; left: 300px; top: 136px; width: 1328px; height: 830px; }
`,
  html(ctx) {
    return `${ctx.fig(7, "NAMESAKES")}
<div class="cam" id="s10-cam"><div class="plate-wrap" id="s10-plate">${ctx.plate("names")}</div></div>`;
  },
  motion(tl, S, T, k, seg, el) {
    const NS = "http://www.w3.org/2000/svg";
    const SH = "path,line,circle,ellipse,rect,polyline,polygon";
    const $ = (s) => el.querySelector(s);
    const W = (w, n) => k.word(seg, w, n);
    const tFour = W("four"), tFolders = W("folders"), tOne = W("one"), tTidy = W("tidy"), tPage = W("page");

    // One slow push toward the page that comes fully to rest before the hold. It starts
    // smaller than the layout so nothing ever crosses the FIG line or the caption band.
    tl.fromTo($("#s10-cam"), { scale: 0.965, x: 18 }, { scale: 1, x: 0, duration: 6.0, ease: "sine.inOut" }, S);

    const svg = $(".plate-svg");
    if (!svg) return;
    const layer = (c) => svg.querySelector("." + c);
    const con = layer("L-con"), main = layer("L-main"), det = layer("L-det"), acc = layer("L-acc"), lbl = layer("L-lbl");
    const COLOR = { "L-con": "var(--con)", "L-main": "var(--ink)", "L-det": "var(--ink2)", "L-acc": "var(--link)", "L-lbl": "var(--ink2)" };
    const bb = (e) => {
      try {
        const b = e.getBBox();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      } catch (_) {
        return null;
      }
    };
    const mk = (tag, attrs, parent, before) => {
      const e = document.createElementNS(NS, tag);
      for (const a in attrs) e.setAttribute(a, attrs[a]);
      if (parent) parent.insertBefore(e, before || null);
      return e;
    };
    // Scene-owned groups never carry an L-* class, so k.drawPlate leaves them alone.
    const adopt = (e, into, color) => {
      const from = e.parentNode;
      for (const a of ["stroke-width", "stroke-linecap", "stroke-linejoin", "stroke"]) if (from.hasAttribute && from.hasAttribute(a) && !e.hasAttribute(a)) e.setAttribute(a, from.getAttribute(a));
      const cls = ((from.getAttribute && from.getAttribute("class")) || "").split(" ").find((c) => COLOR[c]);
      e.style.color = color || COLOR[cls] || "";
      into.appendChild(e);
      return e;
    };
    const shapes = (g) => (g ? Array.from(g.querySelectorAll(SH)).map((e) => ({ e, b: bb(e) })).filter((o) => o.b) : []);
    const texts = lbl ? Array.from(lbl.querySelectorAll("text")) : [];
    const find = (re) => texts.filter((t) => re.test(t.textContent.trim()));

    // The plate's corner crosshairs sit under the FIG line and the HUD; the film frame has its own.
    shapes(con).forEach((o) => {
      const b = o.b;
      if ((b.x + b.w < 90 || b.x > 1510) && (b.y + b.h < 90 || b.y > 910)) o.e.remove();
    });

    // The page: the largest box on the plate, with everything that sits inside it.
    const mainS = shapes(main), detS = shapes(det), conS = shapes(con);
    const page = mainS.slice().sort((a, b) => b.b.w * b.b.h - a.b.w * a.b.h)[0];
    const P = page && page.b.w * page.b.h > 40000 ? { x0: page.b.x - 22, y0: page.b.y - 22, x1: page.b.x + page.b.w + 22, y1: page.b.y + page.b.h + 22 } : null;
    const inP = (b) => !!P && b.x >= P.x0 && b.y >= P.y0 && b.x + b.w <= P.x1 && b.y + b.h <= P.y1;
    const tin = (t) => {
      const x = +t.getAttribute("x"), y = +t.getAttribute("y");
      return !!P && x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1;
    };

    // The field: every small label that names a src folder, with the glyphs just left of it.
    const isField = (t) => /^([\w.-]+\/)*src$/.test(t.textContent.trim()) && (+t.getAttribute("font-size") || 99) < 24 && !tin(t);
    const field = texts.filter(isField).map((t) => ({ t, x: +t.getAttribute("x"), y: +t.getAttribute("y"), named: t.textContent.trim() !== "src", parts: [] }));
    [...detS, ...mainS].filter((o) => o.b.w < 34 && o.b.h < 26 && !inP(o.b)).forEach((o) => {
      const cx = o.b.x + o.b.w / 2, cy = o.b.y + o.b.h / 2;
      let best = null, bd = 1e9;
      field.forEach((a) => {
        const dx = a.x - cx, dy = a.y - 5 - cy;
        if (dx < 0 || dx > 40 || Math.abs(dy) > 14) return;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = a;
        }
      });
      if (best) best.parts.push(o.e);
    });
    // The blue terminal dot at the end of each qualified name belongs to that name: it
    // arrives with it (and never sits on the plate as a stray dot before it is drawn).
    const monoEnd = (a) => {
      const t = a.t, fs = +t.getAttribute("font-size") || 19, ls = +t.getAttribute("letter-spacing") || 0;
      return a.x + t.textContent.trim().length * (0.6 * fs + ls);
    };
    shapes(acc).filter((o) => o.e.tagName === "circle" && o.b.w < 16).forEach((o) => {
      const cx = o.b.x + o.b.w / 2, cy = o.b.y + o.b.h / 2;
      const a = field.find((q) => q.named && Math.abs(q.y - 5 - cy) < 12 && cx - monoEnd(q) > -6 && cx - monoEnd(q) < 34);
      if (a) a.parts.push(o.e);
    });
    const gField = mk("g", { class: "s10-field" }, svg, acc);
    field.forEach((a) => {
      a.g = mk("g", {}, gField);
      a.parts.forEach((e) => adopt(e, a.g));
      adopt(a.t, a.g, a.named ? "var(--ink)" : null);
    });

    // The page's parts, the numeral, and the notes that land on their words.
    // The field labels converge on purpose; they cross each other mid-flight.
    for (const t of gField.querySelectorAll("text")) t.setAttribute("data-layout-allow-overlap", "");
    const gPage = mk("g", { class: "s10-page" }, svg);
    const pageMain = mainS.filter((o) => inP(o.b)).map((o) => adopt(o.e, gPage));
    const pageDet = [...detS, ...conS].filter((o) => inP(o.b) && o.e.parentNode !== gPage).map((o) => adopt(o.e, gPage));
    const pageText = texts.filter(tin).map((t) => adopt(t, gPage));
    const gNote = mk("g", { class: "s10-notes", "data-layout-allow-overlap": "" }, svg);
    const big = find(/^204$/)[0], called = find(/^folders called/i)[0], apart = find(/told apart/i)[0];
    if (big) adopt(big, gNote, "var(--ink)");
    for (const t of [big, called, apart]) if (t) t.setAttribute("data-layout-allow-overlap", "");
    if (called) adopt(called, gNote);
    if (apart) adopt(apart, gNote);

    // Everything else (axes, bands, depth counts, leaders) draws on as a plate.
    k.drawPlate(svg, S, T, { acc: tOne - 0.2, accSpread: 0.55, lbl: 0.7, mainSpread: 0.1, detSpread: 0.15 });

    // The crowd pours in from a loose scatter and settles into its depth bands by "four".
    const GOLD = Math.PI * (3 - Math.sqrt(5));
    const fr = (v) => v - Math.floor(v);
    field.filter((a) => !a.named).forEach((a, i) => {
      const h1 = fr(Math.sin(i * 12.9898 + 4.1) * 43758.5453), h2 = fr(Math.sin(i * 78.233 + 1.7) * 24634.6345), h3 = fr(Math.sin(i * 39.425 + 9.3) * 15731.743);
      const ang = i * GOLD, r = 80 + 200 * h1, at = S + 0.06 + h3 * 1.15;
      tl.fromTo(a.g, { x: Math.cos(ang) * r, y: Math.sin(ang) * r * 0.6, scale: 0.55 + 0.9 * h2, transformOrigin: "50% 50%" }, { x: 0, y: 0, scale: 1, duration: 1.5, ease: "power2.out" }, at);
      tl.fromTo(a.g, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none" }, at);
    });
    // "handled": the five qualified names step out of the crowd, with the note on how.
    const tHandled = W("handled");
    field.filter((a) => a.named).sort((p, q) => p.y - q.y).forEach((a, i) => {
      tl.fromTo(a.g, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, tHandled - 0.15 + i * 0.09);
    });

    // The numeral counts the crowd in and lands on "four".
    if (big) {
      k.fade(big, S + 0.2, 0.5);
      k.countUp(big, S + 0.3, tFour + 0.05 - (S + 0.3), 0, 204);
    }
    if (apart) k.rise(apart, tHandled - 0.2, { y: 8, dur: 0.7 });
    if (called) k.rise(called, tFolders - 0.05, { y: 8, dur: 0.6 });

    // "one tidy page": the page draws, its header lands on "one", the list fills on "tidy".
    k.draw(pageMain, tOne - 0.45, 0.7, 0.25, "power2.inOut");
    k.draw(pageDet, tOne - 0.1, 0.5, 0.9, "power1.out");
    const rows = [];
    pageText.slice().sort((a, b) => +a.getAttribute("y") - +b.getAttribute("y")).forEach((t) => {
      const y = +t.getAttribute("y");
      let r = rows.find((q) => Math.abs(q.y - y) < 8);
      if (!r) rows.push((r = { y, els: [] }));
      r.els.push(t);
    });
    rows.forEach((r, i) => {
      const at = i < 2 ? tOne - 0.1 + i * 0.12 : i === rows.length - 1 ? tPage + 0.12 : tTidy - 0.1 + (i - 2) * 0.1;
      k.rise(r.els, at, { y: 8, dur: 0.5 });
    });
  },
  sfx(ctx) {
    const four = ctx.word("four");
    return [
      { name: "tick", at: four - 0.2, vol: 0.22 },
      { name: "tick", at: four - 0.1, vol: 0.24 },
      { name: "tick", at: four, vol: 0.3 },
      { name: "page", at: ctx.word("one") - 0.4, vol: 0.22 },
    ];
  },
};
