/**
 * Acceptance test Supabase Auth Admin provisioner for First Real Learning Loop.
 * Strictly uses official Supabase Auth Admin API via service-role key to create/delete
 * disposable test users without hardcoded credentials.
 */

import { randomUUID, randomBytes } from 'node:crypto';

export interface DisposableSupabaseUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
}

export interface SupabaseAdminConfig {
  readonly supabaseUrl?: string;
  readonly serviceRoleKey?: string;
}

function getValidatedAdminConfig(config: SupabaseAdminConfig = {}): {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
} {
  const supabaseUrl = config.supabaseUrl ?? process.env.SUPABASE_URL;
  const serviceRoleKey = config.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.trim() === '') {
    throw new Error('Supabase admin provisioning failed: SUPABASE_URL is missing or empty.');
  }
  if (!serviceRoleKey || serviceRoleKey.trim() === '') {
    throw new Error(
      'Supabase admin provisioning failed: SUPABASE_SERVICE_ROLE_KEY is missing or empty.'
    );
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    serviceRoleKey: serviceRoleKey.trim(),
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
 * Creates a confirmed disposable user in Supabase Auth via the Admin API.
 * Never logs passwords or service role credentials.
 */
export async function createDisposableSupabaseUser(
  config: SupabaseAdminConfig & { readonly tag?: string } = {}
): Promise<DisposableSupabaseUser> {
  const { supabaseUrl, serviceRoleKey } = getValidatedAdminConfig(config);
  const { email, password } = generateDisposableCredentials(config.tag);

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        frll_disposable_test_user: true,
        created_at: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Failed to provision disposable Supabase test user (HTTP ${status}): ${errorBody.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as { id?: string; user?: { id?: string } };
  const userId = data.id ?? data.user?.id;
  if (!userId || typeof userId !== 'string') {
    throw new Error('Supabase admin user creation succeeded but returned no valid user ID.');
  }

  return {
    id: userId,
    email,
    password,
  };
}

/**
 * Deletes a disposable test user in Supabase Auth via the Admin API.
 * When deleted, foreign keys in PostgreSQL cascade and clean up all application learner state.
 */
export async function deleteDisposableSupabaseUser(
  config: SupabaseAdminConfig & { readonly userId: string }
): Promise<void> {
  const { supabaseUrl, serviceRoleKey } = getValidatedAdminConfig(config);
  if (!config.userId || config.userId.trim() === '') {
    throw new Error('Cannot delete Supabase test user: userId is missing or empty.');
  }

  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(config.userId)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const status = response.status;
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Failed to delete disposable Supabase test user ${config.userId} (HTTP ${status}): ${errorBody.slice(0, 200)}`
    );
  }
}
