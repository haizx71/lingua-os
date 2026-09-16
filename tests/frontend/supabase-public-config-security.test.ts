import { afterEach, describe, expect, it } from 'vitest';

import { getSupabasePublicConfig } from '../../apps/web/src/lib/supabase/config';

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ORIGINAL_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('NEXT_PUBLIC_SUPABASE_URL', ORIGINAL_URL);
  restore('NEXT_PUBLIC_SUPABASE_ANON_KEY', ORIGINAL_ANON_KEY);
  restore('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ORIGINAL_PUBLISHABLE_KEY);
});

describe('Supabase browser credential boundary', () => {
  it('accepts a modern publishable key', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';

    expect(getSupabasePublicConfig()).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'sb_publishable_example',
      isConfigured: true,
    });
  });

  it('rejects a modern secret key accidentally placed in a public variable', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_example';
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => getSupabasePublicConfig()).toThrow(/Server-only Supabase credentials/);
  });

  it('rejects a legacy JWT carrying the service_role claim', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => getSupabasePublicConfig()).toThrow(/Server-only Supabase credentials/);
  });
});
