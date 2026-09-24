import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANONICAL_WEB_ORIGIN,
  getCanonicalVercelRedirect,
} from '../../apps/web/src/lib/routing/canonical-host';

describe('canonical Vercel browser origin', () => {
  it('redirects hashed Vercel deployment URLs to the stable public origin', () => {
    const source = new URL(
      'https://lingua-os-8qh2r4ehj-haizx71-6910.vercel.app/auth?next=%2Ftoday',
    );

    const result = getCanonicalVercelRedirect(source, source.host);

    expect(result?.toString()).toBe(
      `${DEFAULT_CANONICAL_WEB_ORIGIN}/auth?next=%2Ftoday`,
    );
  });

  it('does not redirect the canonical public origin', () => {
    const source = new URL(`${DEFAULT_CANONICAL_WEB_ORIGIN}/auth`);

    expect(getCanonicalVercelRedirect(source, source.host)).toBeNull();
  });

  it('does not redirect custom domains', () => {
    const source = new URL('https://learn.example.com/auth');

    expect(getCanonicalVercelRedirect(source, source.host)).toBeNull();
  });

  it('leaves same-origin API proxy traffic untouched', () => {
    const source = new URL(
      'https://lingua-os-8qh2r4ehj-haizx71-6910.vercel.app/api/v1/me',
    );

    expect(getCanonicalVercelRedirect(source, source.host)).toBeNull();
  });

  it('supports a future custom canonical origin without code changes', () => {
    const source = new URL(
      'https://lingua-os-8qh2r4ehj-haizx71-6910.vercel.app/today?from=auth',
    );

    const result = getCanonicalVercelRedirect(
      source,
      source.host,
      'https://learn.lingua.example',
    );

    expect(result?.toString()).toBe(
      'https://learn.lingua.example/today?from=auth',
    );
  });
});
