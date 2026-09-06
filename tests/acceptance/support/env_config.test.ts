import { describe, it, expect } from 'vitest';
import { validateFrllEnvironment, FRLL_REQUIRED_ENV_VARS } from './env_config';

describe('FRLL Environment Configuration & Safety Preflight', () => {
  const validEnv: Record<string, string> = {
    DATABASE_URL: 'postgresql://postgres:secretpassword@db.dev.supabase.co:5432/postgres',
    SUPABASE_URL: 'https://project-ref.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key-token',
    SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-token',
    NEXT_PUBLIC_API_BASE_URL: '/api',
    REVIEW_CURSOR_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  it('validates a complete, consistent development environment successfully', () => {
    const result = validateFrllEnvironment(validEnv);
    expect(result.ok).toBe(true);
    expect(result.missingVars).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.safeConfig).toBeDefined();
    expect(result.safeConfig?.supabaseUrl).toBe('https://project-ref.supabase.co');
    expect(result.safeConfig?.apiBaseUrl).toBe('/api');
    expect(result.safeConfig?.databaseHost).toBe('db.dev.supabase.co');
    expect(result.safeConfig?.hasServiceRoleKey).toBe(true);
  });

  it('fails clearly and enumerates missing required variables without leaking any existing secrets', () => {
    const emptyResult = validateFrllEnvironment({});
    expect(emptyResult.ok).toBe(false);
    expect(emptyResult.missingVars).toEqual(FRLL_REQUIRED_ENV_VARS);
    expect(emptyResult.errors[0]).toContain('Missing required environment variables');

    // Partial env test
    const partialEnv = {
      DATABASE_URL: 'postgresql://user:pass@host:5432/db',
      SUPABASE_SERVICE_ROLE_KEY: 'secret-key-123',
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

  it('rejects mismatch between backend SUPABASE_URL and frontend NEXT_PUBLIC_SUPABASE_URL', () => {
    const mismatchedEnv = {
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://different-project.supabase.co',
    };
    const result = validateFrllEnvironment(mismatchedEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes('identical project origin'))).toBe(true);
  });

  it('rejects invalid NEXT_PUBLIC_API_BASE_URL that is not same-origin /api', () => {
    const invalidApiEnv = {
      ...validEnv,
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
    };
    const result = validateFrllEnvironment(invalidApiEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes("must be set to '/api'"))).toBe(true);
  });

  it('fails closed when target environment appears to be production without explicit override', () => {
    const prodEnv = {
      ...validEnv,
      SUPABASE_URL: 'https://prod.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://prod.supabase.co',
    };
    const result = validateFrllEnvironment(prodEnv);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes('production project'))).toBe(true);
  });
});
