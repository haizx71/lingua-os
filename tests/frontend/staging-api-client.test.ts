import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('hosted API client configuration', () => {
  it('fails closed instead of selecting mocks when production API or Supabase config is missing', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
    const { ApiConfigurationError, getApiClient } = await import('../../apps/web/src/lib/api/client');

    expect(() => getApiClient()).toThrow(ApiConfigurationError);
    expect(() => getApiClient()).toThrow('Live API configuration is incomplete');
  });

  it('fails closed when production has an API base but no browser Supabase configuration', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const { ApiConfigurationError, getApiClient } = await import('../../apps/web/src/lib/api/client');

    expect(() => getApiClient()).toThrow(ApiConfigurationError);
  });

  it('fails closed when hosted configuration would bypass the same-origin proxy', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.internal.example.test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
    const { ApiConfigurationError, getApiClient } = await import('../../apps/web/src/lib/api/client');

    expect(() => getApiClient()).toThrow(ApiConfigurationError);
  });

  it('fails closed in staging instead of selecting the deterministic mock', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const { ApiConfigurationError, getApiClient } = await import('../../apps/web/src/lib/api/client');

    expect(() => getApiClient()).toThrow(ApiConfigurationError);
  });

  it('selects the real HTTP client when hosted configuration is complete', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
    const { getApiClient } = await import('../../apps/web/src/lib/api/client');

    expect(getApiClient().transportKind).toBe('http');
  });

  it('keeps development/test mocks available only through the normal non-hosted path or explicit injection', async () => {
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const { MockApiClient, getApiClient, setApiClient } = await import('../../apps/web/src/lib/api/client');

    expect(getApiClient().transportKind).toBe('mock');
    const explicitMock = new MockApiClient();
    setApiClient(explicitMock);
    expect(getApiClient()).toBe(explicitMock);
  });
});
