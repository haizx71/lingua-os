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

/**
 * Defensive check as additional defense-in-depth.
 * Note: Pattern checking does not guarantee detection of arbitrary secret formats;
 * the primary security boundary is strict structural isolation of NEXT_PUBLIC_* variables.
 */
function assertNoServiceRole(key: string): void {
  const prohibitedPatterns = ['service_role', 'service-role', 'serviceRole', 'secret'];
  for (const pattern of prohibitedPatterns) {
    if (key.toLowerCase().includes(pattern.toLowerCase())) {
      throw new Error(
        'SECURITY INVARIANT VIOLATION: Prohibited key pattern detected in public Supabase client configuration.'
      );
    }
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
    assertNoServiceRole(supabaseAnonKey);
  }

  const isConfigured = Boolean(supabaseUrl.trim() && supabaseAnonKey.trim());

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
    isConfigured,
  };
}

