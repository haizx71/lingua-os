import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createDisposableSupabaseUser,
  deleteDisposableSupabaseUser,
  createSupabaseAdminClient,
} from './supabase_users';

describe('FRLL Supabase User Provisioner Seam', () => {
  it('fails clearly when credentials are not configured', async () => {
    await expect(
      createDisposableSupabaseUser({ supabaseUrl: '', secretKey: '' })
    ).rejects.toThrow('SUPABASE_URL is missing');

    await expect(
      createDisposableSupabaseUser({
        supabaseUrl: 'https://test.supabase.co',
        secretKey: '',
      })
    ).rejects.toThrow('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing');
  });

  it('configures server-only Supabase admin client without auth persistence or token refresh', () => {
    const client = createSupabaseAdminClient('https://test.supabase.co', 'sb_secret_sample_key_123');
    expect(client.supabaseUrl).toBe('https://test.supabase.co');
    expect(client.supabaseKey).toBe('sb_secret_sample_key_123');
    expect(client.auth.admin).toBeDefined();
    expect((client.auth as unknown as { persistSession?: boolean }).persistSession).toBe(false);
  });

  it('provisions a confirmed user via official Auth Admin API using modern secretKey without Bearer JWT header', async () => {
    const mockCreateUser = vi.fn().mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
      error: null,
    });

    const mockClient = {
      auth: {
        admin: {
          createUser: mockCreateUser,
          deleteUser: vi.fn(),
        },
      },
    } as unknown as SupabaseClient;

    const user = await createDisposableSupabaseUser({
      client: mockClient,
      tag: 'actor-a',
    });

    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    const createArg = mockCreateUser.mock.calls[0][0];
    expect(createArg.email).toMatch(/^frll-actor-a-[0-9a-f-]{36}@example\.invalid$/);
    expect(createArg.email_confirm).toBe(true);
    expect(createArg.password.length).toBeGreaterThan(15);
    expect(user.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(user.email).toContain('@example.invalid');
    expect(user.password).toBeDefined();

    // Verify no secret value leaked anywhere into user entity
    expect(JSON.stringify(user)).not.toContain('secret');
  });

  it('provisions a confirmed user using legacy serviceRoleKey parameter as backward-compatible alias', async () => {
    const mockCreateUser = vi.fn().mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000002' } },
      error: null,
    });

    const mockClient = {
      auth: {
        admin: {
          createUser: mockCreateUser,
          deleteUser: vi.fn(),
        },
      },
    } as unknown as SupabaseClient;

    const user = await createDisposableSupabaseUser({
      client: mockClient,
      serviceRoleKey: 'legacy-service-role-key-val',
      tag: 'legacy-actor',
    });

    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(user.id).toBe('00000000-0000-4000-8000-000000000002');
  });

  it('creates valid admin client instance when provided legacy serviceRoleKey', () => {
    const client = createSupabaseAdminClient('https://test.supabase.co', 'legacy-service-role-key-val');
    expect(client.supabaseUrl).toBe('https://test.supabase.co');
    expect(client.supabaseKey).toBe('legacy-service-role-key-val');
    expect(client.auth.admin).toBeDefined();
  });

  it('deletes a disposable user via official Auth Admin API', async () => {
    const mockDeleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });

    const mockClient = {
      auth: {
        admin: {
          createUser: vi.fn(),
          deleteUser: mockDeleteUser,
        },
      },
    } as unknown as SupabaseClient;

    await deleteDisposableSupabaseUser({
      client: mockClient,
      userId: '00000000-0000-4000-8000-000000000001',
    });

    expect(mockDeleteUser).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
  });

  it('fails closed and masks secret when user creation encounters an admin error', async () => {
    const mockCreateUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Database connection failed' },
    });

    const mockClient = {
      auth: {
        admin: {
          createUser: mockCreateUser,
          deleteUser: vi.fn(),
        },
      },
    } as unknown as SupabaseClient;

    await expect(
      createDisposableSupabaseUser({ client: mockClient })
    ).rejects.toThrow('Failed to provision disposable Supabase test user: Database connection failed');
  });
});
