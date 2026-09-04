import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  AuthProvider,
  AuthEntry,
} from '../../apps/web/src/features/auth';
import { LiveOnboardingFlow } from '../../apps/web/src/features/onboarding/LiveOnboardingFlow';
import {
  MockApiClient,
  HttpApiClient,
  LinguaApiError,
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
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận múi giờ' }));
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

  it('bootstraps /me, confirms timezone, creates vi-to-en profile, and skips to today without assessment', async () => {
    const api = apiForOnboarding();
    const navigate = vi.fn();
    render(
      <AuthProvider customClient={supabaseClient(session)}>
        <LiveOnboardingFlow apiClient={api} navigate={navigate} />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Xác nhận múi giờ/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận múi giờ/i }));
    await waitFor(() => expect(screen.getByText(/Chọn mục tiêu học tập/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /25 phút/i }));
    fireEvent.click(screen.getByRole('button', { name: /Giao tiếp/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo hồ sơ tiếng Anh/i }));
    await waitFor(() => expect(screen.getByText(/Đánh giá trình độ khởi điểm/i)).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText(/Xác nhận múi giờ/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận múi giờ/i }));
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
});
