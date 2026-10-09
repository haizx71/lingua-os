import React, { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  AuthProvider,
  AuthEntry,
  useAuth,
} from '../../apps/web/src/features/auth';
import { LiveOnboardingFlow } from '../../apps/web/src/features/onboarding/LiveOnboardingFlow';
import {
  MockApiClient,
  HttpApiClient,
  LinguaApiError,
  LinguaActorAbortedError,
  mockApiResponses,
  mockCompletedAssessmentSessionResponse,
  type ApiClient,
  type MeResponseDto,
  type LanguageProfilesResponseDto,
  type AssessmentSessionResponseDto,
} from '@lingua/types';

const user = { id: '00000000-0000-4000-8000-000000000002', email: 'learner@example.test', role: 'authenticated' } as User;
const session = { access_token: 'token', refresh_token: 'refresh', expires_in: 3600, expires_at: 9999999999, token_type: 'bearer', user } as Session;

function supabaseClient(initialSession: Session | null, signUpResultSession: Session | null = session): SupabaseClient {
  let current = initialSession;
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(async () => { current = session; return { data: { session, user }, error: null }; }),
      signUp: vi.fn(async () => { current = signUpResultSession; return { data: { session: signUpResultSession, user: signUpResultSession ? user : null }, error: null }; }),
      signOut: vi.fn(async () => { current = null; return { error: null }; }),
    },
  } as unknown as SupabaseClient;
}

function me(overrides: Partial<MeResponseDto['data']> = {}): MeResponseDto {
  return {
    ...mockApiResponses.me,
    data: { ...mockApiResponses.me.data, languageProfiles: [], timeZone: null, displayName: null, ...overrides },
  };
}

