import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthProvider } from '../../apps/web/src/features/auth/AuthContext';
import { AppRouteBoundary } from '../../apps/web/src/components/auth/AppRouteBoundary';
import { setApiClient } from '../../apps/web/src/lib/api/client';
import {
  MockApiClient,
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
});
