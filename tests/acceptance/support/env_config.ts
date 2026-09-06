/**
 * Environment configuration and safety preflight for First Real Learning Loop (FRLL).
 * Validates required Supabase, PostgreSQL, and proxy configuration without leaking secrets.
 */

export const FRLL_REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_BASE_URL',
  'REVIEW_CURSOR_SECRET',
] as const;

export type FrllRequiredEnvVar = (typeof FRLL_REQUIRED_ENV_VARS)[number];

export interface SafeFrllConfig {
  readonly supabaseUrl: string;
  readonly apiBaseUrl: string;
  readonly databaseHost: string;
  readonly databasePort: number;
  readonly databaseName: string;
  readonly hasServiceRoleKey: boolean;
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

  for (const varName of FRLL_REQUIRED_ENV_VARS) {
    const value = env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
    }
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
    hasServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasAnonKey: Boolean(env.SUPABASE_ANON_KEY?.trim()),
    hasReviewCursorSecret: Boolean(env.REVIEW_CURSOR_SECRET?.trim()),
  };

  return {
    ok: true,
    missingVars: [],
    errors: [],
    safeConfig,
  };
}