function apiForOnboarding(): ApiClient {
  const api = new MockApiClient();
  vi.spyOn(api, 'getMe').mockResolvedValue(me());
  vi.spyOn(api, 'updateMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
  vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({ data: [], meta: mockApiResponses.me.meta } as LanguageProfilesResponseDto);
  vi.spyOn(api, 'createMyLanguageProfile').mockResolvedValue({
    ...mockApiResponses.languageProfile,
    data: { ...mockApiResponses.languageProfile.data, startingLevelEstimate: null },
  });
  vi.spyOn(api, 'startStartingLevelAssessment').mockResolvedValue(mockApiResponses.assessment);
  vi.spyOn(api, 'submitStartingLevelResponse').mockResolvedValue(mockApiResponses.assessment);
  (api as ApiClient & { getLastEtag: (key: string) => string }).getLastEtag = () => '"profile-revision-1"';
  return api;
}

describe('TASK-017 live auth and onboarding boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  it('reactivates a collection-discovered child through HTTP after timezone confirmation, then remains safe on refresh', async () => {
    const child = { ...mockApiResponses.languageProfile.data, status: 'archived' as const, etag: '"opaque-child/E1"', startingLevelEstimate: null };
    const active = { ...child, status: 'active' as const, etag: '"opaque-child/E2"' };
    const json = (data: unknown, etag?: string) => new Response(JSON.stringify({ data, meta: mockApiResponses.me.meta }), { headers: etag ? { ETag: etag } : {} });
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(me().data, '"parent/M1"'))
      .mockResolvedValueOnce(json([child]))
      .mockResolvedValueOnce(json(me({ timeZone: 'Asia/Ho_Chi_Minh' }).data, '"parent/M2"'))
      .mockResolvedValueOnce(json([child]))
      .mockResolvedValueOnce(json(active, active.etag))
      .mockResolvedValueOnce(json(me({ timeZone: 'Asia/Ho_Chi_Minh' }).data, '"parent/M3"'))
      .mockResolvedValueOnce(json([active]));
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    const navigate = vi.fn();
    const view = render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={navigate} /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục thiết lập' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục hồ sơ tiếng Anh' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua đánh giá' }));
    expect(navigate).toHaveBeenCalledWith('/today');
    expect(fetchFn.mock.calls[2]?.[1]?.headers).toMatchObject({ 'If-Match': '"parent/M1"' });
    expect(fetchFn.mock.calls[4]).toEqual([`/v1/me/languages/${child.id}`, expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ status: 'active' }),
      headers: expect.objectContaining({ 'If-Match': child.etag, Authorization: 'Bearer token' }),
    })]);
    view.unmount();
    // A fresh transport has no cached header token; collection data is sufficient.
    const freshApi = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={freshApi} navigate={navigate} /></AuthProvider>);
    expect(await screen.findByRole('button', { name: 'Tới Today' })).toBeEnabled();
    expect(fetchFn.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    expect(fetchFn.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(2);
  });

  it('refetches the child on 412 and requires a second intentional reactivation with the new opaque ETag', async () => {
    const child = { ...mockApiResponses.languageProfile.data, status: 'archived' as const, etag: '"child-old"', startingLevelEstimate: null };
    const newer = { ...child, etag: '"child-new"' };
    const json = (data: unknown) => new Response(JSON.stringify({ data, meta: mockApiResponses.me.meta }));
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(me({ timeZone: 'Asia/Ho_Chi_Minh' }).data))
      .mockResolvedValueOnce(json([child]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'PRECONDITION_FAILED', message: 'private database error', requestId: mockApiResponses.me.meta.requestId } }), { status: 412 }))
      .mockResolvedValueOnce(json(me({ timeZone: 'Asia/Ho_Chi_Minh' }).data))
      .mockResolvedValueOnce(json([newer]))
      .mockResolvedValueOnce(json({ ...newer, status: 'active', etag: '"child-restored"' }));
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={vi.fn()} /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục hồ sơ tiếng Anh' }));
    expect(await screen.findByText(/hãy kiểm tra lại rồi khôi phục/i)).toBeInTheDocument();
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(screen.queryByText(/private database/i)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục hồ sơ tiếng Anh' }));
    expect(await screen.findByRole('button', { name: 'Bỏ qua đánh giá' })).toBeEnabled();
    const writes = fetchFn.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(writes).toHaveLength(2);
    expect(writes[0]?.[1]?.headers).toMatchObject({ 'If-Match': child.etag });
    expect(writes[1]?.[1]?.headers).toMatchObject({ 'If-Match': newer.etag });
    expect(fetchFn.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('keeps a failed stale-state refetch blocking without a duplicate-create or automatic PATCH fallback', async () => {
    const child = { ...mockApiResponses.languageProfile.data, status: 'archived' as const, etag: '"child-old"' };
    const json = (data: unknown) => new Response(JSON.stringify({ data, meta: mockApiResponses.me.meta }));
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(me({ timeZone: 'Asia/Ho_Chi_Minh' }).data))
      .mockResolvedValueOnce(json([child]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'PRECONDITION_FAILED' } }), { status: 412 }))
      .mockRejectedValueOnce(new TypeError('network unavailable'));
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={vi.fn()} /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục hồ sơ tiếng Anh' }));
    expect(await screen.findByRole('button', { name: 'Tải lại' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Tạo hồ sơ tiếng Anh' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Khôi phục hồ sơ tiếng Anh' })).not.toBeInTheDocument();
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it.each([null, mockApiResponses.languageProfile.data.startingLevelEstimate])('reconciles an already reactivated profile after 412 without losing the stale-state notice (%s)', async (estimate) => {
    const child = { ...mockApiResponses.languageProfile.data, status: 'archived' as const, etag: '"child-old"', startingLevelEstimate: estimate };
    const json = (data: unknown) => new Response(JSON.stringify({ data, meta: mockApiResponses.me.meta }));
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(me({ timeZone: 'Asia/Ho_Chi_Minh' }).data))
      .mockResolvedValueOnce(json([child]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'PRECONDITION_FAILED' } }), { status: 412 }))
      .mockResolvedValueOnce(json(me({ timeZone: 'Asia/Ho_Chi_Minh' }).data))
      .mockResolvedValueOnce(json([{ ...child, status: 'active', etag: '"child-new"' }]));
    const api = new HttpApiClient({ authTokenProvider: async () => session.access_token, fetchFn });
    const navigate = vi.fn();
    render(<AuthProvider customClient={supabaseClient(session)}><LiveOnboardingFlow apiClient={api} navigate={navigate} /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục hồ sơ tiếng Anh' }));
    expect(await screen.findByText(/hãy kiểm tra lại rồi khôi phục/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Khôi phục hồ sơ tiếng Anh' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Tới Today' }));
    expect(navigate).toHaveBeenCalledWith('/today');
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it('signs in with email/password and exposes the authenticated session', async () => {
    render(
      <AuthProvider customClient={supabaseClient(null)}>
        <AuthEntry />
      </AuthProvider>
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'learner@example.test' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'safe-password' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng nhập' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(screen.getByText(/Đăng nhập thành công/i)).toBeInTheDocument());
  });

  it('treats sign-up without an immediate session as a legitimate email-confirmation state', async () => {
    render(
      <AuthProvider customClient={supabaseClient(null, null)}>
        <AuthEntry />
      </AuthProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Chưa có tài khoản/i }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new-learner@example.test' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'safe-password' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng ký' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await waitFor(() => expect(screen.getByText(/xác minh email/i)).toBeInTheDocument());
    expect(screen.queryByText(/Đăng nhập thành công/i)).not.toBeInTheDocument();
  });

  it('bootstraps /me, saves the detected timezone from the profile setup CTA, and skips to today without assessment', async () => {
    const api = apiForOnboarding();
    const navigate = vi.fn();
    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={navigate} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    expect(screen.queryByRole('textbox', { name: 'Múi giờ' })).not.toBeInTheDocument();
    expect(screen.getByTestId('detected-timezone')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo hồ sơ tiếng Anh/i }));
    await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
    expect(api.updateMe).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ timeZone: expect.any(String) }),
      headers: { 'If-Match': '"profile-revision-1"' },
    }));
    expect(api.updateMe.mock.invocationCallOrder[0]).toBeLessThan(api.createMyLanguageProfile.mock.invocationCallOrder[0]);
    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua đánh giá/i }));
    expect(navigate).toHaveBeenCalledWith('/today');
    expect(api.startStartingLevelAssessment).not.toHaveBeenCalled();
  });

  it('starts/resumes and renders backend assessment state without client scoring', async () => {
    const api = apiForOnboarding();
    const completed: AssessmentSessionResponseDto = {
      ...mockCompletedAssessmentSessionResponse,
    } as AssessmentSessionResponseDto;
    vi.spyOn(api, 'submitStartingLevelResponse').mockResolvedValue(completed);
    const navigate = vi.fn();
    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={navigate} />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo hồ sơ tiếng Anh/i }));
    await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đánh giá/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Cuộc hẹn/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Cuộc hẹn/i }));
    await waitFor(() => expect(screen.getByText(/Starting Level Estimate/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục tới Today/i }));
    expect(navigate).toHaveBeenCalledWith('/today');
    expect(api.submitStartingLevelResponse).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ selectedOptionId: expect.any(String) }) }));
  });

  it('uses an actor-scoped stored assessment id only as a hint and resumes authoritative server state after refresh (TEST-PTR-01)', async () => {
    window.localStorage.setItem(`lingua:starting-level:active-assessment:${user.id}`, 'assessment-resume');
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);
    vi.spyOn(api, 'getStartingLevelAssessment').mockResolvedValue(mockApiResponses.assessment);

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Câu hỏi hiện tại do máy chủ quyết định/i)).toBeInTheDocument());
      expect(api.getStartingLevelAssessment).toHaveBeenCalledWith('assessment-resume');
      expect(screen.getByText(mockApiResponses.assessment.data.currentItem?.prompt ?? '')).toBeInTheDocument();
    } finally {
      window.localStorage.removeItem(`lingua:starting-level:active-assessment:${user.id}`);
    }
  });

  it('isolates foreign assessment pointers so User B does not resume User A assessment (TEST-PTR-02)', async () => {
    const foreignUserId = '00000000-0000-4000-8000-000000000099';
    window.localStorage.setItem(`lingua:starting-level:active-assessment:${foreignUserId}`, 'user-a-assessment');
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);
    vi.spyOn(api, 'getStartingLevelAssessment');

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Sẵn sàng bắt đầu/i)).toBeInTheDocument());
      expect(api.getStartingLevelAssessment).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(`lingua:starting-level:active-assessment:${foreignUserId}`)).toBe('user-a-assessment');
    } finally {
      window.localStorage.removeItem(`lingua:starting-level:active-assessment:${foreignUserId}`);
    }
  });

  it('fails open gracefully when storage throws quota error (TEST-PTR-04)', async () => {
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/onboarding?mode=assessment') as unknown as Location;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);
    vi.spyOn(api, 'startStartingLevelAssessment').mockResolvedValue(mockApiResponses.assessment);

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đánh giá/i }));
      await waitFor(() => expect(screen.getByText(/Câu hỏi hiện tại do máy chủ quyết định/i)).toBeInTheDocument());
      expect(api.startStartingLevelAssessment).toHaveBeenCalled();
    } finally {
      setItemSpy.mockRestore();
      window.location = new URL('http://localhost/') as unknown as Location;
    }
  });

  it('fails closed without duplicate creation if a malformed archived response omits its required child ETag', async () => {
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'archived', startingLevelEstimate: null, etag: undefined }],
      meta: mockApiResponses.languageProfile.meta,
    } as unknown as LanguageProfilesResponseDto);
    (api as ApiClient & { getLastEtag: () => undefined }).getLastEtag = () => undefined;

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Hồ sơ tiếng Anh đã lưu trữ/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Chưa có phiên bản để khôi phục/i })).toBeDisabled();
    expect(api.createMyLanguageProfile).not.toHaveBeenCalled();
  });

  it('reconciles 409 CONFLICT on language profile creation by adopting authoritative active profile without error banner (TEST-LANG-04)', async () => {
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    const listSpy = vi.spyOn(api, 'listMyLanguageProfiles')
      .mockResolvedValueOnce({ data: [], meta: mockApiResponses.languageProfile.meta } as LanguageProfilesResponseDto)
      .mockResolvedValueOnce({
        data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
        meta: mockApiResponses.languageProfile.meta,
      } as LanguageProfilesResponseDto);

    vi.spyOn(api, 'createMyLanguageProfile').mockRejectedValue(
      new LinguaApiError({ code: 'CONFLICT', httpStatus: 409 })
    );

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo hồ sơ tiếng Anh/i }));

    await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
    expect(screen.queryByText(/xung đột/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('reconciles 409 CONFLICT on language profile creation by transitioning to reactivation UI when archived profile is found (TEST-LANG-05)', async () => {
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    const listSpy = vi.spyOn(api, 'listMyLanguageProfiles')
      .mockResolvedValueOnce({ data: [], meta: mockApiResponses.languageProfile.meta } as LanguageProfilesResponseDto)
      .mockResolvedValueOnce({
        data: [{ ...mockApiResponses.languageProfile.data, status: 'archived', etag: '"archived-etag-1"' }],
        meta: mockApiResponses.languageProfile.meta,
      } as LanguageProfilesResponseDto);

    vi.spyOn(api, 'createMyLanguageProfile').mockRejectedValue(
      new LinguaApiError({ code: 'CONFLICT', httpStatus: 409 })
    );

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo hồ sơ tiếng Anh/i }));

    await waitFor(() => expect(screen.getByText(/Hồ sơ tiếng Anh đã lưu trữ/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Khôi phục hồ sơ tiếng Anh/i })).toBeEnabled();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('fails closed with fatal error banner on 409 IDEMPOTENCY_KEY_REUSED without silent reconciliation (TEST-LANG-06)', async () => {
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    const listSpy = vi.spyOn(api, 'listMyLanguageProfiles')
      .mockResolvedValueOnce({ data: [], meta: mockApiResponses.languageProfile.meta } as LanguageProfilesResponseDto);

    vi.spyOn(api, 'createMyLanguageProfile').mockRejectedValue(
      new LinguaApiError({ code: 'IDEMPOTENCY_KEY_REUSED', httpStatus: 409 })
    );

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo hồ sơ tiếng Anh/i }));

    await waitFor(() => expect(screen.getByText(/Yêu cầu này đã được dùng cho một thao tác khác/i)).toBeInTheDocument());
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('renders styled textSnippet stimulus for reading questions (TEST-STIM-01)', async () => {
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/onboarding?mode=assessment') as unknown as Location;
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    const assessmentWithReading = {
      ...mockApiResponses.assessment,
      data: {
        ...mockApiResponses.assessment.data,
        currentItem: {
          ...mockApiResponses.assessment.data.currentItem!,
          textSnippet: 'Đây là đoạn văn mẫu đọc hiểu cho người học.',
        },
      },
    };
    vi.spyOn(api, 'startStartingLevelAssessment').mockResolvedValue(assessmentWithReading);

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đánh giá/i }));
      await waitFor(() => expect(screen.getByTestId('assessment-text-snippet')).toBeInTheDocument());
      expect(screen.getByText('Đây là đoạn văn mẫu đọc hiểu cho người học.')).toBeInTheDocument();
    } finally {
      window.location = new URL('http://localhost/') as unknown as Location;
    }
  });

  it('renders accessible audio player with audioUrl for listening questions (TEST-STIM-02)', async () => {
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/onboarding?mode=assessment') as unknown as Location;
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    const assessmentWithListening = {
      ...mockApiResponses.assessment,
      data: {
        ...mockApiResponses.assessment.data,
        currentItem: {
          ...mockApiResponses.assessment.data.currentItem!,
          audioUrl: 'https://assets.lingua-os.dev/audio/diag-listening-01.mp3',
        },
      },
    };
    vi.spyOn(api, 'startStartingLevelAssessment').mockResolvedValue(assessmentWithListening);

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đánh giá/i }));
      await waitFor(() => expect(screen.getByTestId('assessment-audio-player')).toBeInTheDocument());
      const playBtn = screen.getByRole('button', { name: 'Phát đoạn âm thanh bài nghe' });
      expect(playBtn).toBeInTheDocument();
      const audioElement = screen.getByTestId('assessment-audio-player').querySelector('audio');
      expect(audioElement).toHaveAttribute('src', 'https://assets.lingua-os.dev/audio/diag-listening-01.mp3');
    } finally {
      window.location = new URL('http://localhost/') as unknown as Location;
    }
  });

  it('resets audio playback on question transition (TEST-STIM-03)', async () => {
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/onboarding?mode=assessment') as unknown as Location;
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    const q1 = {
      ...mockApiResponses.assessment,
      data: {
        ...mockApiResponses.assessment.data,
        currentItem: {
          ...mockApiResponses.assessment.data.currentItem!,
          id: 'item-q1',
          audioUrl: 'https://assets.lingua-os.dev/audio/q1.mp3',
        },
      },
    };
    const q2 = {
      ...mockApiResponses.assessment,
      data: {
        ...mockApiResponses.assessment.data,
        currentItem: {
          ...mockApiResponses.assessment.data.currentItem!,
          id: 'item-q2',
          audioUrl: 'https://assets.lingua-os.dev/audio/q2.mp3',
        },
      },
    };
    vi.spyOn(api, 'startStartingLevelAssessment').mockResolvedValue(q1);
    vi.spyOn(api, 'submitStartingLevelResponse').mockResolvedValue(q2);

    const pauseSpy = vi.fn();
    window.HTMLMediaElement.prototype.pause = pauseSpy;
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đánh giá/i }));
      await waitFor(() => expect(screen.getByTestId('assessment-audio-player')).toBeInTheDocument());

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Phát đoạn âm thanh bài nghe' }));
      });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Tạm dừng đoạn âm thanh bài nghe' })).toBeInTheDocument());

      fireEvent.click(screen.getAllByRole('button', { name: /Cuộc hẹn/i })[0]);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Phát đoạn âm thanh bài nghe' })).toBeInTheDocument());
      expect(pauseSpy).toHaveBeenCalled();
    } finally {
      window.location = new URL('http://localhost/') as unknown as Location;
    }
  });

  it('supports keyboard interaction for audio player controls (TEST-STIM-04)', async () => {
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/onboarding?mode=assessment') as unknown as Location;
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    const assessmentWithListening = {
      ...mockApiResponses.assessment,
      data: {
        ...mockApiResponses.assessment.data,
        currentItem: {
          ...mockApiResponses.assessment.data.currentItem!,
          audioUrl: 'https://assets.lingua-os.dev/audio/diag-listening-01.mp3',
        },
      },
    };
    vi.spyOn(api, 'startStartingLevelAssessment').mockResolvedValue(assessmentWithListening);
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đánh giá/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Phát đoạn âm thanh bài nghe' })).toBeInTheDocument());

      const playBtn = screen.getByRole('button', { name: 'Phát đoạn âm thanh bài nghe' });
      playBtn.focus();
      expect(document.activeElement).toBe(playBtn);
      await act(async () => {
        fireEvent.click(playBtn);
      });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Tạm dừng đoạn âm thanh bài nghe' })).toBeInTheDocument());
    } finally {
      window.location = new URL('http://localhost/') as unknown as Location;
    }
  });

  it('displays non-blocking error alert when audio fails to play (TEST-STIM-05)', async () => {
    delete (window as unknown as { location: unknown }).location;
    window.location = new URL('http://localhost/onboarding?mode=assessment') as unknown as Location;
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'active', startingLevelEstimate: null }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    const assessmentWithListening = {
      ...mockApiResponses.assessment,
      data: {
        ...mockApiResponses.assessment.data,
        currentItem: {
          ...mockApiResponses.assessment.data.currentItem!,
          audioUrl: 'https://assets.lingua-os.dev/audio/diag-listening-01.mp3',
        },
      },
    };
    vi.spyOn(api, 'startStartingLevelAssessment').mockResolvedValue(assessmentWithListening);
    window.HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new Error('Audio playback error'));

    try {
      render(
        <AuthProvider customClient={supabaseClient(session)}>
          <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu đánh giá/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Phát đoạn âm thanh bài nghe' })).toBeInTheDocument());

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Phát đoạn âm thanh bài nghe' }));
      });
      await waitFor(() => expect(screen.getByText(/Không thể phát âm thanh/i)).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Cuộc hẹn/i })).toBeEnabled();
    } finally {
      window.location = new URL('http://localhost/') as unknown as Location;
    }
  });

  it('TEST-PAUSED-01: bootstrap with paused vi->en profile presents resume UI and no create form', async () => {
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [{ ...mockApiResponses.languageProfile.data, status: 'paused', etag: '"paused-etag-1"' }],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Hồ sơ tiếng Anh đang tạm dừng/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Tiếp tục lộ trình tiếng Anh/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Tạo hồ sơ tiếng Anh/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Chọn mục tiêu học tập/i)).not.toBeInTheDocument();
  });

  it('TEST-PAUSED-02: 409 CONFLICT on create reconciles to paused recovery UI without duplicate POST', async () => {
    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    const listSpy = vi.spyOn(api, 'listMyLanguageProfiles')
      .mockResolvedValueOnce({ data: [], meta: mockApiResponses.languageProfile.meta } as LanguageProfilesResponseDto)
      .mockResolvedValueOnce({
        data: [{ ...mockApiResponses.languageProfile.data, status: 'paused', etag: '"paused-etag-conflict"' }],
        meta: mockApiResponses.languageProfile.meta,
      } as LanguageProfilesResponseDto);

    const createSpy = vi.spyOn(api, 'createMyLanguageProfile').mockRejectedValue(
      new LinguaApiError({ code: 'CONFLICT', httpStatus: 409 })
    );

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo hồ sơ tiếng Anh/i }));

    await waitFor(() => expect(screen.getByText(/Hồ sơ tiếng Anh đang tạm dừng/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Tiếp tục lộ trình tiếng Anh/i })).toBeEnabled();
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenCalledTimes(1); // No duplicate POST after paused row is known
  });

  it('TEST-PAUSED-03: resume paused profile sends PATCH with same ID and child ETag', async () => {
    const paused = { ...mockApiResponses.languageProfile.data, status: 'paused' as const, etag: '"paused-child-etag"' };
    const active = { ...paused, status: 'active' as const, etag: '"active-child-etag"' };

    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [paused],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    const updateSpy = vi.spyOn(api, 'updateMyLanguageProfile').mockResolvedValue({
      data: active,
      meta: mockApiResponses.languageProfile.meta,
    });

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Hồ sơ tiếng Anh đang tạm dừng/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục lộ trình tiếng Anh/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        languageProfileId: paused.id,
        body: { status: 'active' },
        headers: { 'If-Match': paused.etag },
      });
    });
  });

  it('TEST-PAUSED-04: 412 PRECONDITION_FAILED during paused resume refetches without automatic second PATCH', async () => {
    const paused = { ...mockApiResponses.languageProfile.data, status: 'paused' as const, etag: '"paused-stale-etag"' };
    const refreshed = { ...paused, etag: '"paused-fresh-etag"' };

    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    const listSpy = vi.spyOn(api, 'listMyLanguageProfiles')
      .mockResolvedValueOnce({ data: [paused], meta: mockApiResponses.languageProfile.meta } as LanguageProfilesResponseDto)
      .mockResolvedValueOnce({ data: [refreshed], meta: mockApiResponses.languageProfile.meta } as LanguageProfilesResponseDto);

    const updateSpy = vi.spyOn(api, 'updateMyLanguageProfile').mockRejectedValue(
      new LinguaApiError({ code: 'PRECONDITION_FAILED', httpStatus: 412 })
    );

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Hồ sơ tiếng Anh đang tạm dừng/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục lộ trình tiếng Anh/i }));

    await waitFor(() => {
      expect(screen.getByText(/Hồ sơ vừa thay đổi\. Đã tải dữ liệu mới/i)).toBeInTheDocument();
    });
    // Exactly 1 PATCH call: no automatic second PATCH!
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('TEST-PAUSED-05: paused resume success transitions to authoritative active state', async () => {
    const paused = { ...mockApiResponses.languageProfile.data, status: 'paused' as const, etag: '"paused-etag"', startingLevelEstimate: null };
    const active = { ...paused, status: 'active' as const, etag: '"active-etag"' };

    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [paused],
      meta: mockApiResponses.languageProfile.meta,
    } as LanguageProfilesResponseDto);

    vi.spyOn(api, 'updateMyLanguageProfile').mockResolvedValue({
      data: active,
      meta: mockApiResponses.languageProfile.meta,
    });

    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Hồ sơ tiếng Anh đang tạm dừng/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục lộ trình tiếng Anh/i }));

    // Upon activating an unestimated active profile, advances to ASSESSMENT_CHOICE
    await waitFor(() => {
      expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Bỏ qua đánh giá/i })).toBeEnabled();
  });

  it('TEST-ACTOR-RACE-01: late Actor A bootstrap response discarding via LinguaActorAbortedError does not overwrite Actor B state', async () => {
    let rejectLateRequestA: (err: Error) => void;
    const pendingPromiseA = new Promise<never>((_, reject) => {
      rejectLateRequestA = reject;
    });
    pendingPromiseA.catch(() => {});

    const api = apiForOnboarding();
    let currentActor = 'user-a';
    vi.spyOn(api, 'getMe').mockImplementation(async () => {
      if (currentActor === 'user-b') {
        return me({ timeZone: 'Asia/Ho_Chi_Minh' });
      }
      return pendingPromiseA;
    });

    const sessionA = {
      ...session,
      user: { ...session.user, id: 'user-a', email: 'user-a@example.test' },
    };
    const sessionB = {
      ...session,
      user: { ...session.user, id: 'user-b', email: 'user-b@example.test' },
    };

    const { rerender } = render(
      <AuthProvider customClient={supabaseClient(sessionA)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    // Switch actor to B
    currentActor = 'user-b';
    api.setActor?.('user-b');
    rerender(
      <AuthProvider customClient={supabaseClient(sessionB)}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    // User B's bootstrap completes and shows language profile creation
    await waitFor(() => {
      expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument();
    });

    // Stale in-flight request under Actor A now rejects with LinguaActorAbortedError
    rejectLateRequestA!(new LinguaActorAbortedError());

    // Wait a tick to prove B's stage and UI are not corrupted
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument();
    expect(screen.queryByText(/Yêu cầu đã bị hủy do thay đổi tài khoản/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa thể tiếp tục/i)).not.toBeInTheDocument();
  });

  function controllableSupabaseClient(initialSession: Session | null) {
    let currentSession = initialSession;
    const listeners: Array<(event: string, session: Session | null) => void> = [];
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
        onAuthStateChange: vi.fn((callback) => {
          listeners.push(callback);
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  const idx = listeners.indexOf(callback);
                  if (idx >= 0) listeners.splice(idx, 1);
                },
              },
            },
          };
        }),
        signInWithPassword: vi.fn(async () => ({ data: { session: currentSession, user: currentSession?.user ?? null }, error: null })),
        signUp: vi.fn(async () => ({ data: { session: currentSession, user: currentSession?.user ?? null }, error: null })),
        signOut: vi.fn(async () => {
          currentSession = null;
          listeners.forEach((cb) => cb('SIGNED_OUT', null));
          return { error: null };
        }),
      },
    } as unknown as SupabaseClient;
    return {
      client,
      emit: (event: string, s: Session | null) => {
        currentSession = s;
        listeners.forEach((cb) => cb(event, s));
      },
    };
  }

  it('TEST-ACTOR-LIFECYCLE-01: stale Actor A mutation finally block does not prematurely clear Actor B busy state', async () => {
    let resolveMutationA: (val: unknown) => void;
    const mutationPromiseA = new Promise((resolve) => {
      resolveMutationA = resolve;
    });

    let resolveMutationB: (val: unknown) => void;
    const mutationPromiseB = new Promise((resolve) => {
      resolveMutationB = resolve;
    });

    const api = apiForOnboarding();
    let currentActor = 'user-a';
    const createSpy = vi.mocked(api.createMyLanguageProfile);

    vi.spyOn(api, 'updateMe').mockImplementation(async () => {
      if (currentActor === 'user-a') {
        return mutationPromiseA as ReturnType<ApiClient['updateMe']>;
      }
      return mutationPromiseB as ReturnType<ApiClient['updateMe']>;
    });

    const sessionA = {
      ...session,
      user: { ...session.user, id: 'user-a', email: 'user-a@example.test' },
    };
    const sessionB = {
      ...session,
      user: { ...session.user, id: 'user-b', email: 'user-b@example.test' },
    };

    const mockAuth = controllableSupabaseClient(sessionA);

    render(
      <AuthProvider customClient={mockAuth.client}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    // User A boots directly to language setup; its ordinary CTA starts the timezone PATCH.
    await screen.findByText(/Chọn mục tiêu học tập/i);
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' }));
    expect(screen.getByRole('button', { name: 'Đang tạo...' })).toBeDisabled();

    // While mutation A is in flight, active actor switches to User B
    currentActor = 'user-b';
    await act(async () => {
      mockAuth.emit('SIGNED_IN', sessionB);
    });

    // User B boots directly to language setup and starts an independent setup operation.
    await screen.findByText(/Chọn mục tiêu học tập/i);
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' }));
    expect(screen.getByRole('button', { name: 'Đang tạo...' })).toBeDisabled();
    expect(createSpy).not.toHaveBeenCalled();

    // Now Actor A's stale mutation finally settles
    resolveMutationA!(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    await new Promise((r) => setTimeout(r, 30));

    // CRITICAL (DEF-03-R1): Actor B must STILL be busy! Actor A's finally block must NOT have cleared busy
    expect(screen.getByRole('button', { name: 'Đang tạo...' })).toBeDisabled();
    expect(createSpy).not.toHaveBeenCalled();

    // Now Actor B's mutation settles
    resolveMutationB!(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    await waitFor(() => {
      expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument();
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('TEST-ACTOR-LIFECYCLE-02: stale Actor A mutation error does not commit error banner or mutate Actor B state', async () => {
    let rejectMutationA: (err: unknown) => void;
    const mutationPromiseA = new Promise((_, reject) => {
      rejectMutationA = reject;
    });
    mutationPromiseA.catch(() => {});

    const api = apiForOnboarding();
    let currentActor = 'user-a';

    vi.spyOn(api, 'updateMe').mockImplementation(async () => {
      if (currentActor === 'user-a') {
        return mutationPromiseA as ReturnType<ApiClient['updateMe']>;
      }
      return me({ timeZone: 'Asia/Ho_Chi_Minh' });
    });

    const sessionA = {
      ...session,
      user: { ...session.user, id: 'user-a', email: 'user-a@example.test' },
    };
    const sessionB = {
      ...session,
      user: { ...session.user, id: 'user-b', email: 'user-b@example.test' },
    };

    const mockAuth = controllableSupabaseClient(sessionA);

    render(
      <AuthProvider customClient={mockAuth.client}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    await screen.findByText(/Chọn mục tiêu học tập/i);
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' }));
    expect(screen.getByRole('button', { name: 'Đang tạo...' })).toBeDisabled();

    // Switch to Actor B
    currentActor = 'user-b';
    await act(async () => {
      mockAuth.emit('SIGNED_IN', sessionB);
    });

    // Actor B boots to language setup without starting a write.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' })).toBeEnabled();
    });

    // Now Actor A's stale mutation fails with a server error
    rejectMutationA!(new LinguaApiError({ code: 'INTERNAL_ERROR', httpStatus: 500 }));
    await new Promise((r) => setTimeout(r, 50));

    // Assert: No error banner on Actor B's UI
    expect(screen.queryByText(/Chưa thể tiếp tục/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hồ sơ vừa thay đổi/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' })).toBeEnabled();
  });

  it('TEST-ACTOR-LIFECYCLE-03: stale Actor A mutation success does not commit Actor A profile or advance Actor B stage', async () => {
    let resolveCreateA: (val: unknown) => void;
    const createPromiseA = new Promise((resolve) => {
      resolveCreateA = resolve;
    });

    const api = apiForOnboarding();
    vi.spyOn(api, 'createMyLanguageProfile').mockImplementation(async () => {
      return createPromiseA as ReturnType<ApiClient['createMyLanguageProfile']>;
    });

    // Configure user A to have timezone so it reaches LANGUAGE_PROFILE_REQUIRED
    vi.spyOn(api, 'getMe').mockImplementation(async () => {
      return me({ timeZone: 'Asia/Ho_Chi_Minh' });
    });

    const sessionA = {
      ...session,
      user: { ...session.user, id: 'user-a', email: 'user-a@example.test' },
    };
    const sessionB = {
      ...session,
      user: { ...session.user, id: 'user-b', email: 'user-b@example.test' },
    };

    const mockAuth = controllableSupabaseClient(sessionA);

    render(
      <AuthProvider customClient={mockAuth.client}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    // User A is on LANGUAGE_PROFILE_REQUIRED
    await screen.findByText(/Chọn mục tiêu học tập/i);
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo hồ sơ tiếng Anh' }));

    expect(screen.getByRole('button', { name: 'Đang tạo...' })).toBeDisabled();

    // Now switch to Actor B; the detected timezone will be saved only after the setup CTA.
    vi.spyOn(api, 'getMe').mockImplementation(async () => {
      return me({ timeZone: null });
    });
    await act(async () => {
      mockAuth.emit('SIGNED_IN', sessionB);
    });

    // Actor B boots to language setup.
    await waitFor(() => {
      expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument();
    });

    // Now Actor A's stale creation resolves HTTP 200 with an estimated profile
    resolveCreateA!({
      ...mockApiResponses.languageProfile,
      data: {
        ...mockApiResponses.languageProfile.data,
        id: 'profile-user-a',
        startingLevelEstimate: 'b1',
      },
    });
    await new Promise((r) => setTimeout(r, 50));

    // Actor B stays on language setup; the stale profile result cannot advance its stage.
    expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument();
    expect(screen.queryByText(/Chào mừng bạn trở lại/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bắt đầu đánh giá/i })).not.toBeInTheDocument();
  });

  it('TEST-ACTOR-LIFECYCLE-04: stale Actor A 412 Precondition Failed does not trigger recovery bootstrap or banners for Actor B', async () => {
    let rejectResumeA: (err: unknown) => void;
    const resumePromiseA = new Promise((_, reject) => {
      rejectResumeA = reject;
    });
    resumePromiseA.catch(() => {});

    const pausedProfileA = {
      ...mockApiResponses.languageProfile.data,
      id: 'profile-a-paused',
      status: 'paused' as const,
      etag: '"etag-paused-a"',
      startingLevelEstimate: null,
    };

    const api = apiForOnboarding();
    vi.spyOn(api, 'getMe').mockResolvedValue(me({ timeZone: 'Asia/Ho_Chi_Minh' }));
    const listProfilesSpy = vi.spyOn(api, 'listMyLanguageProfiles').mockResolvedValue({
      data: [pausedProfileA],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);

    vi.spyOn(api, 'updateMyLanguageProfile').mockImplementation(async () => {
      return resumePromiseA as ReturnType<ApiClient['updateMyLanguageProfile']>;
    });

    const sessionA = {
      ...session,
      user: { ...session.user, id: 'user-a', email: 'user-a@example.test' },
    };
    const sessionB = {
      ...session,
      user: { ...session.user, id: 'user-b', email: 'user-b@example.test' },
    };

    const mockAuth = controllableSupabaseClient(sessionA);

    render(
      <AuthProvider customClient={mockAuth.client}>
        <LiveOnboardingFlow apiClient={api} navigate={vi.fn()} />
      </AuthProvider>
    );

    const resumeBtnA = await screen.findByRole('button', { name: 'Tiếp tục lộ trình tiếng Anh' });
    fireEvent.click(resumeBtnA);
    expect(screen.getByRole('button', { name: 'Đang kích hoạt lại...' })).toBeDisabled();

    // Now switch to Actor B; for Actor B, listMyLanguageProfiles returns empty (so LANGUAGE_PROFILE_REQUIRED with no paused profile)
    listProfilesSpy.mockResolvedValue({
      data: [],
      meta: mockApiResponses.me.meta,
    } as LanguageProfilesResponseDto);

    const getMeSpy = vi.spyOn(api, 'getMe');

    await act(async () => {
      mockAuth.emit('SIGNED_IN', sessionB);
    });

    await waitFor(() => {
      expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument();
    });
    const getMeCallsAfterBSync = getMeSpy.mock.calls.length;

    // Stale Actor A mutation rejects with 412 PRECONDITION_FAILED
    rejectResumeA!(new LinguaApiError({ code: 'PRECONDITION_FAILED', httpStatus: 412 }));
    await new Promise((r) => setTimeout(r, 50));

    // Assert: No recovery banner on Actor B
    expect(screen.queryByText(/Hồ sơ vừa thay đổi/i)).not.toBeInTheDocument();
    // Assert: getMe was NOT called again as part of Actor A's 412 recovery
    expect(getMeSpy.mock.calls.length).toBe(getMeCallsAfterBSync);
  });

  it('TEST-ACTOR-LIFECYCLE-05: same-actor session refresh preserves actorEpoch, ETag cache, and in-flight operation validity', async () => {
    let capturedEpochInitial = 0;
    let capturedEpochAfterRefresh = 0;
    let isInitialOpValidAfterRefresh: boolean | null = null;

    function TestProbe({ onMount }: { onMount: (auth: ReturnType<typeof useAuth>) => void }) {
      const auth = useAuth();
      useEffect(() => {
        onMount(auth);
      }, [auth, onMount]);
      return <div data-testid="probe">epoch: {auth.actorEpoch}</div>;
    }

    const sessionA = {
      ...session,
      user: { ...session.user, id: 'user-a', email: 'user-a@example.test' },
    };
    const sessionARefreshed = {
      ...sessionA,
      access_token: 'new-token-same-user',
    };

    const mockAuth = controllableSupabaseClient(sessionA);
    let latestAuth: ReturnType<typeof useAuth> | null = null;

    render(
      <AuthProvider customClient={mockAuth.client}>
        <TestProbe onMount={(a) => { latestAuth = a; }} />
      </AuthProvider>
    );

    await screen.findByTestId('probe');
    capturedEpochInitial = latestAuth!.getActorEpoch();
    const opInitial = {
      epoch: capturedEpochInitial,
      actorId: 'user-a',
    };

    // Trigger same-actor token refresh
    await act(async () => {
      mockAuth.emit('TOKEN_REFRESHED', sessionARefreshed);
    });
    await waitFor(() => {
      capturedEpochAfterRefresh = latestAuth!.getActorEpoch();
    });

    // Epoch must be UNCHANGED
    expect(capturedEpochAfterRefresh).toBe(capturedEpochInitial);

    // Initial operation must STILL be considered current/valid
    isInitialOpValidAfterRefresh = latestAuth!.isCurrentActor(opInitial.epoch, opInitial.actorId);
    expect(isInitialOpValidAfterRefresh).toBe(true);

    // Now switch to actor B and confirm epoch DOES advance and initial op is invalidated
    const sessionB = {
      ...session,
      user: { ...session.user, id: 'user-b', email: 'user-b@example.test' },
    };
    await act(async () => {
      mockAuth.emit('SIGNED_IN', sessionB);
    });
    await waitFor(() => {
      expect(latestAuth!.getActorEpoch()).toBeGreaterThan(capturedEpochInitial);
    });
    expect(latestAuth!.isCurrentActor(opInitial.epoch, opInitial.actorId)).toBe(false);
  });
});
