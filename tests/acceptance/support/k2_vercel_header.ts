import { Buffer } from 'node:buffer';

export const K2_VERCEL_TRUSTED_SOURCE_HEADER = 'x-vercel-trusted-oidc-idp-token';
const K2_TRUSTED_SOURCE_REFRESH_MARGIN_MS = 30_000;

export type K2TrustedSourceTokenSupplier = () => Promise<string>;

function tokenExpirationMs(token: string): number {
  if (typeof token !== 'string') {
    throw new Error('K2 hosted acceptance trusted-source token expiry was invalid.');
  }
  const parts = token.split('.');
  if (token.length > 16_384 || parts.length !== 3 ||
      parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error('K2 hosted acceptance trusted-source token expiry was invalid.');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new Error('K2 hosted acceptance trusted-source token expiry was invalid.');
  }
  const expiresAtMs = payload && typeof payload === 'object' && !Array.isArray(payload) &&
    'exp' in payload && typeof payload.exp === 'number'
    ? payload.exp * 1000
    : Number.NaN;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !('exp' in payload) || typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) || payload.exp <= 0 ||
      !Number.isFinite(expiresAtMs) || expiresAtMs > Number.MAX_SAFE_INTEGER) {
    throw new Error('K2 hosted acceptance trusted-source token expiry was invalid.');
  }
  return expiresAtMs;
}

/** Refreshes an in-memory Trusted Sources token from its JWT expiry, without trusting claims for auth. */
export function createK2TrustedSourceTokenSupplier(
  initialToken: string,
  refreshToken: K2TrustedSourceTokenSupplier,
  now: () => number = Date.now,
): K2TrustedSourceTokenSupplier {
  let currentToken = initialToken;
  let expiresAtMs = tokenExpirationMs(initialToken);
  let refreshInFlight: Promise<string> | undefined;

  return async () => {
    const currentTime = now();
    if (!Number.isSafeInteger(currentTime) || currentTime < 0) {
      throw new Error('K2 hosted acceptance trusted-source token clock was invalid.');
    }
    if (expiresAtMs > currentTime + K2_TRUSTED_SOURCE_REFRESH_MARGIN_MS) {
      return currentToken;
    }

    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        let replacement: string;
        try {
          replacement = await refreshToken();
        } catch {
          throw new Error('K2 hosted acceptance trusted-source token refresh failed.');
        }
        const replacementExpiry = tokenExpirationMs(replacement);
        const refreshedAt = now();
        if (!Number.isSafeInteger(refreshedAt) || refreshedAt < 0 ||
            replacementExpiry <= refreshedAt + K2_TRUSTED_SOURCE_REFRESH_MARGIN_MS) {
          throw new Error('K2 hosted acceptance trusted-source token refresh was too close to expiry.');
        }
        currentToken = replacement;
        expiresAtMs = replacementExpiry;
        return currentToken;
      })();
    }

    const pendingRefresh = refreshInFlight;
    try {
      return await pendingRefresh;
    } finally {
      if (refreshInFlight === pendingRefresh) refreshInFlight = undefined;
    }
  };
}

/** Adds the short-lived OIDC token only to the exact, previously attested origin. */
export function headersForK2ProtectedOrigin(
  requestUrl: string,
  requestHeaders: Record<string, string>,
  attestedOrigin: string,
  token: string,
): Record<string, string> {
  const headers = { ...requestHeaders };
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === K2_VERCEL_TRUSTED_SOURCE_HEADER) delete headers[key];
  }
  let sameOrigin = false;
  try { sameOrigin = new URL(requestUrl).origin === new URL(attestedOrigin).origin; }
  catch { throw new Error('K2 hosted acceptance refused an invalid protected request origin.'); }
  if (sameOrigin) headers[K2_VERCEL_TRUSTED_SOURCE_HEADER] = token;
  return headers;
}
