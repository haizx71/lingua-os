/**
 * Prevent credential-bearing auth surfaces from being served on Vercel's
 * per-deployment hash hostnames. Those URLs are useful for deployment identity
 * but are poor public login origins and can be mistaken for phishing pages.
 */

export const DEFAULT_CANONICAL_WEB_ORIGIN = 'https://lingua-os-web-mocha.vercel.app';

function parseCanonicalOrigin(rawOrigin?: string): URL {
  const fallback = new URL(DEFAULT_CANONICAL_WEB_ORIGIN);
  if (!rawOrigin?.trim()) return fallback;

  try {
    const candidate = new URL(rawOrigin.trim());
    if (!['https:', 'http:'].includes(candidate.protocol)) return fallback;
    if (candidate.username || candidate.password || candidate.search || candidate.hash) return fallback;
    if (candidate.pathname !== '' && candidate.pathname !== '/') return fallback;
    return candidate;
  } catch {
    return fallback;
  }
}

function hostnameFromHeader(rawHost: string | null | undefined, fallback: string): string {
  if (!rawHost?.trim()) return fallback.toLowerCase();

  const firstHost = rawHost.split(',')[0]?.trim() ?? '';
  try {
    return new URL(`https://${firstHost}`).hostname.toLowerCase();
  } catch {
    return fallback.toLowerCase();
  }
}

export function getCanonicalVercelRedirect(
  requestUrl: URL,
  hostHeader?: string | null,
  canonicalOrigin?: string,
): URL | null {
  if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
    return null;
  }

  const incomingHostname = hostnameFromHeader(hostHeader, requestUrl.hostname);
  if (!incomingHostname.endsWith('.vercel.app')) return null;

  const canonical = parseCanonicalOrigin(canonicalOrigin);
  if (incomingHostname === canonical.hostname.toLowerCase()) return null;

  const target = new URL(requestUrl.pathname + requestUrl.search, canonical);
  return target;
}
