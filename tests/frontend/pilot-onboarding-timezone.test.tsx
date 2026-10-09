import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { LiveOnboardingFlow } from '../../apps/web/src/features/onboarding/LiveOnboardingFlow';
import {
  HttpApiClient,
  mockApiResponses,
  type MeResponseDto,
} from '@lingua/types';

const learner = { id: '00000000-0000-4000-8000-000000000002', email: 'learner@example.test', role: 'authenticated' } as User;
const session = {
  access_token: 'synthetic-test-token',
  refresh_token: 'synthetic-test-refresh',
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: 'bearer',
  user: learner,
} as Session;

function supabaseClient(initialSession: Session | null): SupabaseClient {
  let current = initialSession;
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => { current = null; return { error: null }; }),
    },
  } as unknown as SupabaseClient;
}

function meBody(timeZone: string | null): MeResponseDto {
  return {
    ...mockApiResponses.me,
    data: { ...mockApiResponses.me.data, languageProfiles: [], displayName: null, timeZone },
  };
}

function createdLanguageProfile() {
  return {
    ...mockApiResponses.languageProfile,
    data: { ...mockApiResponses.languageProfile.data, startingLevelEstimate: null },
  };
}

function jsonResponse(body: unknown, etag?: string, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) },
  });
}

function responseQueue(responses: Response[]) {
  const pending = [...responses];
  return vi.fn<typeof fetch>(async () => pending.shift() ?? new Response(null, { status: 500 }));
}

function chooseLearningPlan() {
  fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
  fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
}

