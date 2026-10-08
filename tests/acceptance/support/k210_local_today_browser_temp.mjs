import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const apiPort = Number(process.argv[2]);
const actorId = process.argv[3];
const profileId = process.argv[4];
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId ?? '') ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId ?? '')) process.exit(2);

const virtualStubs = {
  name: 'k210-local-today-stubs',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source === 'next/link') return '\0k210-next-link';
    if (source === 'next/navigation') return '\0k210-next-navigation';
    if (source.endsWith('/lib/api/client')) return '\0k210-api-client';
    return null;
  },
  load(id) {
    if (id === '\0k210-next-link') {
      return "import React from 'react'; export default function Link({href, children, ...props}) { return React.createElement('a', {href, ...props}, children); }";
    }
    if (id === '\0k210-next-navigation') return 'export function useRouter() { return { replace() {}, push() {} }; } export function usePathname() { return "/today"; }';
    if (id === '\0k210-api-client') return 'export function getApiClient() { return globalThis.__k2LocalApiClient; }';
    return null;
  },
};

let vite;
let browser;
let stage = 'vite_start';
let safeFailure = 'none';
const apiRouteCounts = { me: 0, languages: 0, today: 0 };
const apiResponseCounts = { ok: 0, error: 0, failed: 0 };
let directRequestCount = 0;
try {
  vite = await createServer({
    configFile: false,
    root,
    define: { __dirname: JSON.stringify(path.join(root, 'tests', 'acceptance', 'support')) },
    logLevel: 'silent',
    plugins: [react(), virtualStubs],
    resolve: {
      alias: {
        '@lingua/types': path.join(root, 'packages', 'types', 'src', 'index.ts'),
        '@lingua/ui': path.join(root, 'packages', 'ui', 'src', 'index.ts'),
        '@': path.join(root, 'apps', 'web', 'src'),
        gsap: path.join(root, 'packages', 'ui', 'node_modules', 'gsap'),
        '@gsap/react': path.join(root, 'packages', 'ui', 'node_modules', '@gsap', 'react'),
      },
    },
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await vite.listen();
  const address = vite.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Loopback Vite server did not bind.');
  const vitePort = address.port;
  const viteOrigin = `http://127.0.0.1:${vitePort}`;
  const localSha = 'a'.repeat(40);
  stage = 'intercept_module';
  const { forwardK2FrllBrowserRequest } = await vite.ssrLoadModule(
    '/tests/acceptance/support/k2_playwright_network.ts',
  );
  const directRequest = async request => {
    directRequestCount += 1;
    const pathname = new URL(request.route, 'http://local.invalid').pathname;
    if (pathname === '/v1/me') apiRouteCounts.me += 1;
    else if (pathname === '/v1/me/languages') apiRouteCounts.languages += 1;
    else if (pathname === '/v1/today') apiRouteCounts.today += 1;
    const upstream = await fetch(new URL(request.route, `http://127.0.0.1:${apiPort}`), {
      method: request.method,
      headers: request.headers,
      ...(request.body ? { body: request.body.toString('utf8') } : {}),
      redirect: 'manual',
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('x-lingua-source-sha', localSha);
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  };
  const sessions = new Map([['valid-token', {
    accessToken: 'valid-token',
    userId: actorId,
    profileId,
  }]]);

  browser = await chromium.launch({ headless: true });
  stage = 'page_route';
  const context = await browser.newContext();
  await context.route('**/*', route => {
    let url;
    try { url = new URL(route.request().url()); } catch { return route.abort(); }
    if (url.origin === viteOrigin && url.pathname.startsWith('/api/v1/')) {
      return forwardK2FrllBrowserRequest(
        route,
        { vercelOrigin: viteOrigin, githubSha: localSha },
        sessions,
        directRequest,
      );
    }
    if (url.protocol === 'http:' && url.hostname === '127.0.0.1' &&
        [apiPort, vitePort].includes(Number(url.port))) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== viteOrigin || !url.pathname.startsWith('/api/v1/')) return;
    if (response.status() >= 200 && response.status() < 300) apiResponseCounts.ok += 1;
    else apiResponseCounts.error += 1;
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.origin === viteOrigin && url.pathname.startsWith('/api/v1/')) apiResponseCounts.failed += 1;
  });
  await page.addInitScript(id => localStorage.setItem('k210-local-actor-id', id), actorId);
  stage = 'page_navigation';
  await page.goto(`${viteOrigin}/tests/backend/database/k210_local_today_fixture_temp.html`, {
    waitUntil: 'domcontentloaded',
  });
  stage = 'today_heading';
  await page.locator('h3', { hasText: 'Ôn tập đến hạn' }).waitFor({ state: 'visible', timeout: 15000 });
  if (await page.locator('h3', { hasText: 'Ôn tập đến hạn' }).count() !== 1) {
    throw new Error('Expected one rendered FRLL Today review activity.');
  }
  stage = 'complete';
  console.log('K2_LOCAL_TODAY_BROWSER_PASS');
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') safeFailure = 'module_resolution';
  else if (code === 'ENOENT') safeFailure = 'module_file_missing';
  else if (/Cannot find package/.test(message)) safeFailure = 'package_missing';
  else if (/Failed to load url/.test(message)) safeFailure = 'module_load';
  else if (/__dirname/.test(message)) safeFailure = 'dirname_unavailable';
  else if (/process is not defined/.test(message)) safeFailure = 'process_unavailable';
  else if (/K2 hosted acceptance/.test(message)) safeFailure = 'k2_guard_rejected';
  else if (error instanceof Error && error.name === 'TimeoutError') safeFailure = 'timeout';
  else safeFailure = 'other';
  console.log(`K2_LOCAL_TODAY_BROWSER_FAIL stage=${stage} class=${safeFailure} direct=${directRequestCount} me=${apiRouteCounts.me} languages=${apiRouteCounts.languages} today=${apiRouteCounts.today} api_ok=${apiResponseCounts.ok} api_error=${apiResponseCounts.error} api_failed=${apiResponseCounts.failed}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (vite) await vite.close().catch(() => undefined);
}
