import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouteBoundary } from '../../apps/web/src/components/auth/AppRouteBoundary';
import { AuthProvider } from '../../apps/web/src/features/auth/AuthContext';
import { useProductReadiness } from '../../apps/web/src/hooks/useProductReadiness';
import { setApiClient } from '../../apps/web/src/lib/api/client';
import {
  HttpApiClient,
  MockApiClient,
  mockApiResponses,
  type LanguageProfileDto,
  type MeResponseDto,
} from '@lingua/types';

const actorId = '00000000-0000-4000-8000-000000000001';
const testUser = { id: actorId, email: 'learner@example.test', role: 'authenticated' } as User;
const testSession = { access_token: 'synthetic-test-token', token_type: 'bearer', user: testUser } as Session;
const timeoutMessage = 'Kiểm tra hồ sơ học tập đã quá thời gian chờ. Vui lòng thử lại.';

function readyProfile(overrides: Partial<LanguageProfileDto> = {}): LanguageProfileDto {
  return {
    ...mockApiResponses.languageProfile.data,
    nativeLanguageCode: 'vi',
    targetLanguageCode: 'en',
    goal: 'communication',
    dailyMinutes: 25,
    status: 'active',
    startingLevelEstimate: null,
    ...overrides,
  };
}

function readyMe(overrides: Partial<MeResponseDto['data']> = {}): MeResponseDto {
  return {
    ...mockApiResponses.me,
    data: {
      ...mockApiResponses.me.data,
      id: actorId,
      timeZone: 'Asia/Ho_Chi_Minh',
      languageProfiles: [readyProfile()],
      ...overrides,
    },
  };
}

function jsonResponse(body: unknown, etag = '"me-test"'): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ETag: etag },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 24; index += 1) await Promise.resolve();
}

async function flushReact(): Promise<void> {
  await act(async () => {
    await flushMicrotasks();
  });
}

function createAuthMock(initialSession: Session | null = testSession) {
  let authListener: ((event: string, session: Session | null) => void) | undefined;
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: initialSession }, error: null })),
      onAuthStateChange: vi.fn((callback: (event: string, session: Session | null) => void) => {
        authListener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
  } as unknown as SupabaseClient;

  return {
    client,
    emit(event: string, session: Session | null) {
      authListener?.(event, session);
    },
  };
}

function mountBoundary(options: {
  readonly pathname?: string;
  readonly session?: Session | null;
  readonly replace?: (path: string) => void;
} = {}) {
  const auth = createAuthMock(options.session === undefined ? testSession : options.session);
  const replace = options.replace ?? vi.fn();
  const view = render(
    <AuthProvider customClient={auth.client}>
      <AppRouteBoundary router={{ replace, push: vi.fn() }} pathname={options.pathname ?? '/today'}>
        <div data-testid="protected-learning-child">Today dashboard</div>
      </AppRouteBoundary>
    </AuthProvider>
  );
  return { ...view, auth, replace };
}

function createHttpApiClient(
  fetchFn: typeof fetch,
  authTokenProvider: { getAccessToken: () => Promise<string | null> } = {
    getAccessToken: async () => 'synthetic-test-token',
  }
): HttpApiClient {
  return new HttpApiClient({
    baseUrl: 'https://api.example.test',
    authTokenProvider,
    fetchFn,
  });
}

const notReadyMeCases: Array<[string, (value: MeResponseDto) => MeResponseDto]> = [
  ['missing learner profile ID', (value) => ({ ...value, data: { ...value.data, id: '' } })],
  ['missing timezone', (value) => ({ ...value, data: { ...value.data, timeZone: null } })],
  ['invalid timezone', (value) => ({ ...value, data: { ...value.data, timeZone: 'Not/A_Zone' } })],
  ['missing active language profile', (value) => ({ ...value, data: { ...value.data, languageProfiles: [] } })],
  ['unsupported language pair', (value) => ({ ...value, data: { ...value.data, languageProfiles: [readyProfile({ nativeLanguageCode: 'en' })] } })],
  ['paused language profile', (value) => ({ ...value, data: { ...value.data, languageProfiles: [readyProfile({ status: 'paused' })] } })],
  ['invalid learning goal', (value) => ({ ...value, data: { ...value.data, languageProfiles: [readyProfile({ goal: 'unknown-goal' as never })] } })],
  ['daily minutes below the contract range', (value) => ({ ...value, data: { ...value.data, languageProfiles: [readyProfile({ dailyMinutes: 4 })] } })],
  ['non-integer daily minutes', (value) => ({ ...value, data: { ...value.data, languageProfiles: [readyProfile({ dailyMinutes: 25.5 })] } })],
  ['missing languageProfiles field', (value) => ({ ...value, data: { ...value.data, languageProfiles: undefined } as unknown as MeResponseDto['data'] })],
  ['malformed languageProfiles value', (value) => ({ ...value, data: { ...value.data, languageProfiles: 'not-an-array' } as unknown as MeResponseDto['data'] })],
];