function clickCreateProfile() {
  chooseLearningPlan();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pilot onboarding timezone setup', () => {
  it('saves the detected zone from the normal setup CTA before creating the language profile', async () => {
    const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fetchFn = responseQueue([
      jsonResponse(meBody(null), '"me-r1"'),
      jsonResponse({ data: [], meta: mockApiResponses.me.meta }),
      jsonResponse(meBody(detectedZone), '"me-r2"'),
      jsonResponse(createdLanguageProfile(), '"language-r1"', 201),
    ]);
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={vi.fn()} /></AuthProvider>);

    await screen.findByText(/Chọn mục tiêu học tập/i);
    expect(screen.getByTestId('detected-timezone')).toHaveTextContent(detectedZone);
    expect(screen.queryByLabelText('Múi giờ')).not.toBeInTheDocument();
    expect(fetchFn.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      ['/v1/me', 'GET'],
      ['/v1/me/languages', 'GET'],
    ]);

    clickCreateProfile();

    await screen.findByText(/Ước lượng trình độ/i);
    expect(fetchFn.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      ['/v1/me', 'GET'],
      ['/v1/me/languages', 'GET'],
      ['/v1/me', 'PATCH'],
      ['/v1/me/languages', 'POST'],
    ]);
    expect(fetchFn.mock.calls[2]?.[1]?.headers).toMatchObject({
      'If-Match': '"me-r1"',
      Authorization: `Bearer ${session.access_token}`,
    });
    expect(JSON.parse(String(fetchFn.mock.calls[2]?.[1]?.body))).toEqual({ timeZone: detectedZone });
  });

  it('keeps an existing valid stored timezone and skips the profile PATCH', async () => {
    const storedZone = 'Europe/Paris';
    const fetchFn = responseQueue([
      jsonResponse(meBody(storedZone), '"me-stored"'),
      jsonResponse({ data: [], meta: mockApiResponses.me.meta }),
      jsonResponse(createdLanguageProfile(), '"language-r1"', 201),
    ]);
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={vi.fn()} /></AuthProvider>);

    await screen.findByText(/Chọn mục tiêu học tập/i);
    expect(screen.queryByTestId('detected-timezone')).not.toBeInTheDocument();
    clickCreateProfile();
    await screen.findByText(/Ước lượng trình độ/i);

    expect(fetchFn.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      ['/v1/me', 'GET'],
      ['/v1/me/languages', 'GET'],
      ['/v1/me/languages', 'POST'],
    ]);
    expect(fetchFn.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it.each(['invalid', 'throws'] as const)('offers a manual timezone selector when browser detection %s', async (failureMode) => {
    const formatterSpy = vi.spyOn(Intl, 'DateTimeFormat');
    if (failureMode === 'invalid') {
      formatterSpy.mockImplementationOnce(() => ({ resolvedOptions: () => ({ timeZone: 'Not/A_Zone' }) }) as Intl.DateTimeFormat);
    } else {
      formatterSpy.mockImplementationOnce(() => { throw new Error('timezone detection unavailable'); });
    }
    const detectedZone = (Intl as typeof Intl & { supportedValuesOf: (key: 'timeZone') => string[] })
      .supportedValuesOf('timeZone')
      .find((zone) => zone.startsWith('Asia/')) ?? 'UTC';
    const fetchFn = responseQueue([
      jsonResponse(meBody(null), '"me-r1"'),
      jsonResponse({ data: [], meta: mockApiResponses.me.meta }),
      jsonResponse(meBody(detectedZone), '"me-r2"'),
      jsonResponse(createdLanguageProfile(), '"language-r1"', 201),
    ]);
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={vi.fn()} /></AuthProvider>);

    await screen.findByText(/Chọn mục tiêu học tập/i);
    const zoneField = screen.getByLabelText('Múi giờ');
    clickCreateProfile();
    await screen.findByText(/Không nhận diện được múi giờ thiết bị/i);
    expect(fetchFn.mock.calls).toHaveLength(2);

    fireEvent.change(zoneField, { target: { value: detectedZone } });
    fireEvent.change(screen.getByLabelText('Tên hiển thị (tùy chọn)'), { target: { value: 'Minh An' } });
    clickCreateProfile();

    await screen.findByText(/Ước lượng trình độ/i);
    expect(JSON.parse(String(fetchFn.mock.calls[2]?.[1]?.body))).toEqual({ timeZone: detectedZone, displayName: 'Minh An' });
  });

  it('does not create a language profile when timezone persistence fails', async () => {
    const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fetchFn = responseQueue([
      jsonResponse(meBody(null), '"me-r1"'),
      jsonResponse({ data: [], meta: mockApiResponses.me.meta }),
      jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'Profile update failed', requestId: 'request-1' } }, undefined, 500),
    ]);
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={vi.fn()} /></AuthProvider>);

    await screen.findByText(/Chọn mục tiêu học tập/i);
    clickCreateProfile();
    await screen.findByRole('alert');

    expect(fetchFn.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      ['/v1/me', 'GET'],
      ['/v1/me/languages', 'GET'],
      ['/v1/me', 'PATCH'],
    ]);
    expect(fetchFn.mock.calls.some(([url, init]) => String(url) === '/v1/me/languages' && init?.method === 'POST')).toBe(false);
    expect(detectedZone).toBeTruthy();
  });

  it('refetches after a 412 without retrying the timezone write or creating the language profile', async () => {
    const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fetchFn = responseQueue([
      jsonResponse(meBody(null), '"me-r1"'),
      jsonResponse({ data: [], meta: mockApiResponses.me.meta }),
      jsonResponse({ error: { code: 'PRECONDITION_FAILED', message: 'stale', requestId: 'request-2' } }, undefined, 412),
      jsonResponse(meBody('Asia/Ho_Chi_Minh'), '"me-r2"'),
      jsonResponse({ data: [], meta: mockApiResponses.me.meta }),
      jsonResponse(createdLanguageProfile(), '"language-r1"', 201),
    ]);
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={vi.fn()} /></AuthProvider>);

    await screen.findByText(/Chọn mục tiêu học tập/i);
    clickCreateProfile();
    await screen.findByText(/Hồ sơ vừa thay đổi/i);
    expect(fetchFn.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      ['/v1/me', 'GET'],
      ['/v1/me/languages', 'GET'],
      ['/v1/me', 'PATCH'],
      ['/v1/me', 'GET'],
      ['/v1/me/languages', 'GET'],
    ]);

    // A new explicit setup click uses the refetched stored zone and performs only language creation.
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' }));
    await screen.findByText(/Ước lượng trình độ/i);
    expect(fetchFn.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
    expect(fetchFn.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(detectedZone).toBeTruthy();
  });
});
