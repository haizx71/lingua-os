import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { handleK2BrowserRoute } from './support/k2_playwright_network';
import { K2_VERCEL_TRUSTED_SOURCE_HEADER } from './support/k2_vercel_header';

test('Playwright route.fetch stops a real cross-origin redirect before the OIDC header can arrive', async ({ browser }) => {
  test.setTimeout(30_000);
  const token = 'local-integration-token';
  const sourceHeaders: string[] = [];
  const targetHeaders: string[] = [];
  const target = createServer((request, response) => {
    targetHeaders.push(request.headers[K2_VERCEL_TRUSTED_SOURCE_HEADER] ?? '');
    response.writeHead(200, { 'content-type': 'text/html' }).end('<title>target</title>');
  });
  await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
  const targetAddress = target.address();
  if (!targetAddress || typeof targetAddress === 'string') throw new Error('local redirect test setup failed');

  const source = createServer((request, response) => {
    sourceHeaders.push(request.headers[K2_VERCEL_TRUSTED_SOURCE_HEADER] ?? '');
    response.writeHead(302, { location: `http://127.0.0.1:${targetAddress.port}/landing` }).end();
  });
  await new Promise<void>(resolve => source.listen(0, '127.0.0.1', resolve));
  const sourceAddress = source.address();
  if (!sourceAddress || typeof sourceAddress === 'string') throw new Error('local redirect test setup failed');
  const sourceOrigin = `http://127.0.0.1:${sourceAddress.port}`;
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await context.route('**/*', route => handleK2BrowserRoute(route, {
      vercelOrigin: sourceOrigin,
      supabaseUrl: 'https://bdmtdvvnbicgkfririjo.supabase.co',
    }, token));
    const page = await context.newPage();
    try { await page.goto(`${sourceOrigin}/auth`); }
    catch { /* A cross-origin redirect is deliberately aborted. */ }
    expect(sourceHeaders).toEqual([token]);
    expect(targetHeaders).toEqual([]);
  } finally {
    await context.close();
    await new Promise<void>(resolve => source.close(() => resolve()));
    await new Promise<void>(resolve => target.close(() => resolve()));
  }
});
