/**
 * Environment configuration and safety preflight for First Real Learning Loop (FRLL).
 * Validates required Supabase, PostgreSQL, and proxy configuration without leaking secrets.
 */

export const FRLL_PREFERRED_ENV_VARS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_BASE_URL',
  'REVIEW_CURSOR_SECRET',
] as const;

export const FRLL_LEGACY_ENV_VARS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_BASE_URL',
  'REVIEW_CURSOR_SECRET',
] as const;

export const FRLL_REQUIRED_ENV_VARS = FRLL_PREFERRED_ENV_VARS;

export type FrllRequiredEnvVar =
  | (typeof FRLL_PREFERRED_ENV_VARS)[number]
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY';

export interface SafeFrllConfig {
  readonly supabaseUrl: string;
  readonly apiBaseUrl: string;
  readonly databaseHost: string;
  readonly databasePort: number;
  readonly databaseName: string;
  readonly hasSecretKey: boolean;
  readonly hasServiceRoleKey: boolean;
  readonly hasPublishableKey: boolean;
  readonly hasAnonKey: boolean;
  readonly hasReviewCursorSecret: boolean;
}

export interface FrllEnvValidationResult {
  readonly ok: boolean;
  readonly missingVars: readonly FrllRequiredEnvVar[];
  readonly errors: readonly string[];
  readonly safeConfig?: SafeFrllConfig;
}

function parseDatabaseUrl(url: string): { host: string; port: number; name: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      name: parsed.pathname.replace(/^\//, '') || 'postgres',
    };
  } catch {
    return { host: 'unknown', port: 5432, name: 'unknown' };
  }
}

export function validateFrllEnvironment(
  env: Record<string, string | undefined> = process.env
): FrllEnvValidationResult {
  const missingVars: FrllRequiredEnvVar[] = [];
  const errors: string[] = [];

  // 1. DATABASE_URL
  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === '') {
    missingVars.push('DATABASE_URL');
  }

  // 2. SUPABASE_URL
  if (!env.SUPABASE_URL || env.SUPABASE_URL.trim() === '') {
    missingVars.push('SUPABASE_URL');
  }

  // 3. Publishable key: accept SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY
  const hasPublishable = Boolean(
    env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim()
  );
  if (!hasPublishable) {
    missingVars.push('SUPABASE_PUBLISHABLE_KEY');
  }

  // 4. Secret key: accept SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
  const hasSecret = Boolean(
    env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  if (!hasSecret) {
    missingVars.push('SUPABASE_SECRET_KEY');
  }

  // 5. NEXT_PUBLIC_SUPABASE_URL
  if (!env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.trim() === '') {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  // 6. NEXT_PUBLIC_SUPABASE_ANON_KEY (can also accept NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  const hasNextPublicAnon = Boolean(
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  );
  if (!hasNextPublicAnon) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // 7. NEXT_PUBLIC_API_BASE_URL
  if (!env.NEXT_PUBLIC_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL.trim() === '') {
    missingVars.push('NEXT_PUBLIC_API_BASE_URL');
  }

  // 8. REVIEW_CURSOR_SECRET
  if (!env.REVIEW_CURSOR_SECRET || env.REVIEW_CURSOR_SECRET.trim() === '') {
    missingVars.push('REVIEW_CURSOR_SECRET');
  }

  if (missingVars.length > 0) {
    errors.push(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const supabaseUrl = env.SUPABASE_URL?.trim();
  const nextPublicSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (supabaseUrl && nextPublicSupabaseUrl && supabaseUrl !== nextPublicSupabaseUrl) {
    errors.push(
      `SUPABASE_URL (${supabaseUrl}) and NEXT_PUBLIC_SUPABASE_URL (${nextPublicSupabaseUrl}) must point to the identical project origin.`
    );
  }

  const apiBaseUrl = env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBaseUrl && apiBaseUrl !== '/api') {
    errors.push(
      `NEXT_PUBLIC_API_BASE_URL must be set to '/api' for acceptance proxy same-origin bridging (got: '${apiBaseUrl}')`
    );
  }

  // Safety guard: prevent accidental runs against production environments
  const isProduction =
    (supabaseUrl && /prod|production/i.test(supabaseUrl)) ||
    (env.DATABASE_URL && /prod|production/i.test(env.DATABASE_URL));
  if (isProduction && env.FRLL_ALLOW_PROD !== 'true') {
    errors.push(
      'Target environment appears to be a production project. FRLL destructive user test is allowlisted only for disposable development projects.'
    );
  }

  if (errors.length > 0) {
    return {
      ok: false,
      missingVars,
      errors,
    };
  }

  const dbInfo = parseDatabaseUrl(env.DATABASE_URL!);
  const safeConfig: SafeFrllConfig = {
    supabaseUrl: supabaseUrl!,
    apiBaseUrl: apiBaseUrl!,
    databaseHost: dbInfo.host,
    databasePort: dbInfo.port,
    databaseName: dbInfo.name,
    hasSecretKey: hasSecret,
    hasServiceRoleKey: hasSecret,
    hasPublishableKey: hasPublishable,
    hasAnonKey: hasPublishable,
    hasReviewCursorSecret: Boolean(env.REVIEW_CURSOR_SECRET?.trim()),
  };

  return {
    ok: true,
    missingVars: [],
    errors: [],
    safeConfig,
  };
}
