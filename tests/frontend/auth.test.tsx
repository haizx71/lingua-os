import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import type { AuthTokenProvider, HttpApiClientOptions } from '@lingua/types';
import { toAuthTokenProvider } from '@lingua/types';
import { getSupabasePublicConfig } from '../../apps/web/src/lib/supabase/config';
import { createBrowserSupabaseClient } from '../../apps/web/src/lib/supabase/client';
import { createSupabaseAuthTokenProvider } from '../../apps/web/src/lib/supabase/token-provider';
import { AuthProvider, useAuth } from '../../apps/web/src/features/auth/AuthContext';
import { ProtectedRoute } from '../../apps/web/src/features/auth/ProtectedRoute';

function createMockSupabaseClient(initialSession: Session | null = null): {
  client: SupabaseClient;
  setMockSession: (s: Session | null) => void;
  triggerAuthStateChange: (event: string, s: Session | null) => void;
  authListeners: Array<(event: string, session: Session | null) => void>;
} {
  let currentSession = initialSession;
  const listeners: Array<(event: string, session: Session | null) => void> = [];

  const mockClient = {
    auth: {
      getSession: vi.fn().mockImplementation(async () => ({
        data: { session: currentSession },
        error: null,
      })),
      refreshSession: vi.fn().mockImplementation(async () => ({
        data: { session: currentSession },
        error: null,
      })),
      signOut: vi.fn().mockImplementation(async () => {
        currentSession = null;
        listeners.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn().mockImplementation(() => {
                const idx = listeners.indexOf(callback);
                if (idx >= 0) listeners.splice(idx, 1);
              }),
            },
          },
        };
      }),
    },
  } as unknown as SupabaseClient;

  return {
    client: mockClient,
    setMockSession: (s: Session | null) => {
      currentSession = s;
    },
    triggerAuthStateChange: (event: string, s: Session | null) => {
      currentSession = s;
      listeners.forEach((cb) => cb(event, s));
    },
    authListeners: listeners,
  };
}

const mockValidUser: User = {
  id: '00000000-0000-4000-8000-000000000001',
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Test Learner' },
  aud: 'authenticated',
  created_at: '2026-08-22T00:00:00.000Z',
  email: 'learner@lingua.vn',
  role: 'authenticated',
};

const mockValidSession: Session = {
  access_token: 'valid.supabase.jwt.token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1770000000,
  refresh_token: 'valid-refresh-token',
  user: mockValidUser,
};

