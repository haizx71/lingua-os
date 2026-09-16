/**
 * Safe Supabase public client configuration resolver.
 * Structurally reads ONLY explicitly approved public variables (NEXT_PUBLIC_SUPABASE_*).
 * Never reads server-only secrets (service_role, database credentials, JWT secrets) into client config.
 */

export interface SupabasePublicConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly isConfigured: boolean;
}

const SECURITY_ERROR =
  'SECURITY INVARIANT VIOLATION: Server-only Supabase credentials cannot be exposed to the browser.';

/**
 * Defense-in-depth against accidentally pasting a server secret into a NEXT_PUBLIC variable.
 * Environment-name isolation remains the primary boundary, but this also recognizes modern
 * `sb_secret_*` credentials and legacy JWT service-role keys by decoding their payload.
 */
function assertBrowserSafeKey(key: string): void {
  const normalized = key.trim();
  const lower = normalized.toLowerCase();

  if (
    lower.startsWith('sb_secret_') ||
    lower.includes('service_role') ||
    lower.includes('service-role')
  ) {
    throw new Error(SECURITY_ERROR);
  }

  const segments = normalized.split('.');
  if (segments.length !== 3) return;

  try {
    const payloadSegment = segments[1];
    if (!payloadSegment) return;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
    if (payload.role === 'service_role') {
      throw new Error(SECURITY_ERROR);
    }
  } catch (error) {
    if (error instanceof Error && error.message === SECURITY_ERROR) throw error;
    // A publishable value does not need to be a JWT. Malformed/non-JWT values are
    // validated by Supabase itself; only positively identified secrets are rejected here.
  }
}

/**
 * Reads public browser-safe Supabase configuration from environment.
 * Structurally reads ONLY `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
 * Returns isConfigured: false if either required variable is missing or empty.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (supabaseAnonKey) {
    assertBrowserSafeKey(supabaseAnonKey);
  }

  const isConfigured = Boolean(supabaseUrl.trim() && supabaseAnonKey.trim());

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
    isConfigured,
  };
}
