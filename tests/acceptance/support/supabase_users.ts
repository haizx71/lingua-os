/**
 * Acceptance test Supabase Auth Admin provisioner for First Real Learning Loop.
 * Strictly uses official Supabase Auth Admin API via createClient(url, secretKey, { auth: ... })
 * to create/delete disposable test users without hardcoded credentials or manual Bearer JWT headers.
 */

import { randomUUID, randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface DisposableSupabaseUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
}

export interface SupabaseAdminConfig {
  readonly supabaseUrl?: string;
  readonly serviceRoleKey?: string;
  readonly secretKey?: string;
  readonly client?: SupabaseClient;
}

function getValidatedAdminConfig(config: SupabaseAdminConfig = {}): {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly serviceRoleKey: string;
  readonly client?: SupabaseClient;
} {
  if (config.client) {
    return {
      supabaseUrl: config.supabaseUrl ?? 'https://provided-client.supabase.co',
      secretKey: 'provided-in-client',
      serviceRoleKey: 'provided-in-client',
      client: config.client,
    };
  }

  const supabaseUrl = config.supabaseUrl ?? process.env.SUPABASE_URL;
  const secretKey =
    config.secretKey ??
    config.serviceRoleKey ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.trim() === '') {
    throw new Error('Supabase admin provisioning failed: SUPABASE_URL is missing or empty.');
  }
  if (!secretKey || secretKey.trim() === '') {
    throw new Error(
      'Supabase admin provisioning failed: SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing or empty.'
    );
  }

  const trimmedKey = secretKey.trim();
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    secretKey: trimmedKey,
    serviceRoleKey: trimmedKey,
  };
}

export function createSupabaseAdminClient(
  supabaseUrl: string,
  secretKey: string
): SupabaseClient {
  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export interface AuthenticatedLearnerSession {
  readonly accessToken: string;
  readonly userId: string;
  readonly email: string;
}

export interface SupabaseLearnerConfig {
  readonly supabaseUrl?: string;
  readonly publishableKey?: string;
  readonly client?: SupabaseClient;
}

export function createSupabaseLearnerClient(
  supabaseUrl: string,
  publishableKey: string
): SupabaseClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Authenticates a disposable learner user via normal Supabase Auth client using publishableKey.
 * Strictly forbidden from using secretKey/admin client for learner auth.
 * Never logs passwords or returned access tokens.
 */
export async function authenticateDisposableLearner(
  credentials: { readonly email: string; readonly password: string },
  config: SupabaseLearnerConfig = {}
): Promise<AuthenticatedLearnerSession> {
  const supabaseUrl =
    config.supabaseUrl ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const publishableKey =
    config.publishableKey ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!config.client) {
    if (!supabaseUrl || supabaseUrl.trim() === '') {
      throw new Error('Supabase learner auth failed: SUPABASE_URL is missing or empty.');
    }
    if (!publishableKey || publishableKey.trim() === '') {
      throw new Error(
        'Supabase learner auth failed: SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing or empty.'
      );
    }
  }

  const client =
    config.client ??
    createSupabaseLearnerClient(supabaseUrl!.replace(/\/+$/, ''), publishableKey!.trim());

  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error || !data.session?.access_token || !data.user?.id) {
    const errorMsg = error?.message ?? 'Sign-in returned no valid session access token';
    throw new Error(`Failed to authenticate disposable Supabase learner: ${errorMsg}`);
  }

  return {
    accessToken: data.session.access_token,
    userId: data.user.id,
    email: credentials.email,
  };
}

export function generateDisposableCredentials(tag?: string): {
  readonly email: string;
  readonly password: string;
} {
  const prefix = tag ? `${tag}-` : '';
  const email = `frll-${prefix}${randomUUID()}@example.invalid`;
  // Generate high-entropy password satisfying typical complexity requirements
  const password = `Frll!${randomBytes(18).toString('base64url')}#9`;
  return { email, password };
}

/**
 * Creates a confirmed disposable user in Supabase Auth via the official Auth Admin API.
 * Uses createClient with server-side admin options (autoRefreshToken: false, persistSession: false).
 * Never logs passwords or secret key credentials.
 */
export async function createDisposableSupabaseUser(
  config: SupabaseAdminConfig & { readonly tag?: string } = {}
): Promise<DisposableSupabaseUser> {
  const adminConfig = getValidatedAdminConfig(config);
  const client =
    adminConfig.client ??
    createSupabaseAdminClient(adminConfig.supabaseUrl, adminConfig.secretKey);
  const { email, password } = generateDisposableCredentials(config.tag);

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      frll_disposable_test_user: true,
      created_at: new Date().toISOString(),
    },
  });

  if (error || !data?.user?.id) {
    const errorMsg = error?.message ?? 'User creation returned no valid user entity';
    throw new Error(`Failed to provision disposable Supabase test user: ${errorMsg}`);
  }

  return {
    id: data.user.id,
    email,
    password,
  };
}

/**
 * Deletes a disposable test user in Supabase Auth via the official Auth Admin API.
 * When deleted, foreign keys in PostgreSQL cascade and clean up all application learner state.
 */
export async function deleteDisposableSupabaseUser(
  config: SupabaseAdminConfig & { readonly userId: string }
): Promise<void> {
  if (!config.userId || config.userId.trim() === '') {
    throw new Error('Cannot delete Supabase test user: userId is missing or empty.');
  }

  const adminConfig = getValidatedAdminConfig(config);
  const client =
    adminConfig.client ??
    createSupabaseAdminClient(adminConfig.supabaseUrl, adminConfig.secretKey);

  const { error } = await client.auth.admin.deleteUser(config.userId);

  if (error) {
    // 404/not-found is considered safely idempotent for cleanup
    const msg = error.message ?? '';
    const status = (error as { status?: number }).status;
    if (status !== 404 && !msg.toLowerCase().includes('not found')) {
      throw new Error(
        `Failed to delete disposable Supabase test user ${config.userId}: ${msg}`
      );
    }
  }
}
