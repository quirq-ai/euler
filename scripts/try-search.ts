// Quick check of the search core from the terminal:
//   pnpm tsx --conditions=react-server scripts/try-search.ts "linear clone"
import { search, suggest } from "../lib/search";

const q = process.argv.slice(2).join(" ") || "linear";
const t = performance.now();
const r = search(q);
console.log(`"${q}": ${r.total} results in ${r.tookMs.toFixed(1)} ms (first call incl. engine build ${(performance.now() - t).toFixed(0)} ms)`);
console.log("counts", r.counts, "best", r.best?.slug, "didYouMean", r.didYouMean);
for (const h of r.hits) console.log(`  ${h.score.toFixed(2).padStart(7)}  ${h.page.slug.padEnd(40)} ${h.snippet.map((s) => (s.hit ? `[${s.text}]` : s.text)).join("").slice(0, 110)}`);
const t2 = performance.now();
r.query && search(q + " x");
console.log(`second search ${(performance.now() - t2).toFixed(1)} ms`);
console.log("suggest", suggest(q.slice(0, 4)).map((s) => s.title));