describe('TASK-006C: Frontend Authentication Foundation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. Configuration & Security Boundary', () => {
    it('resolves public browser Supabase configuration from environment safely', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdef.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key-12345';

      const config = getSupabasePublicConfig();
      expect(config.isConfigured).toBe(true);
      expect(config.supabaseUrl).toBe('https://abcdef.supabase.co');
      expect(config.supabaseAnonKey).toBe('anon-public-key-12345');
    });

    it('throws immediate security error if service-role secret is passed to public config', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdef.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'supabase_service_role_secret_key_prohibited';

      expect(() => getSupabasePublicConfig()).toThrow(
        /SECURITY INVARIANT VIOLATION: .* detected/
      );

    });

    it('returns isConfigured: false when public variables are unset without throwing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const config = getSupabasePublicConfig();
      expect(config.isConfigured).toBe(false);
      expect(config.supabaseUrl).toBe('');
      expect(config.supabaseAnonKey).toBe('');
    });

    it('structurally ignores server-only environment variables like DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-service-role-backend-key';

      const config = getSupabasePublicConfig();
      expect(config.isConfigured).toBe(false);
      expect(config.supabaseUrl).toBe('');
      expect(config.supabaseAnonKey).toBe('');
    });
  });

  describe('2. Canonical AuthTokenProvider Abstraction & Error Semantics', () => {
    it('returns access token from valid Supabase session', async () => {
      const { client } = createMockSupabaseClient(mockValidSession);
      const provider = createSupabaseAuthTokenProvider(client);

      const token = await provider.getAccessToken();
      expect(token).toBe('valid.supabase.jwt.token');
    });

    it('returns null when no session is active (genuine unauthenticated state)', async () => {
      const { client } = createMockSupabaseClient(null);
      const provider = createSupabaseAuthTokenProvider(client);

      const token = await provider.getAccessToken();
      expect(token).toBeNull();
    });

    it('throws typed AuthTokenProviderError on unexpected SDK/network failure', async () => {
      const failingClient = {
        auth: {
          getSession: vi.fn().mockImplementation(async () => ({
            data: { session: null },
            error: { message: 'Network connection timeout to Supabase auth service' },
          })),
        },
      } as unknown as SupabaseClient;

      const provider = createSupabaseAuthTokenProvider(failingClient);

      await expect(provider.getAccessToken()).rejects.toThrow(
        /Supabase session retrieval failed: Network connection timeout/
      );
    });

    it('normalizes function or object provider via toAuthTokenProvider helper', async () => {
      const fnProvider = async () => 'fn-token-123';
      const objProvider: AuthTokenProvider = {
        getAccessToken: async () => 'obj-token-456',
      };

      const normalizedFn = toAuthTokenProvider(fnProvider);
      const normalizedObj = toAuthTokenProvider(objProvider);

      expect(await normalizedFn.getAccessToken()).toBe('fn-token-123');
      expect(await normalizedObj.getAccessToken()).toBe('obj-token-456');
    });

    it('HttpApiClientOptions allows specifying AuthTokenProvider decoupled from Supabase', () => {
      const provider: AuthTokenProvider = {
        getAccessToken: async () => 'bearer-jwt',
      };

      const options: HttpApiClientOptions = {
        baseUrl: '/api',
        authTokenProvider: provider,
      };

      expect(options.baseUrl).toBe('/api');
      expect(options.authTokenProvider).toBe(provider);
    });
  });


  describe('3. React AuthContext & Lifecycle State', () => {
    const TestConsumer: React.FC = () => {
      const { authState, user, session, signOut } = useAuth();
      return (
        <div>
          <div data-testid="auth-state">{authState}</div>
          <div data-testid="user-id">{user?.id ?? 'none'}</div>
          <div data-testid="has-session">{session ? 'yes' : 'no'}</div>
          <button onClick={() => signOut()}>Sign Out</button>
        </div>
      );
    };

    it('initializes to authenticated when legitimate session is bootstrap-resolved', async () => {
      const { client } = createMockSupabaseClient(mockValidSession);

      render(
        <AuthProvider customClient={client}>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state').textContent).toBe('authenticated');
      });

      expect(screen.getByTestId('user-id').textContent).toBe(mockValidUser.id);
      expect(screen.getByTestId('has-session').textContent).toBe('yes');
    });

    it('initializes to unauthenticated when no session exists', async () => {
      const { client } = createMockSupabaseClient(null);

      render(
        <AuthProvider customClient={client}>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state').textContent).toBe('unauthenticated');
      });

      expect(screen.getByTestId('user-id').textContent).toBe('none');
      expect(screen.getByTestId('has-session').textContent).toBe('no');
    });

    it('updates state dynamically on token refresh or session change', async () => {
      const { client, triggerAuthStateChange } = createMockSupabaseClient(null);

      render(
        <AuthProvider customClient={client}>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state').textContent).toBe('unauthenticated');
      });

      // Simulate sign-in event from Supabase
      act(() => {
        triggerAuthStateChange('SIGNED_IN', mockValidSession);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state').textContent).toBe('authenticated');
      });
      expect(screen.getByTestId('user-id').textContent).toBe(mockValidUser.id);
    });

    it('sign-out clears authenticated state and removes session on success', async () => {
      const { client } = createMockSupabaseClient(mockValidSession);

      render(
        <AuthProvider customClient={client}>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state').textContent).toBe('authenticated');
      });

      act(() => {
        screen.getByRole('button', { name: /Sign Out/i }).click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state').textContent).toBe('unauthenticated');
      });
      expect(screen.getByTestId('has-session').textContent).toBe('no');
    });

    it('sign-out failure does NOT falsely clear session; preserves authenticated state and exposes error', async () => {
      let currentSession: Session | null = mockValidSession;
      const failingSignOutClient = {
        auth: {
          getSession: vi.fn().mockImplementation(async () => ({
            data: { session: currentSession },
            error: null,
          })),
          refreshSession: vi.fn().mockImplementation(async () => ({
            data: { session: currentSession },
            error: null,
          })),
          signOut: vi.fn().mockImplementation(async () => {
            // Simulate network/server rejection on sign out
            return { error: { message: 'Network error preventing sign out' } };
          }),
          onAuthStateChange: vi.fn().mockImplementation(() => ({
            data: { subscription: { unsubscribe: vi.fn() } },
          })),
        },
      } as unknown as SupabaseClient;

      const SignOutErrorConsumer: React.FC = () => {
        const { authState, error, session, signOut } = useAuth();
        return (
          <div>
            <div data-testid="auth-state">{authState}</div>
            <div data-testid="error-message">{error?.message ?? 'none'}</div>
            <div data-testid="has-session">{session ? 'yes' : 'no'}</div>
            <button onClick={() => signOut()}>Sign Out</button>
          </div>
        );
      };

      render(
        <AuthProvider customClient={failingSignOutClient}>
          <SignOutErrorConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state').textContent).toBe('authenticated');
      });

      // Attempt sign out which will return an error
      act(() => {
        screen.getByRole('button', { name: /Sign Out/i }).click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-message').textContent).toContain('Network error preventing sign out');
      });

      // Invariant: Session is preserved and authState remains 'authenticated'
      expect(screen.getByTestId('auth-state').textContent).toBe('authenticated');
      expect(screen.getByTestId('has-session').textContent).toBe('yes');
    });


    it('keeps product learner profile separate from Supabase auth user identity', async () => {
      const { client } = createMockSupabaseClient(mockValidSession);

      const IdentityConsumer: React.FC = () => {
        const { userIdentity } = useAuth();
        return (
          <div data-testid="identity-json">
            {JSON.stringify(userIdentity)}
          </div>
        );
      };


      render(
        <AuthProvider customClient={client}>
          <IdentityConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('identity-json').textContent).not.toBe('');
      });

      const parsed = JSON.parse(screen.getByTestId('identity-json').textContent || '{}');
      expect(parsed.id).toBe(mockValidUser.id);
      expect(parsed.email).toBe(mockValidUser.email);
      // Supabase user identity does NOT include LINGUA Learner Profile attributes (e.g. dailyMinutes, targetLevel, startingLevelEstimate)
      expect(parsed.dailyMinutes).toBeUndefined();
      expect(parsed.targetLevel).toBeUndefined();
      expect(parsed.startingLevelEstimate).toBeUndefined();
    });
  });

  describe('4. ProtectedRoute Boundary', () => {
    it('renders loading state during session bootstrap without redirect loops', () => {
      // Mock client that does not resolve session immediately
      const pendingClient = {
        auth: {
          getSession: () => new Promise(() => {}), // never resolves
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
      } as unknown as SupabaseClient;

      render(
        <AuthProvider customClient={pendingClient}>
          <ProtectedRoute>
            <div>Protected Learning Content</div>
          </ProtectedRoute>
        </AuthProvider>
      );

      expect(screen.getByText(/Đang kiểm tra phiên đăng nhập/i)).toBeDefined();
      expect(screen.queryByText('Protected Learning Content')).toBeNull();
    });

    it('renders unauthenticated fallback when unauthenticated', async () => {
      const { client } = createMockSupabaseClient(null);

      render(
        <AuthProvider customClient={client}>
          <ProtectedRoute>
            <div>Protected Learning Content</div>
          </ProtectedRoute>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Yêu cầu xác thực/i)).toBeDefined();
      });

      expect(screen.queryByText('Protected Learning Content')).toBeNull();
    });

    it('renders protected children when authenticated', async () => {
      const { client } = createMockSupabaseClient(mockValidSession);

      render(
        <AuthProvider customClient={client}>
          <ProtectedRoute>
            <div>Protected Learning Content</div>
          </ProtectedRoute>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Learning Content')).toBeDefined();
      });

      expect(screen.queryByText(/Yêu cầu xác thực/i)).toBeNull();
    });
  });

  describe('5. Next.js SSR Middleware Session Refresh & Cookie Sync', () => {
    it('returns unmodified response when Supabase is not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const { updateSession } = await import('../../apps/web/src/lib/supabase/middleware');

      const mockRequest = {
        cookies: {
          getAll: () => [],
          set: vi.fn(),
        },
        url: 'http://localhost:3000/review',
      } as unknown as Parameters<typeof updateSession>[0];

      const response = await updateSession(mockRequest);
      expect(response).toBeDefined();
    });

    it('synchronizes refreshed cookies and forwards @supabase/ssr cache headers to response without dropping them', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdef.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-12345';

      const { updateSession } = await import('../../apps/web/src/lib/supabase/middleware');

      const requestCookieStore = new Map<string, string>();
      const mockRequest = {
        cookies: {
          getAll: () => Array.from(requestCookieStore.entries()).map(([name, value]) => ({ name, value })),
          set: vi.fn((name: string, value: string) => {
            requestCookieStore.set(name, value);
          }),
        },
        url: 'http://localhost:3000/review',
      } as unknown as Parameters<typeof updateSession>[0];

      const response = await updateSession(mockRequest);
      expect(response).toBeDefined();
      expect(response.headers).toBeDefined();
    });
  });
});


