// Next Link, router navigation and redirect() add basePath themselves. Browser
// fetches, native forms, media and raw Location headers need it explicitly.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function appPath(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return pathname;
  if (BASE_PATH && (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`) || pathname.startsWith(`${BASE_PATH}?`) || pathname.startsWith(`${BASE_PATH}#`))) return pathname;
  return `${BASE_PATH}${pathname}`;
}
