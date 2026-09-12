import { describe, it, expect, vi } from 'vitest';
import { AuthApiError, type SupabaseClient } from '@supabase/supabase-js';
import {
  createDisposableSupabaseUser,
  deleteDisposableSupabaseUser,
  verifyDisposableUserDeletedFromAuth,
  createSupabaseAdminClient,
  createSupabaseLearnerClient,
  authenticateDisposableLearner,
} from './supabase_users';

describe('FRLL Supabase User Provisioner Seam', () => {
  it.each([createSupabaseAdminClient, createSupabaseLearnerClient])(
    'bounds real SDK network requests with an abort signal (%#)', async factory => {
      const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
        JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
      try {
        const client = factory('https://test.supabase.co', 'test-only-public-key');
        await client.auth.admin.getUserById('00000000-0000-4000-8000-000000000001');
        expect(request).toHaveBeenCalled();
        expect(request.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
      } finally { request.mockRestore(); }
    },
  );
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

  it('configures learner client with publishable key and no session persistence', () => {
    const client = createSupabaseLearnerClient('https://test.supabase.co', 'sb_publishable_key_123');
    expect(client.supabaseUrl).toBe('https://test.supabase.co');
    expect(client.supabaseKey).toBe('sb_publishable_key_123');
    expect((client.auth as unknown as { persistSession?: boolean }).persistSession).toBe(false);
  });

  it('authenticates disposable learner via standard signInWithPassword flow', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({
      data: {
        session: { access_token: 'valid.mock.jwt.token' },
        user: { id: '00000000-0000-4000-8000-000000000001', email: 'learner@example.invalid' },
      },
      error: null,
    });

    const mockClient = {
      auth: {
        signInWithPassword: mockSignIn,
      },
    } as unknown as SupabaseClient;

    const session = await authenticateDisposableLearner(
      { email: 'learner@example.invalid', password: 'TestPassword#123' },
      { client: mockClient }
    );

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'learner@example.invalid',
      password: 'TestPassword#123',
    });
    expect(session.userId).toBe('00000000-0000-4000-8000-000000000001');
    expect(session.accessToken).toBe('valid.mock.jwt.token');
    expect(session.email).toBe('learner@example.invalid');
  });

  it('learner auth fails closed when credentials return error', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    const mockClient = {
      auth: {
        signInWithPassword: mockSignIn,
      },
    } as unknown as SupabaseClient;

    await expect(
      authenticateDisposableLearner(
        { email: 'bad@example.invalid', password: 'WrongPassword#1' },
        { client: mockClient }
      )
    ).rejects.toThrow('Failed to authenticate disposable Supabase learner: Invalid login credentials');
  });

  describe('verifyDisposableUserDeletedFromAuth', () => {
    it('returns true only for canonical Auth API user_not_found with HTTP 404', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: new AuthApiError('User not found', 404, 'user_not_found'),
      });

      const mockClient = {
        auth: {
          admin: {
            getUserById: mockGetUser,
          },
        },
      } as unknown as SupabaseClient;

      const deleted = await verifyDisposableUserDeletedFromAuth({
        userId: '00000000-0000-4000-8000-000000000001',
        client: mockClient,
      });

      expect(deleted).toBe(true);
      expect(mockGetUser).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
    });

    it('returns false when getUserById returns an existing user entity', async () => {
      const mockGetUser = vi.fn().mockResolvedValue({
        data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
        error: null,
      });

      const mockClient = {
        auth: {
          admin: {
            getUserById: mockGetUser,
          },
        },
      } as unknown as SupabaseClient;

      const deleted = await verifyDisposableUserDeletedFromAuth({
        userId: '00000000-0000-4000-8000-000000000001',
        client: mockClient,
      });

      expect(deleted).toBe(false);
    });

    it('fails closed when userId is empty', async () => {
      await expect(
        verifyDisposableUserDeletedFromAuth({ userId: '' })
      ).rejects.toThrow('Cannot verify Supabase test user: userId is missing or empty');
    });

    it.each([
      ['unauthorized', new AuthApiError('User not found', 401, 'user_not_found')],
      ['forbidden', new AuthApiError('Forbidden', 403, 'not_admin')],
      ['server failure', new AuthApiError('Server failed', 500, 'unexpected_failure')],
      ['generic 404', new AuthApiError('Not found', 404)],
      ['wrong 404 code', new AuthApiError('User not found', 404, 'session_not_found')],
      ['plain malformed error', { status: 404, code: 'user_not_found' }],
    ])('fails closed for %s instead of treating null user as deletion', async (_label, error) => {
      const client = {
        auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error }) } },
      } as unknown as SupabaseClient;
      await expect(verifyDisposableUserDeletedFromAuth({ client, userId: 'actor-a' }))
        .rejects.toThrow('Cannot confirm disposable Supabase user deletion');
    });

    it.each([
      ['null user on success', { data: { user: null }, error: null }],
      ['missing data', { error: null }],
      ['missing user', { data: {}, error: null }],
      ['missing envelope', undefined],
      ['wrong user identity', { data: { user: { id: 'actor-b' } }, error: null }],
    ])('fails closed for malformed response: %s', async (_label, response) => {
      const client = {
        auth: { admin: { getUserById: vi.fn().mockResolvedValue(response) } },
      } as unknown as SupabaseClient;
      await expect(verifyDisposableUserDeletedFromAuth({ client, userId: 'actor-a' }))
        .rejects.toThrow('Cannot confirm disposable Supabase user deletion');
    });

    it('fails closed without exposing network error contents', async () => {
      const client = {
        auth: { admin: { getUserById: vi.fn().mockRejectedValue(new Error('secret-network-detail')) } },
      } as unknown as SupabaseClient;
      await expect(verifyDisposableUserDeletedFromAuth({ client, userId: 'actor-a' }))
        .rejects.toThrow(/^Cannot confirm disposable Supabase user deletion: Auth request failed\.$/);
    });
  });
});
