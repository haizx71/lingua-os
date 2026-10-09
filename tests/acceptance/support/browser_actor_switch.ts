import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { DisposableSupabaseUser } from './supabase_users';

/** Accepts a browser token only after Auth independently verified the exact actor. */
export function verifiedK2BrowserActorToken(proof: unknown, expectedUserId: string): string | null {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return null;
  const candidate = proof as Record<string, unknown>;
  if (candidate.sessionUserId !== expectedUserId || candidate.verifiedUserId !== expectedUserId ||
      typeof candidate.accessToken !== 'string' || candidate.accessToken.length > 16_384 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate.accessToken)) return null;
  return candidate.accessToken;
}

/** Real SDK sign-in for a same-context identity transition, not a forged event.
 * The production /auth guard intentionally hides login from authenticated A.
 * This test-only page runs the installed SSR SDK: real Auth request, real cookie
 * persistence and the SDK's real BroadcastChannel notification. Product traffic
 * in the original tab continues through the canonical proxy and AuthProvider.
 * No token, cookie or password is returned to the runner or written to disk.
 */
export async function signInSecondBrowserActor(page: Page, actor: DisposableSupabaseUser): Promise<string> {
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const viteRequire = createRequire(require.resolve('vite'));
  const { build } = viteRequire('esbuild') as {
    build(options: object): Promise<{ outputFiles: Array<{ text: string }> }>;
  };
  const sdk = require.resolve('@supabase/ssr', { paths: [resolve('apps/web')] }).replaceAll('\\', '/');
  const bundle = await build({
    stdin: {
      contents: `import { createBrowserClient } from ${JSON.stringify(sdk)};
        window.frllSignIn = async ({url, key, email, password}) => {
          const client = createBrowserClient(url, key, {
            global: { fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(15000)}) }
          });
          const {data, error} = await client.auth.signInWithPassword({email, password});
          if (error || !data.session || !data.user) throw new Error('Real browser actor sign-in failed');
          return data.user.id;
        };`,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, platform: 'browser', format: 'iife',
  });
  const controllerUrl = 'http://127.0.0.1:3005/__frll_auth_controller';
  await page.route(controllerUrl, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>FRLL test-only auth controller</title>',
  }));
  await page.goto(controllerUrl);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Real browser Auth configuration missing');
  return page.evaluate(async input => {
    const controller = window as unknown as {
      frllSignIn(credentials: typeof input): Promise<string>;
    };
    return controller.frllSignIn(input);
  }, { url, key, email: actor.email, password: actor.password });
}

/** K2 runner-only same-context sign-in. Auth identity is checked in-browser;
 * the normal access token returns only in process memory to bind the browser's
 * originating request to this factory actor. It is never logged or persisted. */
