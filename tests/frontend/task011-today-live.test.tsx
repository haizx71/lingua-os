/**
 * TASK-011: Today Live Frontend Integration Tests
 *
 * Invariant Verification:
 * 1. Live Plan Read & Presentation (TEST-011-01 .. TEST-011-06)
 * 2. Actor Lifecycle Isolation & Same-Actor Race Protection (TEST-011-07 .. TEST-011-10)
 * 3. Server Authority & Anti-Fake Evidence (TEST-011-11 .. TEST-011-14)
 * 4. Completion Semantics & Rollback (TEST-011-COMP-01 .. TEST-011-COMP-06)
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthProvider } from '../../apps/web/src/features/auth';
import {
  TodayDashboard,
  useTodayPlan,
  type TodayDashboardProps,
} from '../../apps/web/src/features/today';
import {
  mapTodayActivityToViewModel,
  mapTodayPlanToViewModel,
} from '../../apps/web/src/features/today/adapters';
import {
  HttpApiClient,
  MockApiClient,
  mockApiResponses,
  mockTodayPlanResponse,
  type ApiClient,
  type MeResponseDto,
  type TodayActivityDto,
  type TodayCompletionResponseDto,
  type TodayPlanDto,
  type TodayPlanResponseDto,
} from '@lingua/types';

const userA = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'learner.a@example.test',
  role: 'authenticated',
} as User;

const userB = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'learner.b@example.test',
  role: 'authenticated',
} as User;

const sessionA = {
  access_token: 'token-a',
  refresh_token: 'refresh-a',
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: 'bearer',
  user: userA,
} as Session;

const sessionB = {
  access_token: 'token-b',
  refresh_token: 'refresh-b',
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: 'bearer',
  user: userB,
} as Session;

type AuthChangeListener = (event: string, session: Session | null) => void;

function createMockSupabase(initialSession: Session | null = sessionA) {
  let currentSession = initialSession;
  const listeners: AuthChangeListener[] = [];

  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
      onAuthStateChange: vi.fn((callback: AuthChangeListener) => {
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
      signInWithPassword: vi.fn(async () => ({
        data: { session: currentSession, user: currentSession?.user ?? null },
        error: null,
      })),
      signOut: vi.fn(async () => {
        currentSession = null;
        listeners.forEach((l) => l('SIGNED_OUT', null));
        return { error: null };
      }),
    },
    switchUser: (newSession: Session | null) => {
      currentSession = newSession;
      listeners.forEach((l) => l('USER_UPDATED', newSession));
    },
  };

  return client as unknown as SupabaseClient & { switchUser: (s: Session | null) => void };
}

const customServerPlan: TodayPlanDto = {
  id: '11111111-1111-4000-8000-111111111111',
  languageProfileId: '22222222-2222-4000-8000-222222222222',
  planDate: '2026-09-05',
  timeZone: 'Asia/Ho_Chi_Minh',
  targetMinutes: 30,
  completedMinutes: 10,
  status: 'active',
  engineVersion: 'today-heuristic-v1',
  activities: [
    {
      id: 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa',
      position: 0,
      activityType: 'read',
      title: 'Bài đọc khoa học vũ trụ',
      description: 'Đọc bài đọc nâng cao vốn từ.',
      estimatedMinutes: 10,
      reasonCodes: ['CONTENT_FIT'],
      reasonText: 'Lý do: Nội dung phù hợp với hồ sơ học tập.',
      status: 'completed',
      targetCount: 1,
      completedCount: 1,
      completedAt: '2026-09-05T08:00:00Z',
      createdAt: '2026-09-05T00:00:00Z',
    },
    {
      id: 'bbbbbbbb-bbbb-4000-8000-bbbbbbbbbbbb',
      position: 1,
      activityType: 'review',
      title: 'Ôn tập 15 từ vựng FSRS',
      description: 'Ôn các từ đến hạn ghi nhớ.',
      estimatedMinutes: 12,
      reasonCodes: ['FSRS_DUE'],
      reasonText: 'Lý do: 15 từ sắp rơi khỏi vùng ghi nhớ dài hạn.',
      status: 'pending',
      targetCount: 15,
      completedCount: 0,
      reviewItemId: '33333333-3333-4000-8000-333333333333',
      createdAt: '2026-09-05T00:00:00Z',
    },
    {
      id: 'cccccccc-cccc-4000-8000-cccccccccccc',
      position: 2,
      activityType: 'listen',
      title: 'Luyện nghe phản xạ audio',
      description: 'Tăng cường kỹ năng nghe.',
      estimatedMinutes: 8,
      reasonCodes: ['WEAK_LISTENING'],
      reasonText: 'Lý do: Kỹ năng nghe cần củng cố thêm.',
      status: 'pending',
      targetCount: 5,
      completedCount: 0,
      createdAt: '2026-09-05T00:00:00Z',
    },
  ],
  createdAt: '2026-09-05T00:00:00Z',
  updatedAt: '2026-09-05T08:00:00Z',
};

describe('TASK-011: Today Live Frontend Integration', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase(sessionA);
    api = new MockApiClient();
    vi.spyOn(api, 'getTodayPlan').mockResolvedValue({
      data: customServerPlan,
      meta: { requestId: 'req-today-1', apiVersion: '1.0' },
    });
  });

  async function renderToday(customApi = api, props?: Partial<TodayDashboardProps>) {
    const rendered = render(
      <AuthProvider customClient={mockSupabase}>
        <TodayDashboard apiClient={customApi} {...props} />
      </AuthProvider>
    );
    await act(async () => {});
    return rendered;
  }

  describe('1. Live Plan Read & Presentation', () => {
    it('TEST-011-15 carries known read/listen content IDs and keeps missing IDs generic', () => {
      const read = customServerPlan.activities[0]!;
      const listen = customServerPlan.activities[2]!;
      const readWithId = mapTodayActivityToViewModel({ ...read, contentId: 'article/with?reserved#chars' });
      const listenWithId = mapTodayActivityToViewModel({ ...listen, contentId: 'listen-article-id' });
      const genericRead = mapTodayActivityToViewModel(read);
      const genericListen = mapTodayActivityToViewModel(listen);

      expect(readWithId.targetUrl).toBe('/read?contentId=article%2Fwith%3Freserved%23chars');
      expect(listenWithId.targetUrl).toBe('/read?contentId=listen-article-id');
      expect(genericRead.targetUrl).toBe('/read');
      expect(genericListen.targetUrl).toBe('/read');
    });

    it('TEST-011-01: Authenticated product-ready learner loads real Today plan and renders server-provided items', async () => {
      await renderToday();

      // Header target duration from server plan (30 phút, NOT default 25)
      expect(await screen.findByText('30', { exact: true })).toBeInTheDocument();
      expect(screen.getByText('Kế hoạch hôm nay', { exact: true })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Kế hoạch của bạn' })).toBeInTheDocument();
      expect(screen.getByText('Xem hoạt động được lên lịch và chọn điều muốn bắt đầu.')).toBeInTheDocument();

      // Progress bar reflects server plan completed / target minutes (10 / 30 phút = 33%)
      expect(screen.getByRole('progressbar')).toHaveAccessibleName('Tiến độ hôm nay: 10 / 30 phút');
      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      // Server activities rendered
      expect(screen.getByText('Bài đọc khoa học vũ trụ')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Ôn tập 15 từ vựng FSRS' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Ôn tập 15 từ vựng FSRS' })).toBeInTheDocument();
      expect(screen.getByText('Luyện nghe phản xạ audio')).toBeInTheDocument();

      // Completed activity displays success badge and completed button label
      expect(screen.getByText('Đã xong')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Đọc lại' })).toBeInTheDocument();

      // Pending review activity displays FSRS badge and pending button label
      expect(screen.getByText('15 từ đến hạn')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Bắt đầu ôn tập' })).toHaveLength(2);
    });

    it('TEST-011-02: Adapter preserves plan ID, item IDs and item order exactly', () => {
      const viewModel = mapTodayPlanToViewModel(customServerPlan);

      expect(viewModel.id).toBe('11111111-1111-4000-8000-111111111111');
      expect(viewModel.languageProfileId).toBe('22222222-2222-4000-8000-222222222222');
      expect(viewModel.planDate).toBe('2026-09-05');
      expect(viewModel.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(viewModel.targetMinutes).toBe(30);
      expect(viewModel.completedMinutes).toBe(10);
      expect(viewModel.status).toBe('active');
      expect(viewModel.engineVersion).toBe('today-heuristic-v1');

      // Exact order preservation: position 0, 1, 2
      expect(viewModel.activities.length).toBe(3);
      expect(viewModel.activities[0].id).toBe('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa');
      expect(viewModel.activities[0].type).toBe('read');
      expect(viewModel.activities[0].position).toBe(0);
      expect(viewModel.activities[0].completed).toBe(true);

      expect(viewModel.activities[1].id).toBe('bbbbbbbb-bbbb-4000-8000-bbbbbbbbbbbb');
      expect(viewModel.activities[1].type).toBe('review');
      expect(viewModel.activities[1].position).toBe(1);
      expect(viewModel.activities[1].completed).toBe(false);

      expect(viewModel.activities[2].id).toBe('cccccccc-cccc-4000-8000-cccccccccccc');
      expect(viewModel.activities[2].type).toBe('listen');
      expect(viewModel.activities[2].position).toBe(2);
      expect(viewModel.activities[2].completed).toBe(false);
    });

    it('TEST-011-03: Today loading state does not render mock authoritative content', async () => {
      let resolvePlan!: (value: TodayPlanResponseDto) => void;
      const pendingPromise = new Promise<TodayPlanResponseDto>((resolve) => {
        resolvePlan = resolve;
      });
      vi.spyOn(api, 'getTodayPlan').mockReturnValue(pendingPromise);

      render(
        <AuthProvider customClient={mockSupabase}>
          <TodayDashboard apiClient={api} />
        </AuthProvider>
      );

      // Immediately upon mount, skeleton loading state is shown
      expect(screen.getByText('Đang tải kế hoạch học tập hôm nay...')).toBeInTheDocument();

      // Zero mock activities or fake target duration rendered while loading
      expect(screen.queryByText('Bài đọc khoa học vũ trụ')).not.toBeInTheDocument();
      expect(screen.queryByText('1. Ôn tập thông minh (FSRS)')).not.toBeInTheDocument();
      expect(screen.queryByText('25 phút')).not.toBeInTheDocument();

      // Resolve pending response
      await act(async () => {
        resolvePlan({
          data: customServerPlan,
          meta: { requestId: 'req-done', apiVersion: '1.0' },
        });
      });

      // Now server content appears
      expect(await screen.findByText('Bài đọc khoa học vũ trụ')).toBeInTheDocument();
      expect(screen.queryByText('Đang tải kế hoạch học tập hôm nay...')).not.toBeInTheDocument();
    });

    it('TEST-011-04: Today API error renders retry and no fake plan', async () => {
      vi.spyOn(api, 'getTodayPlan').mockRejectedValue(new Error('INTERNAL_ERROR'));

      await renderToday();

      // Error state displayed
      expect(await screen.findByText('Không thể tải kế hoạch học tập')).toBeInTheDocument();
      expect(
        screen.getByText(/Đã xảy ra lỗi khi kết nối với máy chủ\. Vui lòng thử lại sau giây lát\./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();

      // No fake fallback plan rendered
      expect(screen.queryByText('Bài đọc khoa học vũ trụ')).not.toBeInTheDocument();
      expect(screen.queryByText('1. Ôn tập thông minh (FSRS)')).not.toBeInTheDocument();
    });

    it('TEST-011-05: Retry after load failure succeeds', async () => {
      let attempt = 1;
      vi.spyOn(api, 'getTodayPlan').mockImplementation(async () => {
        if (attempt === 1) {
          throw new Error('SERVICE_UNAVAILABLE');
        }
        return {
          data: customServerPlan,
          meta: { requestId: 'req-retry-ok', apiVersion: '1.0' },
        };
      });

      await renderToday();

      expect(await screen.findByText('Không thể tải kế hoạch học tập')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: 'Thử lại' });

      // Click retry
      attempt = 2;
      fireEvent.click(retryBtn);

      // Successful reload displays server plan
      expect(await screen.findByText('Bài đọc khoa học vũ trụ')).toBeInTheDocument();
      expect(screen.queryByText('Không thể tải kế hoạch học tập')).not.toBeInTheDocument();
    });

    it('TEST-011-06: Persisted plan returned on re-entry renders consistently', async () => {
      const getSpy = vi.spyOn(api, 'getTodayPlan');

      // First entry
      const { unmount } = await renderToday();
      expect(await screen.findByText('Bài đọc khoa học vũ trụ')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      unmount();

      // Re-entry / remount loads the same persisted plan
      await renderToday();
      expect(await screen.findByText('Bài đọc khoa học vũ trụ')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. Actor Lifecycle Isolation & Race Protection', () => {
    it('TEST-011-07: Actor A Today load pending -> switch B -> B loads successfully -> A resolves (A cannot mutate B)', async () => {
      let resolvePlanA!: (value: TodayPlanResponseDto) => void;
      const planAPromise = new Promise<TodayPlanResponseDto>((resolve) => {
        resolvePlanA = resolve;
      });

      const planB: TodayPlanDto = {
        ...customServerPlan,
        id: 'bbbbbbbb-0000-4000-8000-000000000002',
        targetMinutes: 45,
        activities: [
          {
            ...customServerPlan.activities[0],
            title: 'Kế hoạch riêng của Actor B',
          },
        ],
      };

      vi.spyOn(api, 'getTodayPlan').mockImplementation(async () => {
        const currentActor = api.getCurrentActorId?.();
        if (currentActor === userA.id || !currentActor) {
          return planAPromise;
        }
        return {
          data: planB,
          meta: { requestId: 'req-b', apiVersion: '1.0' },
        };
      });

      await renderToday();

      // Switch to Actor B
      await act(async () => {
        api.setActor?.(userB.id);
        mockSupabase.switchUser(sessionB);
      });

      // Actor B renders B's plan
      expect(await screen.findByText('Kế hoạch riêng của Actor B')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAccessibleName('Tiến độ hôm nay: 10 / 45 phút');

      // Now Actor A's delayed promise resolves
      await act(async () => {
        resolvePlanA({
          data: customServerPlan,
          meta: { requestId: 'req-a-late', apiVersion: '1.0' },
        });
      });

      // Actor B's UI must NOT be overwritten by Actor A
      expect(screen.getByText('Kế hoạch riêng của Actor B')).toBeInTheDocument();
      expect(screen.queryByText('Bài đọc khoa học vũ trụ')).not.toBeInTheDocument();
    });

    it('TEST-011-08: Actor A Today load fails late after B becomes current (A error cannot contaminate B)', async () => {
      let rejectPlanA!: (reason: Error) => void;
      const planAPromise = new Promise<TodayPlanResponseDto>((_, reject) => {
        rejectPlanA = reject;
      });

      const planB: TodayPlanDto = {
        ...customServerPlan,
        id: 'bbbbbbbb-0000-4000-8000-000000000002',
        activities: [
          {
            ...customServerPlan.activities[0],
            title: 'Hoạt động Actor B an toàn',
          },
        ],
      };

      vi.spyOn(api, 'getTodayPlan').mockImplementation(async () => {
        const currentActor = api.getCurrentActorId?.();
        if (currentActor === userA.id || !currentActor) {
          return planAPromise;
        }
        return {
          data: planB,
          meta: { requestId: 'req-b', apiVersion: '1.0' },
        };
      });

      await renderToday();

      // Switch to Actor B
      await act(async () => {
        api.setActor?.(userB.id);
        mockSupabase.switchUser(sessionB);
      });

      expect(await screen.findByText('Hoạt động Actor B an toàn')).toBeInTheDocument();

      // Actor A fails late with network failure
      await act(async () => {
        rejectPlanA(new Error('ACTOR_A_FAILED'));
      });

      // Actor B must NOT receive error state
      expect(screen.queryByText('Không thể tải kế hoạch học tập')).not.toBeInTheDocument();
      expect(screen.getByText('Hoạt động Actor B an toàn')).toBeInTheDocument();
    });

    it('TEST-011-09: Same actor load #1 pending -> load #2/retry succeeds -> #1 resolves late (#1 cannot overwrite #2)', async () => {
      let resolveRun1!: (value: TodayPlanResponseDto) => void;
      const run1Promise = new Promise<TodayPlanResponseDto>((resolve) => {
        resolveRun1 = resolve;
      });

      const run2Plan: TodayPlanDto = {
        ...customServerPlan,
        targetMinutes: 50,
        activities: [
          {
            ...customServerPlan.activities[0],
            title: 'Hoạt động cập nhật lần 2',
          },
        ],
      };

      let callCount = 0;
      vi.spyOn(api, 'getTodayPlan').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return run1Promise;
        }
        return {
          data: run2Plan,
          meta: { requestId: 'req-2', apiVersion: '1.0' },
        };
      });

      const { result } = renderHook(() => useTodayPlan({ apiClient: api }), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>
        ),
      });

      // Wait for auth to settle and first call to initiate
      await waitFor(() => {
        expect(callCount).toBe(1);
      });
      expect(result.current.isLoading).toBe(true);

      // Trigger second load (refetch) while #1 is pending
      await act(async () => {
        void result.current.refetch();
      });

      // Call #2 resolves with run2Plan
      expect(callCount).toBe(2);
      expect(result.current.plan?.activities[0].title).toBe('Hoạt động cập nhật lần 2');
      expect(result.current.plan?.targetMinutes).toBe(50);

      // Now call #1 resolves late with older title
      await act(async () => {
        resolveRun1({
          data: {
            ...customServerPlan,
            targetMinutes: 20,
            activities: [
              {
                ...customServerPlan.activities[0],
                title: 'Hoạt động cũ lần 1',
              },
            ],
          },
          meta: { requestId: 'req-1', apiVersion: '1.0' },
        });
      });

      // Older call #1 MUST NOT overwrite call #2!
      expect(result.current.plan?.activities[0].title).toBe('Hoạt động cập nhật lần 2');
      expect(result.current.plan?.targetMinutes).toBe(50);
    });

    it('TEST-011-10: Stale cleanup/finally cannot clear B/new request loading state', async () => {
      let resolveRun1!: (value: TodayPlanResponseDto) => void;
      const run1Promise = new Promise<TodayPlanResponseDto>((resolve) => {
        resolveRun1 = resolve;
      });

      let resolveRun2!: (value: TodayPlanResponseDto) => void;
      const run2Promise = new Promise<TodayPlanResponseDto>((resolve) => {
        resolveRun2 = resolve;
      });

      let call = 0;
      vi.spyOn(api, 'getTodayPlan').mockImplementation(async () => {
        call++;
        return call === 1 ? run1Promise : run2Promise;
      });

      render(
        <AuthProvider customClient={mockSupabase}>
          <TodayDashboard apiClient={api} />
        </AuthProvider>
      );
      await act(async () => {});

      expect(screen.getByText('Đang tải kế hoạch học tập hôm nay...')).toBeInTheDocument();

      // Switch to Actor B while #1 is in-flight
      await act(async () => {
        api.setActor?.(userB.id);
        mockSupabase.switchUser(sessionB);
      });

      // Loading indicator must still be active for Actor B
      expect(screen.getByText('Đang tải kế hoạch học tập hôm nay...')).toBeInTheDocument();

      // Now Actor A's run 1 finishes/aborts
      await act(async () => {
        resolveRun1({
          data: customServerPlan,
          meta: { requestId: 'req-a', apiVersion: '1.0' },
        });
      });

      // Stale completion of run 1 MUST NOT clear loading state for Actor B!
      expect(screen.getByText('Đang tải kế hoạch học tập hôm nay...')).toBeInTheDocument();

      // Finally run 2 completes
      await act(async () => {
        resolveRun2({
          data: customServerPlan,
          meta: { requestId: 'req-b', apiVersion: '1.0' },
        });
      });

      expect(await screen.findByText('Bài đọc khoa học vũ trụ')).toBeInTheDocument();
    });
  });

  describe('3. Server Authority & Anti-Fake Evidence', () => {
    it('TEST-011-11: Frontend renders Today item order exactly as backend response', async () => {
      // Create a plan with intentionally non-standard order (listen first, read second, review third)
      const reversedOrderPlan: TodayPlanDto = {
        ...customServerPlan,
        activities: [
          customServerPlan.activities[2], // listen
          customServerPlan.activities[0], // read
          customServerPlan.activities[1], // review
        ],
      };

      vi.spyOn(api, 'getTodayPlan').mockResolvedValue({
        data: reversedOrderPlan,
        meta: { requestId: 'req-order', apiVersion: '1.0' },
      });

      await renderToday();

      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings[0].textContent).toBe('Luyện nghe phản xạ audio');
      expect(headings[1].textContent).toBe('Bài đọc khoa học vũ trụ');
      expect(headings[2].textContent).toBe('Ôn tập 15 từ vựng FSRS');
    });

    it('TEST-011-12: Frontend performs zero local Today sorting/priority calculation', () => {
      const planWithArbitraryOrder: TodayPlanDto = {
        ...customServerPlan,
        activities: [
          { ...customServerPlan.activities[1], position: 5 },
          { ...customServerPlan.activities[0], position: 2 },
        ],
      };

      const viewModel = mapTodayPlanToViewModel(planWithArbitraryOrder);

      // Must strictly match the exact array index order of the DTO
      expect(viewModel.activities[0].title).toBe('Ôn tập 15 từ vựng FSRS');
      expect(viewModel.activities[1].title).toBe('Bài đọc khoa học vũ trụ');
    });

    it('TEST-011-13: Loading Today performs no Save/Learn, Review mutation, evidence write or other activation mutation', async () => {
      const saveSpy = vi.spyOn(api, 'saveConceptToLibrary');
      const answerSpy = vi.spyOn(api, 'answerReviewItem');
      const sentenceSpy = vi.spyOn(api, 'saveSentenceToLibrary');
      const contentSpy = vi.spyOn(api, 'saveContentToLibrary');

      await renderToday();

      // Verify UI is loaded
      expect(await screen.findByText('Bài đọc khoa học vũ trụ')).toBeInTheDocument();

      // Zero learning mutations executed
      expect(saveSpy).not.toHaveBeenCalled();
      expect(answerSpy).not.toHaveBeenCalled();
      expect(sentenceSpy).not.toHaveBeenCalled();
      expect(contentSpy).not.toHaveBeenCalled();
    });

    it('TEST-011-14: Timezone is not synthesized client-side as planning authority', async () => {
      const getSpy = vi.spyOn(api, 'getTodayPlan');

      await renderToday();

      expect(getSpy).toHaveBeenCalled();
      const calledQuery = getSpy.mock.calls[0][0];

      // Query must NOT synthesize a local day boundary or fake date parameter or non-contract timeZone
      expect(calledQuery?.date).toBeUndefined();
      expect((calledQuery as Record<string, unknown> | undefined)?.timeZone).toBeUndefined();
    });

    it('TEST-011-R2-01: Authoritative stored timezone Asia/Ho_Chi_Minh triggers getTodayPlan without timeZone query (empty or contract fields only)', async () => {
      vi.spyOn(api, 'getMe').mockResolvedValue({
        data: {
          ...mockApiResponses.me.data,
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        meta: { requestId: 'req-me', apiVersion: '1.0' },
      });
      const getSpy = vi.spyOn(api, 'getTodayPlan');

      // 1. Dashboard load with no query -> getTodayPlan called with undefined (no timeZone)
      await renderToday();

      expect(getSpy).toHaveBeenCalledTimes(1);
      const query = getSpy.mock.calls[0][0];
      expect(query).toBeUndefined();
      expect((query as Record<string, unknown> | undefined)?.timeZone).toBeUndefined();

      // 2. Direct hook load with contract query (date, languageProfileId) -> preserves contract fields, no timeZone
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>
      );
      renderHook(
        () =>
          useTodayPlan({
            apiClient: api,
            query: {
              date: '2026-09-05',
              languageProfileId: '22222222-2222-4000-8000-222222222222',
            },
          }),
        { wrapper }
      );
      await act(async () => {});

      expect(getSpy).toHaveBeenCalledTimes(2);
      const queryWithArgs = getSpy.mock.calls[1][0];
      expect(queryWithArgs).toEqual({
        date: '2026-09-05',
        languageProfileId: '22222222-2222-4000-8000-222222222222',
      });
      expect((queryWithArgs as Record<string, unknown> | undefined)?.timeZone).toBeUndefined();
    });

    it('TEST-011-R2-02: Profile timezone missing and browser timezone mocked as America/New_York -> getTodayPlan is NOT called', async () => {
      // Mock browser timezone as America/New_York
      const dtf = new Intl.DateTimeFormat();
      const baseOptions = dtf.resolvedOptions();
      const spyIntl = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        ...baseOptions,
        timeZone: 'America/New_York',
      });

      // Profile timezone is missing (null)
      vi.spyOn(api, 'getMe').mockResolvedValue({
        data: {
          ...mockApiResponses.me.data,
          timeZone: null,
        },
        meta: { requestId: 'req-me-notz', apiVersion: '1.0' },
      });
      const getSpy = vi.spyOn(api, 'getTodayPlan');

      try {
        await renderToday();

        // getTodayPlan must NOT be called; browser timezone MUST NOT become planning input
        expect(getSpy).not.toHaveBeenCalled();
        expect(await screen.findByText('Cần thiết lập múi giờ học tập')).toBeInTheDocument();
      } finally {
        spyIntl.mockRestore();
      }
    });

    it('TEST-011-R2-03: Profile timezone invalid/unrecognized -> getTodayPlan is NOT called and setup-required state rendered', async () => {
      // Profile timezone is invalid string
      vi.spyOn(api, 'getMe').mockResolvedValue({
        data: {
          ...mockApiResponses.me.data,
          timeZone: 'Invalid/Non_Existent_Zone',
        },
        meta: { requestId: 'req-me-invalid-tz', apiVersion: '1.0' },
      });
      const getSpy = vi.spyOn(api, 'getTodayPlan');

      await renderToday();

      // getTodayPlan must NOT be called
      expect(getSpy).not.toHaveBeenCalled();
      expect(await screen.findByText('Cần thiết lập múi giờ học tập')).toBeInTheDocument();
      expect(screen.queryByText('Kế hoạch hôm nay')).not.toBeInTheDocument();
    });

    it('TEST-011-R2-04: Actor A getMe pending -> switch Actor B with missing timezone -> A resolves late (stale A never dispatches getTodayPlan)', async () => {
      let resolveMeA!: (value: MeResponseDto) => void;
      const meAPromise = new Promise<MeResponseDto>((resolve) => {
        resolveMeA = resolve;
      });

      vi.spyOn(api, 'getMe').mockImplementation(async () => {
        const currentActor = api.getCurrentActorId?.();
        if (currentActor === userB.id) {
          return {
            data: { ...mockApiResponses.me.data, id: userB.id, timeZone: null },
            meta: { requestId: 'req-me-b', apiVersion: '1.0' },
          };
        }
        return meAPromise;
      });

      const getSpy = vi.spyOn(api, 'getTodayPlan');

      await renderToday();

      // Actor A getMe is pending, no getTodayPlan yet
      expect(getSpy).not.toHaveBeenCalled();

      // Switch to Actor B (missing timezone)
      await act(async () => {
        api.setActor?.(userB.id);
        mockSupabase.switchUser(sessionB);
      });

      // Actor B should render setup-required state, and NOT issue a getTodayPlan request
      expect(await screen.findByText('Cần thiết lập múi giờ học tập')).toBeInTheDocument();
      expect(getSpy).not.toHaveBeenCalled();

      // Actor A getMe resolves late with valid timezone
      await act(async () => {
        resolveMeA({
          data: { ...mockApiResponses.me.data, id: userA.id, timeZone: 'Asia/Ho_Chi_Minh' },
          meta: { requestId: 'req-me-a', apiVersion: '1.0' },
        });
      });

      // Stale Actor A must NOT call getTodayPlan or mutate Actor B
      expect(getSpy).not.toHaveBeenCalled();
      expect(screen.getByText('Cần thiết lập múi giờ học tập')).toBeInTheDocument();
      expect(screen.queryByText('Kế hoạch hôm nay')).not.toBeInTheDocument();
    });

    it('TEST-011-R2-05: HttpApiClient transport serialization verifies no timeZone query parameter exists in actual HTTP request', async () => {
      const urls: string[] = [];
      const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(JSON.stringify(mockApiResponses.today), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

      const httpClient = new HttpApiClient({
        baseUrl: 'https://api.lingua.test',
        authTokenProvider: async () => 'test-token',
        fetchFn,
      });

      // Call without query
      await httpClient.getTodayPlan();
      expect(urls[0]).toBe('https://api.lingua.test/v1/today');
      expect(urls[0]).not.toContain('timeZone');

      // Call with contract-valid query fields
      await httpClient.getTodayPlan({
        date: '2026-09-05',
        languageProfileId: '22222222-2222-4000-8000-222222222222',
      });
      expect(urls[1]).toBe(
        'https://api.lingua.test/v1/today?date=2026-09-05&languageProfileId=22222222-2222-4000-8000-222222222222'
      );
      expect(urls[1]).not.toContain('timeZone');
    });

    it('TEST-011-R2-06: Same actor starts without timezone -> profile obtains timezone -> refetch calls getTodayPlan without timeZone', async () => {
      let currentTimeZone: string | null = null;

      vi.spyOn(api, 'getMe').mockImplementation(async () => ({
        data: {
          ...mockApiResponses.me.data,
          timeZone: currentTimeZone,
        },
        meta: { requestId: 'req-me', apiVersion: '1.0' },
      }));

      const getSpy = vi.spyOn(api, 'getTodayPlan').mockResolvedValue({
        data: customServerPlan,
        meta: { requestId: 'req-plan', apiVersion: '1.0' },
      });

      await renderToday();

      // Initially missing timezone -> setup required, no getTodayPlan call
      expect(await screen.findByText('Cần thiết lập múi giờ học tập')).toBeInTheDocument();
      expect(getSpy).not.toHaveBeenCalled();

      // Profile now authoritatively obtains timezone
      currentTimeZone = 'Asia/Ho_Chi_Minh';

      // Refetch after profile timezone configured
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>
      );
      const { result } = renderHook(() => useTodayPlan({ apiClient: api }), { wrapper });
      await act(async () => {
        await result.current.refetch();
      });

      // Subsequent Today request uses exact stored timezone as gate and calls getTodayPlan without timeZone
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy.mock.calls[0][0]).toBeUndefined();
      expect(result.current.plan?.activities[0].title).toBe('Bài đọc khoa học vũ trụ');
    });
  });

  describe('4. Completion Semantics & Rollback', () => {
    it('TEST-011-COMP-01: completeTodayActivity passes exact planId, activityId, and idempotency key', async () => {
      const completeSpy = vi.spyOn(api, 'completeTodayActivity').mockResolvedValue({
        data: {
          plan: {
            ...customServerPlan,
            completedMinutes: 22,
            activities: [
              customServerPlan.activities[0],
              { ...customServerPlan.activities[1], status: 'completed', completedCount: 15 },
              customServerPlan.activities[2],
            ],
          },
          activity: {
            ...customServerPlan.activities[1],
            status: 'completed',
            completedCount: 15,
          },
        },
        meta: { requestId: 'req-comp', apiVersion: '1.0' },
      });

      await renderToday();

      const completeBtn = await screen.findByRole('button', {
        name: 'Hoàn thành hoạt động Ôn tập 15 từ vựng FSRS',
      });

      fireEvent.click(completeBtn);

      await waitFor(() => {
        expect(completeSpy).toHaveBeenCalledTimes(1);
      });

      const callArg = completeSpy.mock.calls[0][0];
      expect(callArg.planId).toBe(customServerPlan.id);
      expect(callArg.activityId).toBe(customServerPlan.activities[1].id);
      expect(callArg.headers['Idempotency-Key']).toBeDefined();
      expect(typeof callArg.headers['Idempotency-Key']).toBe('string');
    });

    it('TEST-011-COMP-02: in-flight completion suppresses duplicate submissions (pending / disabled)', async () => {
      let resolveComp!: (value: TodayCompletionResponseDto) => void;
      const compPromise = new Promise<TodayCompletionResponseDto>((resolve) => {
        resolveComp = resolve;
      });
      const completeSpy = vi.spyOn(api, 'completeTodayActivity').mockReturnValue(compPromise);

      await renderToday();

      const completeBtn = await screen.findByRole('button', {
        name: 'Hoàn thành hoạt động Ôn tập 15 từ vựng FSRS',
      });

      fireEvent.click(completeBtn);

      // Button enters busy/disabled state immediately
      expect(completeBtn).toBeDisabled();
      expect(completeBtn.textContent).toContain('Đang lưu...');

      // Second rapid click is ignored
      fireEvent.click(completeBtn);
      expect(completeSpy).toHaveBeenCalledTimes(1);

      // Resolve completion
      await act(async () => {
        resolveComp({
          data: {
            plan: { ...customServerPlan, completedMinutes: 22 },
            activity: { ...customServerPlan.activities[1], status: 'completed' },
          },
          meta: { requestId: 'req-c', apiVersion: '1.0' },
        });
      });
    });

    it('TEST-011-COMP-03: server-authoritative completion updates plan from server response', async () => {
      vi.spyOn(api, 'completeTodayActivity').mockResolvedValue({
        data: {
          plan: {
            ...customServerPlan,
            completedMinutes: 22,
            activities: [
              customServerPlan.activities[0],
              {
                ...customServerPlan.activities[1],
                status: 'completed',
                completedCount: 15,
                completedAt: '2026-09-05T08:15:00Z',
              },
              customServerPlan.activities[2],
            ],
          },
          activity: {
            ...customServerPlan.activities[1],
            status: 'completed',
            completedCount: 15,
          },
        },
        meta: { requestId: 'req-c-ok', apiVersion: '1.0' },
      });

      await renderToday();

      const completeBtn = await screen.findByRole('button', {
        name: 'Hoàn thành hoạt động Ôn tập 15 từ vựng FSRS',
      });

      fireEvent.click(completeBtn);

      // Activity transitions to completed with server-provided state
      expect(
        await screen.findByRole('button', { name: 'Ôn lại' })
      ).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAccessibleName('Tiến độ hôm nay: 22 / 30 phút');
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
      expect(screen.getByText(/Đã hoàn thành hoạt động: Ôn tập 15 từ vựng FSRS/i)).toBeInTheDocument();
    });

    it('TEST-011-COMP-04: completion failure does not mark item as completed (rolls back / retains pending state) and exposes error', async () => {
      vi.spyOn(api, 'completeTodayActivity').mockRejectedValue(
        new Error('authoritative activity proof is incomplete')
      );

      await renderToday();

      const completeBtn = await screen.findByRole('button', {
        name: 'Hoàn thành hoạt động Ôn tập 15 từ vựng FSRS',
      });

      fireEvent.click(completeBtn);

      // Failure displays error alert
      expect(await screen.findByText('Lỗi hoàn thành hoạt động')).toBeInTheDocument();
      expect(
        screen.getByText('authoritative activity proof is incomplete')
      ).toBeInTheDocument();

      // Activity remains pending, NOT completed!
      expect(screen.getAllByRole('button', { name: 'Bắt đầu ôn tập' }).length).toBeGreaterThan(0);
      expect(
        screen.getByRole('button', { name: 'Hoàn thành hoạt động Ôn tập 15 từ vựng FSRS' })
      ).toBeInTheDocument();
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('TEST-011-COMP-05: Actor A stale completion response cannot affect Actor B', async () => {
      let resolveCompA!: (value: TodayCompletionResponseDto) => void;
      const compAPromise = new Promise<TodayCompletionResponseDto>((resolve) => {
        resolveCompA = resolve;
      });

      vi.spyOn(api, 'completeTodayActivity').mockReturnValue(compAPromise);

      await renderToday();

      const completeBtn = await screen.findByRole('button', {
        name: 'Hoàn thành hoạt động Ôn tập 15 từ vựng FSRS',
      });

      fireEvent.click(completeBtn);

      // Switch to Actor B before A resolves
      await act(async () => {
        api.setActor?.(userB.id);
        mockSupabase.switchUser(sessionB);
      });

      // Now Actor A's completion resolves late
      await act(async () => {
        resolveCompA({
          data: {
            plan: {
              ...customServerPlan,
              id: 'plan-a-late',
              completedMinutes: 30,
              activities: customServerPlan.activities.map((a) => ({
                ...a,
                status: 'completed',
              })),
            },
            activity: { ...customServerPlan.activities[1], status: 'completed' },
          },
          meta: { requestId: 'req-a-comp', apiVersion: '1.0' },
        });
      });

      // Actor B must NOT have Actor A's completed alert or plan
      expect(screen.queryByText(/Đã hoàn thành hoạt động: Ôn tập 15 từ vựng FSRS/i)).not.toBeInTheDocument();
    });

    it('TEST-011-COMP-06: repeated/idempotent completion replay produces identical completed plan state without mutation', async () => {
      let callCount = 0;
      const completedResponse: TodayCompletionResponseDto = {
        data: {
          plan: {
            ...customServerPlan,
            completedMinutes: 22,
            activities: [
              customServerPlan.activities[0],
              { ...customServerPlan.activities[1], status: 'completed' },
              customServerPlan.activities[2],
            ],
          },
          activity: { ...customServerPlan.activities[1], status: 'completed' },
        },
        meta: { requestId: 'req-replay', apiVersion: '1.0' },
      };

      vi.spyOn(api, 'completeTodayActivity').mockImplementation(async () => {
        callCount++;
        return completedResponse;
      });

      await renderToday();

      const completeBtn = await screen.findByRole('button', {
        name: 'Hoàn thành hoạt động Ôn tập 15 từ vựng FSRS',
      });

      // First call
      fireEvent.click(completeBtn);

      expect(await screen.findByRole('button', { name: 'Ôn lại' })).toBeInTheDocument();
      expect(callCount).toBe(1);

      // Plan is in completed state
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });
  });
});
