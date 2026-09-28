import type { BrowserContext, Route } from '@playwright/test';
import type { K2HostedConfig } from './k2_hosted_actors';
import { headersForK2ProtectedOrigin } from './k2_vercel_header';

/**
 * Browser traffic is restricted to the attested Vercel deployment and this
 * staging project's Auth API. The bearer used by the acceptance flow is sent
 * directly to the exact Render origin from Node, never through browser routes.
 */
export async function handleK2BrowserRoute(
  route: Route,
  config: Pick<K2HostedConfig, 'supabaseUrl'> & { readonly vercelOrigin: string },
  trustedSourceToken: string,
): Promise<void> {
  let requestUrl: URL;
  try { requestUrl = new URL(route.request().url()); }
  catch { await route.abort(); return; }

  if (requestUrl.origin === config.vercelOrigin) {
    if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
      await route.abort();
      return;
    }
    const headers = headersForK2ProtectedOrigin(
      requestUrl.href,
      route.request().headers(),
      config.vercelOrigin,
      trustedSourceToken,
    );
    await fulfillWithoutRedirect(route, headers);
    return;
  }

  if (requestUrl.origin === config.supabaseUrl && requestUrl.pathname.startsWith('/auth/v1/')) {
    const headers = headersForK2ProtectedOrigin(
      requestUrl.href,
      route.request().headers(),
      config.vercelOrigin,
      trustedSourceToken,
    );
    await fulfillWithoutRedirect(route, headers);
    return;
  }

  // This also stops cross-origin redirects from forwarding Vercel's OIDC header.
  await route.abort();
}

async function fulfillWithoutRedirect(route: Route, headers: Record<string, string>): Promise<void> {
  try {
    const response = await route.fetch({ headers, maxRedirects: 0 });
    if (response.status() >= 300 && response.status() < 400) {
      await response.dispose();
      await route.abort();
      return;
    }
    await route.fulfill({ response });
  } catch {
    // Never expose provider transport details or follow a redirect carrying
    // the in-memory Trusted Sources token or Auth request credentials.
    await route.abort();
  }
}

export function installK2BrowserRequestGuard(
  context: BrowserContext,
  config: Pick<K2HostedConfig, 'supabaseUrl'> & { readonly vercelOrigin: string },
  trustedSourceToken: string,
): Promise<void> {
  return context.route('**/*', route => handleK2BrowserRoute(route, config, trustedSourceToken));
}
