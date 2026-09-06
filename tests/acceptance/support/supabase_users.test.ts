import { describe, it, expect, vi } from 'vitest';
import { createDisposableSupabaseUser, deleteDisposableSupabaseUser } from './supabase_users';

describe('FRLL Supabase User Provisioner Seam', () => {
  it('fails clearly when credentials are not configured', async () => {
    await expect(
      createDisposableSupabaseUser({ supabaseUrl: '', serviceRoleKey: '' })
    ).rejects.toThrow('SUPABASE_URL is missing');

    await expect(
      createDisposableSupabaseUser({
        supabaseUrl: 'https://test.supabase.co',
        serviceRoleKey: '',
      })
    ).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY is missing');
  });

  it('provisions a confirmed user via Supabase Admin API with randomized email and isolated password', async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://test.supabase.co/auth/v1/admin/users');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        apikey: 'test-service-key',
        Authorization: 'Bearer test-service-key',
      });
      const body = JSON.parse(String(init?.body));
      expect(body.email).toMatch(/^frll-actor-a-[0-9a-f-]{36}@example\.invalid$/);
      expect(body.email_confirm).toBe(true);
      expect(body.password.length).toBeGreaterThan(15);
      return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      const user = await createDisposableSupabaseUser({
        supabaseUrl: 'https://test.supabase.co',
        serviceRoleKey: 'test-service-key',
        tag: 'actor-a',
      });
      expect(user.id).toBe('00000000-0000-4000-8000-000000000001');
      expect(user.email).toContain('@example.invalid');
      expect(user.password).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('deletes a disposable user via Supabase Admin API', async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        'https://test.supabase.co/auth/v1/admin/users/00000000-0000-4000-8000-000000000001'
      );
      expect(init?.method).toBe('DELETE');
      expect(init?.headers).toMatchObject({
        apikey: 'test-service-key',
        Authorization: 'Bearer test-service-key',
      });
      return new Response(null, { status: 200 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      await deleteDisposableSupabaseUser({
        supabaseUrl: 'https://test.supabase.co',
        serviceRoleKey: 'test-service-key',
        userId: '00000000-0000-4000-8000-000000000001',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
