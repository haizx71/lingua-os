export const K2_VERCEL_TRUSTED_SOURCE_HEADER = 'x-vercel-trusted-oidc-idp-token';

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
