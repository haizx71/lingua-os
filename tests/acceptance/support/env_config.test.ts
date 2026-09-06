import { describe, it, expect } from 'vitest';
import { validateFrllEnvironment, FRLL_REQUIRED_ENV_VARS } from './env_config';

describe('FRLL Environment Configuration & Safety Preflight', () => {
  const preferredEnv: Record<string, string> = {
    DATABASE_URL: 'postgresql://postgres:secretpassword@db.dev.supabase.co:5432/postgres',
    SUPABASE_URL: 'https://project-ref.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-key-token',
    SUPABASE_SECRET_KEY: 'super-secret-sb-key-12345',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'publishable-key-token',
    NEXT_PUBLIC_API_BASE_URL: '/api',
    REVIEW_CURSOR_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  const legacyEnv: Record<string, string> = {
    DATABASE_URL: 'postgresql://postgres:secretpassword@db.dev.supabase.co:5432/postgres',
    SUPABASE_URL: 'https://project-ref.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key-token',
    SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-token',
    NEXT_PUBLIC_API_BASE_URL: '/api',
    REVIEW_CURSOR_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  it('validates a complete development environment using preferred modern keys', () => {
    const result = validateFrllEnvironment(preferredEnv);
    expect(result.ok).toBe(true);
    expect(result.missingVars).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.safeConfig).toBeDefined();
    expect(result.safeConfig?.supabaseUrl).toBe('https://project-ref.supabase.co');
    expect(result.safeConfig?.apiBaseUrl).toBe('/api');
    expect(result.safeConfig?.databaseHost).toBe('db.dev.supabase.co');
    expect(result.safeConfig?.hasSecretKey).toBe(true);
    expect(result.safeConfig?.hasPublishableKey).toBe(true);
    expect(result.safeConfig?.hasServiceRoleKey).toBe(true);
    expect(result.safeConfig?.hasAnonKey).toBe(true);

    // Verify no secret leakage into safeConfig
    const configStr = JSON.stringify(result.safeConfig);
    expect(configStr).not.toContain('super-secret-sb-key-12345');
    expect(configStr).not.toContain('secretpassword');
  });

  it('validates a complete development environment using legacy aliases for backward compatibility', () => {
    const result = validateFrllEnvironment(legacyEnv);
    expect(result.ok).toBe(true);
    expect(result.missingVars).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.safeConfig).toBeDefined();
    expect(result.safeConfig?.hasSecretKey).toBe(true);
    expect(result.safeConfig?.hasPublishableKey).toBe(true);
    expect(result.safeConfig?.hasServiceRoleKey).toBe(true);
    expect(result.safeConfig?.hasAnonKey).toBe(true);
  });

  it('fails clearly and enumerates missing required variables without leaking any existing secrets', () => {
    const emptyResult = validateFrllEnvironment({});
    expect(emptyResult.ok).toBe(false);
    expect(emptyResult.missingVars).toEqual(FRLL_REQUIRED_ENV_VARS);
    expect(emptyResult.errors[0]).toContain('Missing required environment variables');

    // Partial env test
    const partialEnv = {
      DATABASE_URL: 'postgresql://user:pass@host:5432/db',
      SUPABASE_SECRET_KEY: 'secret-key-123',
    };
    const partialResult = validateFrllEnvironment(partialEnv);
    expect(partialResult.ok).toBe(false);
    expect(partialResult.missingVars).toContain('SUPABASE_URL');
    expect(partialResult.missingVars).toContain('REVIEW_CURSOR_SECRET');

    // Asserts secret values are NOT printed in errors
    for (const error of partialResult.errors) {
      expect(error).not.toContain('secret-key-123');
      expect(error).not.toContain('pass');
    }
  });

  it('fails closed when secret key is missing', () => {
    const noSecretEnv = { ...preferredEnv };
    delete (noSecretEnv as Record<string, string | undefined>).SUPABASE_SECRET_KEY;
    delete (noSecretEnv as Record<string, string | undefined>).SUPABASE_SERVICE_ROLE_KEY;

    const result = validateFrllEnvironment(noSecretEnv);
    expect(result.ok).toBe(false);
    expect(result.missingVars).toContain('SUPABASE_SECRET_KEY');
    expect(result.safeConfig).toBeUndefined();
  });

  it('fails closed when publishable key is missing', () => {
    const noPubEnv = { ...preferredEnv };
    delete (noPubEnv as Record<string, string | undefined>).SUPABASE_PUBLISHABLE_KEY;
    delete (noPubEnv as Record<string, string | undefined>).SUPABASE_ANON_KEY;

    const result = validateFrllEnvironment(noPubEnv);
    expect(result.ok).toBe(false);
    expect(result.missingVars).toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(result.safeConfig).toBeUndefined();
  });

  it('rejects mismatch between backend SUPABASE_URL and frontend NEXT_PUBLIC_SUPABASE_URL', () => {
    const mismatchedEnv = {
      ...preferredEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://different-project.supabase.co',
    };
    const result = validateFrllEnvironment(mismatchedEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes('identical project origin'))).toBe(true);
  });

  it('rejects invalid NEXT_PUBLIC_API_BASE_URL that is not same-origin /api', () => {
    const invalidApiEnv = {
      ...preferredEnv,
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
    };
    const result = validateFrllEnvironment(invalidApiEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes("must be set to '/api'"))).toBe(true);
  });

  it('fails closed when target environment appears to be production without explicit override', () => {
    const prodEnv = {
      ...preferredEnv,
      SUPABASE_URL: 'https://prod.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://prod.supabase.co',
    };
    const result = validateFrllEnvironment(prodEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes('production project'))).toBe(true);
  });
});
