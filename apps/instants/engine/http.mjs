/** Next dev can reconstruct request.url with its bind host. The browser's Host
 * header is the authority it actually addressed; never use forwarded-host. */
export function hasSameOrigin(requestUrl, origin, host) {
  if (!origin || !host || /[\s\\/@?#]/.test(host)) return false;
  try {
    const request = new URL(requestUrl);
    const source = new URL(origin);
    if (!["http:", "https:"].includes(request.protocol)) return false;
    const destination = new URL(`${request.protocol}//${host}`);
    return source.origin === origin && origin === destination.origin;
  } catch {
    return false;
  }
}
