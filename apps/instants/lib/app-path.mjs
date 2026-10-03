// Next applies basePath to its own router, but plain fetch, img and anchor URLs
// need the same build-time prefix. External, data and blob URLs stay untouched.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function appPath(value) {
  if (!basePath || !value.startsWith("/") || value.startsWith("//")) return value;
  if (value === basePath || value.startsWith(`${basePath}/`) ||
      value.startsWith(`${basePath}?`) || value.startsWith(`${basePath}#`)) return value;
  return `${basePath}${value}`;
}
