// Formatting helpers shared by server and client components.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2 October 2026", the way an encyclopedia writes dates. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "March 2026" */
export function monthYear(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Mar" for "2026-03" */
export function shortMonth(key: string): string {
  return MONTHS[Number(key.slice(5, 7)) - 1]?.slice(0, 3) ?? key;
}

/** "3 days ago", "just now", "in 2 hours" */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.round((now - Date.parse(iso)) / 1000);
  const abs = Math.abs(s);
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let v = abs;
  let unit = "second";
  for (const [step, name] of units) {
    unit = name;
    if (v < step) break;
    v /= step;
  }
  const n = Math.floor(v);
  if (unit === "second" && n < 45) return "just now";
  const phrase = `${n} ${unit}${n === 1 ? "" : "s"}`;
  return s >= 0 ? `${phrase} ago` : `in ${phrase}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export function num(n: number): string {
  return n.toLocaleString("en-US");
}
