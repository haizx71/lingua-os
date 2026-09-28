import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { handleK2BrowserRoute } from './k2_playwright_network';
import { K2_VERCEL_TRUSTED_SOURCE_HEADER } from './k2_vercel_header';

const config = {
  vercelOrigin: 'https://lingua-os-deployment.vercel.app',
  supabaseUrl: 'https://bdmtdvvnbicgkfririjo.supabase.co',
};
const token = 'oidc-token-placeholder';

function fakeRoute(
  url: string,
  headers: Record<string, string> = {},
  response = new Response('ok'),
  fetchImpl?: (options?: { headers?: Record<string, string>; maxRedirects?: number }) => Promise<unknown>,
) {
  const fetchedResponse = {
    status: () => response.status,
    headers: () => Object.fromEntries(response.headers.entries()),
    dispose: vi.fn(async () => undefined),
  };
  const fetchRequest = vi.fn(async (options?: { headers?: Record<string, string>; maxRedirects?: number }) =>
    fetchImpl ? fetchImpl(options) : fetchedResponse);
  const fulfill = vi.fn(async () => undefined);
  const abort = vi.fn(async () => undefined);
  const route = {
    request: () => ({ url: () => url, headers: () => headers }),
    fetch: fetchRequest,
    fulfill,
    abort,
  } as unknown as import('@playwright/test').Route;
  return { route, fetchRequest, fulfill, abort, fetchedResponse };
}

describe('K2 Playwright deployment request guard', () => {
  it('adds the token only to the exact attested deployment origin', async () => {
    const app = fakeRoute(`${config.vercelOrigin}/auth`);
    await handleK2BrowserRoute(app.route, config, token);
    expect(app.fetchRequest.mock.calls[0][0]?.headers?.[K2_VERCEL_TRUSTED_SOURCE_HEADER]).toBe(token);
    expect(app.fetchRequest.mock.calls[0][0]?.maxRedirects).toBe(0);
    expect(app.fulfill).toHaveBeenCalledOnce();

    const auth = fakeRoute(`${config.supabaseUrl}/auth/v1/token`, {
      [K2_VERCEL_TRUSTED_SOURCE_HEADER]: token,
      'content-type': 'application/json',
    });
    await handleK2BrowserRoute(auth.route, config, token);
    expect(auth.fetchRequest.mock.calls[0][0]?.headers?.[K2_VERCEL_TRUSTED_SOURCE_HEADER]).toBeUndefined();
    expect(auth.abort).not.toHaveBeenCalled();
    expect(auth.fulfill).toHaveBeenCalledOnce();
  });

  it('does not follow a real cross-origin redirect or send the OIDC token to its target', async () => {
    const receivedAtSource: string[] = [];
    const receivedAtTarget: string[] = [];
    const target = createServer((request, response) => {
      receivedAtTarget.push(request.headers[K2_VERCEL_TRUSTED_SOURCE_HEADER] ?? '');
      response.writeHead(200).end('target');
    });
    await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
    const targetAddress = target.address();
    if (!targetAddress || typeof targetAddress === 'string') throw new Error('test server unavailable');

    const source = createServer((_request, response) => {
      receivedAtSource.push(_request.headers[K2_VERCEL_TRUSTED_SOURCE_HEADER] ?? '');
      response.writeHead(302, { location: `http://127.0.0.1:${targetAddress.port}/capture` }).end();
    });
    await new Promise<void>(resolve => source.listen(0, '127.0.0.1', resolve));
    const sourceAddress = source.address();
    if (!sourceAddress || typeof sourceAddress === 'string') throw new Error('test server unavailable');
    const sourceOrigin = `http://127.0.0.1:${sourceAddress.port}`;
    try {
      const route = fakeRoute(`${sourceOrigin}/auth`, {}, new Response(null, { status: 302 }), async options => {
        const response = await fetch(`${sourceOrigin}/auth`, {
          headers: options?.headers,
          redirect: 'manual',
        });
        return {
          status: () => response.status,
          headers: () => Object.fromEntries(response.headers.entries()),
          dispose: async () => undefined,
        };
      });
      await handleK2BrowserRoute(route.route, {
        vercelOrigin: sourceOrigin,
        supabaseUrl: 'https://bdmtdvvnbicgkfririjo.supabase.co',
      }, token);
      expect(receivedAtSource).toEqual([token]);
      expect(receivedAtTarget).toEqual([]);
      expect(route.abort).toHaveBeenCalledOnce();
      expect(route.fulfill).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>(resolve => source.close(() => resolve()));
      await new Promise<void>(resolve => target.close(() => resolve()));
    }
  });

  it('blocks frontend proxy requests whose upstream target is not independently attested', async () => {
    const proxy = fakeRoute(`${config.vercelOrigin}/api/v1/me`);
    await handleK2BrowserRoute(proxy.route, config, token);
    expect(proxy.abort).toHaveBeenCalledOnce();
    expect(proxy.fetchRequest).not.toHaveBeenCalled();
  });
});
