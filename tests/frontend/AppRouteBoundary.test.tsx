import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthProvider } from '../../apps/web/src/features/auth/AuthContext';
import { AppRouteBoundary } from '../../apps/web/src/components/auth/AppRouteBoundary';
import { setApiClient } from '../../apps/web/src/lib/api/client';
import {
  MockApiClient,
  HttpApiClient,
  mockApiResponses,
  type MeResponseDto,
  type LanguageProfilesResponseDto,
} from '@lingua/types';

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentPathname = '/today';

const testUser = { id: '00000000-0000-4000-8000-000000000001', email: 'learner@example.test', role: 'authenticated' } as User;
const testSession = { access_token: 'valid-token', token_type: 'bearer', user: testUser } as Session;

function createMockSupabase(session: Session | null = testSession): SupabaseClient {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  } as unknown as SupabaseClient;
}

describe('AppRouteBoundary Product Readiness & Route Gating (Slice B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = '/today';
  });

  afterEach(() => {
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/') as unknown as Location;
  });

  it('TEST-READY-01: redirects unready learner accessing /today to /onboarding', async () => {
    currentPathname = '/today';
    const api = new MockApiClient();
    vi.spyOn(api, 'getMe').mockResolvedValue({
      ...mockApiResponses.me,
      data: { ...mockApiResponses.me.data, timeZone: null },
    } as MeResponseDto);
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);
    setApiClient(api);

    render(
      <AuthProvider customClient={createMockSupabase(testSession)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="protected-content">Protected Content</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding');
    });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('TEST-READY-02: redirects ready learner accessing /auth to /today', async () => {
    currentPathname = '/auth';
    const api = new MockApiClient();
    vi.spyOn(api, 'getMe').mockResolvedValue({
      ...mockApiResponses.me,
      data: { ...mockApiResponses.me.data, timeZone: 'Asia/Ho_Chi_Minh' },
    } as MeResponseDto);
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, nativeLanguageCode: 'vi', targetLanguageCode: 'en', status: 'active' }],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);
    setApiClient(api);

    render(
      <AuthProvider customClient={createMockSupabase(testSession)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="auth-form">Auth Form</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('TEST-READY-03: ready learner without estimate re-entering /onboarding is redirected to /today', async () => {
    currentPathname = '/onboarding';
    const api = new MockApiClient();
    vi.spyOn(api, 'getMe').mockResolvedValue({
      ...mockApiResponses.me,
      data: { ...mockApiResponses.me.data, timeZone: 'Asia/Ho_Chi_Minh' },
    } as MeResponseDto);
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{
        ...mockApiResponses.languageProfile.data,
        nativeLanguageCode: 'vi',
        targetLanguageCode: 'en',
        status: 'active',
        startingLevelEstimate: null, // explicitly unassessed
      }],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);
    setApiClient(api);

    render(
      <AuthProvider customClient={createMockSupabase(testSession)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="onboarding-content">Onboarding Flow</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('TEST-READY-04: ready learner with explicit ?mode=assessment is allowed on /onboarding', async () => {
    currentPathname = '/onboarding';
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/onboarding?mode=assessment') as unknown as Location;

    const api = new MockApiClient();
    vi.spyOn(api, 'getMe').mockResolvedValue({
      ...mockApiResponses.me,
      data: { ...mockApiResponses.me.data, timeZone: 'Asia/Ho_Chi_Minh' },
    } as MeResponseDto);
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, nativeLanguageCode: 'vi', targetLanguageCode: 'en', status: 'active' }],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);
    setApiClient(api);

    render(
      <AuthProvider customClient={createMockSupabase(testSession)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="onboarding-assessment">Assessment Mode</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-assessment')).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalledWith('/today');
  });

  it('TEST-READY-05: bootstrap network failure on product route displays retryable error without redirect loop', async () => {
    currentPathname = '/today';
    const api = new MockApiClient();
    vi.spyOn(api, 'getMe').mockRejectedValue(new Error('Network connection failure'));
    setApiClient(api);

    render(
      <AuthProvider customClient={createMockSupabase(testSession)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="today-dashboard">Today Dashboard</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Không thể kết nối hồ sơ/i)).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding');
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeEnabled();
  });

  it('redirects unauthenticated user accessing protected route to /auth', async () => {
    currentPathname = '/today';
    render(
      <AuthProvider customClient={createMockSupabase(null)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="today-dashboard">Today Dashboard</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    });
  });

  it('TEST-READY-06: redirects learner with active vi->en but dailyMinutes out of range (< 5) to /onboarding', async () => {
    currentPathname = '/today';
    const api = new MockApiClient();
    vi.spyOn(api, 'getMe').mockResolvedValue({
      ...mockApiResponses.me,
      data: { ...mockApiResponses.me.data, timeZone: 'Asia/Ho_Chi_Minh' },
    } as MeResponseDto);
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, nativeLanguageCode: 'vi', targetLanguageCode: 'en', status: 'active', dailyMinutes: 3 }],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);
    setApiClient(api);

    render(
      <AuthProvider customClient={createMockSupabase(testSession)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="protected-content">Protected Content</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding');
    });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('TEST-READY-07: redirects learner with active vi->en but invalid goal to /onboarding', async () => {
    currentPathname = '/today';
    const api = new MockApiClient();
    vi.spyOn(api, 'getMe').mockResolvedValue({
      ...mockApiResponses.me,
      data: { ...mockApiResponses.me.data, timeZone: 'Asia/Ho_Chi_Minh' },
    } as MeResponseDto);
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, nativeLanguageCode: 'vi', targetLanguageCode: 'en', status: 'active', goal: 'unknown-goal' as never }],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);
    setApiClient(api);

    render(
      <AuthProvider customClient={createMockSupabase(testSession)}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="protected-content">Protected Content</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding');
    });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('TEST-READY-08: actor race safety: stale Actor A response settling after Actor B bootstrap does not mutate B state', async () => {
    currentPathname = '/today';
    let authCallback: (event: string, session: unknown) => void = () => {};
    let resolveLateFetchA: (resp: Response) => void;
    const latePromiseA = new Promise<Response>((resolve) => {
      resolveLateFetchA = resolve;
    });

    const sessionA = {
      ...testSession,
      user: { ...testSession.user, id: 'user-a', email: 'user-a@example.test' },
    };
    const sessionB = {
      ...testSession,
      user: { ...testSession.user, id: 'user-b', email: 'user-b@example.test' },
    };

    const mockSupabase = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: sessionA }, error: null })),
        onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as unknown as SupabaseClient;

    let activeActor = 'user-a';
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (activeActor === 'user-a') {
        return latePromiseA;
      }
      if (url.includes('/v1/me/languages')) {
        return new Response(JSON.stringify({
          data: [{
            ...mockApiResponses.languageProfile.data,
            nativeLanguageCode: 'vi',
            targetLanguageCode: 'en',
            status: 'active',
            goal: 'communication',
            dailyMinutes: 25,
          }],
          meta: mockApiResponses.me.meta,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        ...mockApiResponses.me,
        data: { ...mockApiResponses.me.data, id: 'user-b', timeZone: 'Asia/Ho_Chi_Minh' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const client = new HttpApiClient({
      baseUrl: 'https://api.example.test',
      authTokenProvider: { getAccessToken: async () => 'test-token' },
      fetchFn,
      actorId: 'user-a',
    });
    setApiClient(client);

    render(
      <AuthProvider customClient={mockSupabase}>
        <AppRouteBoundary router={{ replace: mockReplace, push: mockPush }} pathname={currentPathname}>
          <div data-testid="today-dashboard">Today Dashboard</div>
        </AppRouteBoundary>
      </AuthProvider>
    );

    // Initial render initiates Actor A request (which hangs in latePromiseA)
    // Now simulate user login as User B
    activeActor = 'user-b';
    await act(async () => {
      authCallback('SIGNED_IN', sessionB);
    });

    // User B's bootstrap completes and renders protected dashboard
    await waitFor(() => {
      expect(screen.getByTestId('today-dashboard')).toBeInTheDocument();
    });

    // Now Actor A's stale response finally resolves
    resolveLateFetchA!(new Response(JSON.stringify({
      ...mockApiResponses.me,
      data: { ...mockApiResponses.me.data, id: 'user-a', timeZone: null },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    // Wait a tick to prove User B's state remains intact and LinguaActorAbortedError was silently discarded
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('today-dashboard')).toBeInTheDocument();
    expect(screen.queryByText(/Không thể kết nối hồ sơ/i)).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding');
  });
});