export async function signInK2BrowserActor(
  page: Page,
  actor: Readonly<{ id: string; email: string; password: string }>,
  supabaseUrl: string,
  publishableKey: string,
  vercelOrigin: string,
): Promise<string> {
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const viteRequire = createRequire(require.resolve('vite'));
  const { build } = viteRequire('esbuild') as {
    build(options: object): Promise<{ outputFiles: Array<{ text: string }> }>;
  };
  const sdk = require.resolve('@supabase/ssr', { paths: [resolve('apps/web')] }).replaceAll('\\', '/');
  const bundle = await build({
    stdin: {
      contents: `import { createBrowserClient } from ${JSON.stringify(sdk)};
        window.frllK2SignIn = async ({url, key, email, password, expectedUserId}) => {
          try {
            const client = createBrowserClient(url, key, {
              global: { fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(15000)}) }
            });
          const {data, error} = await client.auth.signInWithPassword({email, password});
          if (error || !data.session || !data.user || data.user.id !== expectedUserId) return null;
          const {data: verified, error: verifyError} = await client.auth.getUser(data.session.access_token);
          if (verifyError || !verified.user || verified.user.id !== expectedUserId) return null;
          return {
            sessionUserId: data.user.id,
            verifiedUserId: verified.user.id,
            accessToken: data.session.access_token,
          };
          } catch {
            return false;
          }
        };`,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, platform: 'browser', format: 'iife',
  });
  const origin = new URL(vercelOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== vercelOrigin) {
    throw new Error('K2 hosted acceptance same-context actor origin was invalid.');
  }
  const controllerUrl = new URL('/__k2_auth_controller', origin).href;
  await page.route(controllerUrl, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>K2 test-only Auth controller</title>',
  }));
  await page.goto(controllerUrl);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  let authProof: unknown = null;
  try {
    authProof = await page.evaluate(async input => {
      const controller = window as unknown as {
        frllK2SignIn(credentials: typeof input): Promise<unknown>;
      };
      return controller.frllK2SignIn(input);
    }, {
      url: supabaseUrl,
      key: publishableKey,
      email: actor.email,
      password: actor.password,
      expectedUserId: actor.id,
    });
  } catch {
    throw new Error('K2 hosted acceptance same-context actor sign-in failed; sensitive details were suppressed.');
  }
  const accessToken = verifiedK2BrowserActorToken(authProof, actor.id);
  if (!accessToken) {
    throw new Error('K2 hosted acceptance same-context actor sign-in failed; sensitive details were suppressed.');
  }
  return accessToken;
}

/** Reads only the access token from the same-context Auth session established
 * by the real protected login form. This controller is restricted to a fresh
 * about:blank page and is used only for initial binding, never during an actor
 * switch or while an original page has an in-flight response. */
export async function readInitialK2BrowserActorAccessToken(
  page: Page,
  expectedUserId: string,
  supabaseUrl: string,
  publishableKey: string,
  vercelOrigin: string,
): Promise<string> {
  const origin = new URL(vercelOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== vercelOrigin ||
      page.url() !== 'about:blank') {
    throw new Error('K2 hosted acceptance same-context actor origin was invalid.');
  }
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const viteRequire = createRequire(require.resolve('vite'));
  const { build } = viteRequire('esbuild') as {
    build(options: object): Promise<{ outputFiles: Array<{ text: string }> }>;
  };
  const sdk = require.resolve('@supabase/ssr', { paths: [resolve('apps/web')] }).replaceAll('\\', '/');
  const bundle = await build({
    stdin: {
      contents: `import { createBrowserClient } from ${JSON.stringify(sdk)};
        window.k2ReadActorToken = async ({url, key, expectedUserId}) => {
          try {
            const client = createBrowserClient(url, key, {
              global: { fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(15000)}) }
            });
            const {data, error} = await client.auth.getSession();
            const session = data.session;
            if (error || !session || session.user.id !== expectedUserId) return null;
            const {data: verified, error: verifyError} = await client.auth.getUser(session.access_token);
            if (verifyError || !verified.user || verified.user.id !== expectedUserId) return null;
            return {
              sessionUserId: session.user.id,
              verifiedUserId: verified.user.id,
              accessToken: session.access_token,
            };
          } catch {
            return null;
          }
        };`,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, platform: 'browser', format: 'iife',
  });
  const controllerUrl = new URL('/__k2_auth_controller', origin).href;
  await page.route(controllerUrl, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>K2 test-only Auth session controller</title>',
  }));
  let authProof: unknown = null;
  try {
    await page.goto(controllerUrl, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    authProof = await page.evaluate(async input => {
      const controller = window as unknown as {
        k2ReadActorToken(credentials: typeof input): Promise<unknown>;
      };
      return controller.k2ReadActorToken(input);
    }, { url: supabaseUrl, key: publishableKey, expectedUserId });
  } catch {
    throw new Error('K2 hosted acceptance same-context actor session could not be bound safely.');
  }
  const accessToken = verifiedK2BrowserActorToken(authProof, expectedUserId);
  if (!accessToken) {
    throw new Error('K2 hosted acceptance same-context actor session could not be bound safely.');
  }
  return accessToken;
}
