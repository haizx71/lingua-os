import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { DisposableSupabaseUser } from './supabase_users';

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