describe('PILOT-002 profile readiness recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setApiClient(new MockApiClient());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setApiClient(new MockApiClient());
  });

  it('uses complete GET /v1/me profiles without issuing the redundant collection GET', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const delayedCollectionResponse = deferred<Response>();
    const requests: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      requests.push(`${init?.method ?? 'GET'} ${path}`);
      if (path === '/v1/me') {
        return jsonResponse(readyMe(), '"me-authoritative"');
      }
      if (path === '/v1/me/languages') return delayedCollectionResponse.promise;
      throw new Error(`Unexpected test request: ${path}`);
    });
    const client = createHttpApiClient(fetchFn);
    setApiClient(client);

    mountBoundary();
    await act(async () => {
      await flushMicrotasks();
    });
    expect(requests).toContain('GET /v1/me');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByTestId('protected-learning-child')).toBeInTheDocument();
    expect(requests).toEqual(['GET /v1/me']);
    expect(client.getLastEtag('me')).toBe('"me-authoritative"');
  });

  it.each(notReadyMeCases)('keeps protected routes closed for %s', async (_name, mutate) => {
    const responseBody = mutate(readyMe());
    const fetchFn = vi.fn(async () => jsonResponse(responseBody));
    setApiClient(createHttpApiClient(fetchFn));
    const replace = vi.fn();

    mountBoundary({ replace });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding'));
    expect(screen.queryByTestId('protected-learning-child')).not.toBeInTheDocument();
  });

  it('keeps unauthenticated protected routes behind authentication without a profile request', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(readyMe()));
    setApiClient(createHttpApiClient(fetchFn));
    const replace = vi.fn();

    mountBoundary({ session: null, replace });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth'));
    expect(fetchFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId('protected-learning-child')).not.toBeInTheDocument();
  });

  it('allows a legitimate 30-second profile response to complete before the 45-second deadline', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const fetchFn = vi.fn(async (): Promise<Response> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(jsonResponse(readyMe(), '"me-30s"')), 30_000);
      });
    });
    const client = createHttpApiClient(fetchFn);
    setApiClient(client);

    mountBoundary();
    await flushReact();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await flushMicrotasks();
    });

    expect(screen.getByTestId('protected-learning-child')).toBeInTheDocument();
    expect(screen.queryByText(timeoutMessage)).not.toBeInTheDocument();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(client.getLastEtag('me')).toBe('"me-30s"');
  });

  it.each(['token', 'fetch', 'body'] as const)(
    'times out a pending %s stage at 45 seconds and requires an explicit retry',
    async (stage) => {
      vi.useFakeTimers({ now: Date.now() });
      const lateToken = deferred<string | null>();
      const lateFetch = deferred<Response>();
      const lateBody = deferred<string>();
      let tokenCallCount = 0;
      let fetchCallCount = 0;
      let firstSignal: AbortSignal | null = null;
      const tokenProvider = {
        getAccessToken: vi.fn(async () => {
          tokenCallCount += 1;
          if (stage === 'token' && tokenCallCount === 1) {
            return lateToken.promise;
          }
          return 'synthetic-test-token';
        }),
      };
      const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        fetchCallCount += 1;
        if (stage === 'fetch' && fetchCallCount === 1) {
          firstSignal = init?.signal ?? null;
          return lateFetch.promise;
        }
        if (stage === 'body' && fetchCallCount === 1) {
          firstSignal = init?.signal ?? null;
          const firstResponse = jsonResponse(readyMe(), '"me-late"');
          vi.spyOn(firstResponse, 'text').mockImplementation(() => {
            return lateBody.promise;
          });
          return firstResponse;
        }
        return jsonResponse(readyMe(), '"me-retry"');
      });
      const client = createHttpApiClient(fetchFn, tokenProvider);
      setApiClient(client);

      mountBoundary();
      await flushReact();
      expect(tokenCallCount).toBe(1);
      expect(fetchCallCount).toBe(stage === 'token' ? 0 : 1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(44_999);
      });
      expect(screen.getByText('Đang kiểm tra hồ sơ học tập...')).toBeInTheDocument();
      expect(screen.queryByText(timeoutMessage)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /thử lại/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
        await flushMicrotasks();
      });
      expect(screen.getByText(timeoutMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /thử lại/i })).toBeEnabled();
      expect(fetchCallCount).toBe(stage === 'token' ? 0 : 1);
      if (stage !== 'token') expect(firstSignal?.aborted).toBe(true);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
        await flushMicrotasks();
      });
      expect(screen.getByTestId('protected-learning-child')).toBeInTheDocument();
      expect(client.getLastEtag('me')).toBe('"me-retry"');

      if (stage === 'token') lateToken.resolve('late-synthetic-token');
      if (stage === 'fetch') lateFetch.resolve(jsonResponse(readyMe(), '"me-late"'));
      if (stage === 'body') lateBody.resolve(JSON.stringify(readyMe()));
      await flushReact();

      expect(screen.getByTestId('protected-learning-child')).toBeInTheDocument();
      expect(client.getLastEtag('me')).toBe('"me-retry"');
      expect(fetchCallCount).toBe(stage === 'token' ? 1 : 2);
    }
  );

  it('starts a fresh read after a batched logout/login ABA and hides old readiness until it resolves', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const firstResponse = deferred<Response>();
    const secondResponse = deferred<Response>();
    let fetchCallCount = 0;
    let firstSignal: AbortSignal | null = null;
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      fetchCallCount += 1;
      if (fetchCallCount === 1) {
        firstSignal = init?.signal ?? null;
        return firstResponse.promise;
      }
      if (fetchCallCount === 2) {
        return secondResponse.promise;
      }
      throw new Error('Unexpected extra profile request');
    });
    const client = createHttpApiClient(fetchFn);
    setApiClient(client);
    const auth = createAuthMock();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider customClient={auth.client}>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useProductReadiness(), { wrapper });

    await flushReact();
    expect(fetchCallCount).toBe(1);
    await act(async () => {
      auth.emit('SIGNED_OUT', null);
      auth.emit('SIGNED_IN', testSession);
    });
    await flushReact();

    expect(fetchCallCount).toBe(2);
    expect(firstSignal?.aborted).toBe(true);
    expect(result.current).toMatchObject({
      status: 'loading',
      isReady: false,
      timeZone: null,
      activeLanguageProfileId: null,
    });

    secondResponse.resolve(jsonResponse(readyMe(), '"me-after-aba"'));
    await flushReact();
    expect(result.current).toMatchObject({
      status: 'ready',
      isReady: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    expect(client.getLastEtag('me')).toBe('"me-after-aba"');

    firstResponse.resolve(jsonResponse(readyMe({ timeZone: null }), '"me-stale"'));
    await flushReact();
    expect(result.current).toMatchObject({
      status: 'ready',
      isReady: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    expect(client.getLastEtag('me')).toBe('"me-after-aba"');
  });

  it('invalidates and clears readiness on logout while the prior actor request is pending', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const lateResponse = deferred<Response>();
    let requestSignal: AbortSignal | null = null;
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requestSignal = init?.signal ?? null;
      return lateResponse.promise;
    });
    const client = createHttpApiClient(fetchFn);
    setApiClient(client);
    const auth = createAuthMock();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider customClient={auth.client}>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useProductReadiness(), { wrapper });

    await flushReact();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await act(async () => {
      auth.emit('SIGNED_OUT', null);
    });
    await flushReact();
    expect(requestSignal?.aborted).toBe(true);
    expect(result.current).toMatchObject({
      status: 'unauthenticated',
      isReady: false,
      timeZone: null,
      activeLanguageProfileId: null,
    });

    lateResponse.resolve(jsonResponse(readyMe(), '"me-after-logout"'));
    await flushReact();
    expect(result.current.isReady).toBe(false);
    expect(client.getLastEtag('me')).toBeUndefined();
  });

  it('aborts a pending profile read on unmount and prevents a late ETag write', async () => {
    vi.useFakeTimers({ now: Date.now() });
    const lateResponse = deferred<Response>();
    let requestSignal: AbortSignal | null = null;
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requestSignal = init?.signal ?? null;
      return lateResponse.promise;
    });
    const client = createHttpApiClient(fetchFn);
    setApiClient(client);
    const auth = createAuthMock();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider customClient={auth.client}>{children}</AuthProvider>
    );
    const { unmount } = renderHook(() => useProductReadiness(), { wrapper });

    await flushReact();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    unmount();
    expect(requestSignal?.aborted).toBe(true);

    lateResponse.resolve(jsonResponse(readyMe(), '"me-after-unmount"'));
    await flushMicrotasks();
    expect(client.getLastEtag('me')).toBeUndefined();
  });

  it('preserves disabled readiness without making a profile request', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(readyMe()));
    setApiClient(createHttpApiClient(fetchFn));
    const auth = createAuthMock();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider customClient={auth.client}>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useProductReadiness(undefined, false), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.isReady).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
