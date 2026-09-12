import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { useReviewSession } from '../../apps/web/src/features/review/useReviewSession';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { ReviewSession } from '../../apps/web/src/features/review/ReviewSession';
import {
  mapReviewQueueItemToViewModel,
  mapReviewAnswerResultToViewModel,
} from '../../apps/web/src/features/review/adapters';
import {
  LinguaApiError,
  mockApiResponses,
  type ApiClient,
  type ReviewAnswerResponseDto,
  type ReviewQueueItemDto,
  type ReviewQueueResponseDto,
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

const mockQueueItem1: ReviewQueueItemDto = {
  ...mockApiResponses.reviewQueue.data[0],
  prompt: {
    ...mockApiResponses.reviewQueue.data[0].prompt,
    contextSentence: 'I have an appointment with the doctor.',
    translation: 'Tôi có cuộc hẹn với bác sĩ.',
    audioUrl: 'https://cdn.example.test/audio/appointment.mp3',
  },
};

const mockQueueItem2: ReviewQueueItemDto = {
  ...mockApiResponses.reviewQueue.data[1],
};

const mockQueueResponse: ReviewQueueResponseDto = {
  data: [mockQueueItem1, mockQueueItem2],
  meta: {
    requestId: '00000000-0000-4000-8000-000000000901',
    apiVersion: '1.0',
    hasMore: false,
    nextCursor: null,
    pageSize: 2,
  },
};

function findReviewCard(term: string) {
  return screen.findByRole('heading', { name: term });
}

function getReviewCard(term: string) {
  return screen.getByRole('heading', { name: term });
}

function queryReviewCard(term: string) {
  return screen.queryByRole('heading', { name: term });
}

function createMockAnswerResponse(
  reviewItemId: string,
  remainingDueCount = 1,
  feedback = 'Đã ghi nhận: Tốt (Good) — Đã ghi nhớ'
): ReviewAnswerResponseDto {
  return {
    data: {
      reviewItemId,
      memory: {
        state: 'review',
        dueAt: '2026-09-12T08:00:00Z',
        isDue: false,
        lastReviewedAt: '2026-09-05T09:00:00Z',
      },
      competence: mockQueueItem1.competence,
      remainingDueCount,
      feedback,
    },
    meta: {
      requestId: '00000000-0000-4000-8000-000000000999',
      apiVersion: '1.0',
    },
  };
}

describe('TASK-007 recovery and logical-operation regressions', () => {
  beforeEach(() => sessionStorage.clear());

  function setup(client: ApiClient) {
    const auth = createMockSupabase();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider customClient={auth}>{children}</AuthProvider>
    );
    const hook = renderHook(() => useReviewSession({ apiClient: client, query: { languageProfileId: 'profile-a' } }), { wrapper });
    return { ...hook, auth, wrapper };
  }

  it('keeps one answer identity across ambiguous failure, changed rating and reload', async () => {
    const answerReviewItem = vi.fn().mockRejectedValueOnce(new Error('private database error'))
      .mockResolvedValue(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
    const client = { listReviewQueue: vi.fn().mockResolvedValue(mockQueueResponse), answerReviewItem } as unknown as ApiClient;
    const first = setup(client);
    await waitFor(() => expect(first.result.current.currentCard).not.toBeNull());
    await act(async () => { await first.result.current.submitRating('good'); });
    await act(async () => { await first.result.current.submitRating('easy'); });
    expect(answerReviewItem).toHaveBeenCalledTimes(1);
    first.unmount();
    const second = setup(client);
    await waitFor(() => expect(second.result.current.pendingRetryOperation).not.toBeNull());
    expect(answerReviewItem).toHaveBeenCalledTimes(1);
    await act(async () => { await second.result.current.retryLastAnswer(); });
    expect(answerReviewItem.mock.calls[1]).toEqual(answerReviewItem.mock.calls[0]);
    expect(second.result.current.pendingRetryOperation).toBeNull();
  });

  it('suppresses duplicate calls before React rerenders', async () => {
    const answerReviewItem = vi.fn().mockResolvedValue(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
    const h = setup({ listReviewQueue: vi.fn().mockResolvedValue(mockQueueResponse), answerReviewItem } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.currentCard).not.toBeNull());
    await act(async () => { await Promise.all([h.result.current.submitRating('good'), h.result.current.submitRating('good')]); });
    expect(answerReviewItem).toHaveBeenCalledTimes(1);
  });

  it('reconciles current queue after replay instead of trusting a historical zero remaining count', async () => {
    const answerReviewItem = vi.fn().mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(createMockAnswerResponse(mockQueueItem1.reviewItemId, 0));
    const listReviewQueue = vi.fn().mockResolvedValueOnce(mockQueueResponse)
      .mockResolvedValue({ data: [mockQueueItem2], meta: { ...mockQueueResponse.meta, pageSize: 1 } });
    const h = setup({ listReviewQueue, answerReviewItem } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.currentCard).not.toBeNull());
    await act(async () => { await h.result.current.submitRating('good'); });
    await act(async () => { await h.result.current.retryLastAnswer(); });
    expect(listReviewQueue).toHaveBeenCalledTimes(2);
    expect(h.result.current.currentCard?.id).toBe(mockQueueItem2.reviewItemId);
    expect(h.result.current.isFinished).toBe(false);
  });

  it('refetches at snapshot exhaustion when the server reports remaining work', async () => {
    const listReviewQueue = vi.fn().mockResolvedValueOnce({ data: [mockQueueItem1], meta: { ...mockQueueResponse.meta, pageSize: 1 } })
      .mockResolvedValueOnce({ data: [mockQueueItem2], meta: { ...mockQueueResponse.meta, pageSize: 1 } });
    const answerReviewItem = vi.fn().mockResolvedValue(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
    const h = setup({ listReviewQueue, answerReviewItem } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.currentCard).not.toBeNull());
    await act(async () => { await h.result.current.submitRating('good'); });
    expect(listReviewQueue).toHaveBeenCalledTimes(2);
    expect(h.result.current.currentCard?.id).toBe(mockQueueItem2.reviewItemId);
    expect(h.result.current.isFinished).toBe(false);
    expect(h.result.current.isSubmitting).toBe(false);
  });

  it('fails closed before dispatch when receipt storage is unavailable', async () => {
    const answerReviewItem = vi.fn();
    const h = setup({ listReviewQueue: vi.fn().mockResolvedValue(mockQueueResponse), answerReviewItem } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.currentCard).not.toBeNull());
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied'); });
    try {
      await act(async () => { await h.result.current.submitRating('good'); });
      expect(answerReviewItem).not.toHaveBeenCalled();
      expect(h.result.current.actionError).not.toBeNull();
    } finally { write.mockRestore(); }
  });

  it('same-actor refetch does not invalidate an in-flight answer and completes reconciliation', async () => {
    let settle!: (value: ReviewAnswerResponseDto) => void;
    const answerReviewItem = vi.fn(() => new Promise<ReviewAnswerResponseDto>(resolve => { settle = resolve; }));
    const h = setup({ listReviewQueue: vi.fn().mockResolvedValue(mockQueueResponse), answerReviewItem } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.currentCard).not.toBeNull());
    act(() => { void h.result.current.submitRating('good'); });
    await act(async () => { await h.result.current.refetch(); });
    await act(async () => { settle(createMockAnswerResponse(mockQueueItem1.reviewItemId, 0)); });
    expect(h.result.current.currentIndex).toBe(2);
    expect(h.result.current.lastFeedback).toBe('Đã ghi nhận: Tốt (Good) — Đã ghi nhớ');
    expect(h.result.current.pendingRetryOperation).toBeNull();
    expect(h.result.current.isSubmitting).toBe(false);
  });

  it('loads opaque cursor pages in server order without treating first page as complete', async () => {
    const listReviewQueue = vi.fn().mockResolvedValueOnce({ data: [mockQueueItem1], meta: { ...mockQueueResponse.meta, hasMore: true, nextCursor: 'opaque+/cursor', pageSize: 1 } })
      .mockResolvedValueOnce({ data: [mockQueueItem2], meta: { ...mockQueueResponse.meta, pageSize: 1 } });
    const h = setup({ listReviewQueue } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.queue).toHaveLength(2));
    expect(listReviewQueue.mock.calls[1][0]).toEqual({ languageProfileId: 'profile-a', cursor: 'opaque+/cursor' });
    expect(h.result.current.queue.map(item => item.id)).toEqual([mockQueueItem1.reviewItemId, mockQueueItem2.reviewItemId]);
  });

  it('rejects cyclic cursor responses instead of displaying false completion', async () => {
    const listReviewQueue = vi.fn().mockResolvedValue({ data: [mockQueueItem1], meta: { ...mockQueueResponse.meta, hasMore: true, nextCursor: 'cycle' } });
    const h = setup({ listReviewQueue } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.error).not.toBeNull());
    expect(h.result.current.queue).toHaveLength(0);
    expect(listReviewQueue).toHaveBeenCalledTimes(2);
  });

  it('uses a neutral acknowledgement when server feedback is absent', () => {
    const data = { ...createMockAnswerResponse(mockQueueItem1.reviewItemId).data, feedback: undefined };
    expect(mapReviewAnswerResultToViewModel(data).feedback).toBe('Đã ghi nhận kết quả ôn tập.');
  });

  it.each(['success', 'error'] as const)('isolates stale A %s and finally from B pending mutation', async (outcome) => {
    let resolveA!: (value: ReviewAnswerResponseDto) => void;
    let rejectA!: (reason: Error) => void;
    let resolveB!: (value: ReviewAnswerResponseDto) => void;
    const answerReviewItem = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve, reject) => { resolveA = resolve; rejectA = reject; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }));
    const h = setup({ listReviewQueue: vi.fn().mockResolvedValue(mockQueueResponse), answerReviewItem } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.currentCard).not.toBeNull());
    act(() => { void h.result.current.submitRating('good'); });
    act(() => h.auth.switchUser(sessionB));
    await waitFor(() => expect(h.result.current.isLoading).toBe(false));
    act(() => { void h.result.current.submitRating('hard'); });
    expect(answerReviewItem).toHaveBeenCalledTimes(2);
    await act(async () => {
      if (outcome === 'success') resolveA(createMockAnswerResponse(mockQueueItem1.reviewItemId, 0, 'A feedback'));
      else rejectA(new Error('A secret error'));
    });
    expect(h.result.current.isSubmitting).toBe(true);
    expect(h.result.current.actionError).toBeNull();
    expect(h.result.current.lastFeedback).toBeNull();
    expect(h.result.current.currentIndex).toBe(0);
    await act(async () => resolveB(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1, 'B feedback')));
    expect(h.result.current.isSubmitting).toBe(false);
    expect(h.result.current.lastFeedback).toBe('B feedback');
  });

  it('same actor token refresh preserves a valid answer and does not reload queue', async () => {
    let resolve!: (value: ReviewAnswerResponseDto) => void;
    const listReviewQueue = vi.fn().mockResolvedValue(mockQueueResponse);
    const answerReviewItem = vi.fn(() => new Promise<ReviewAnswerResponseDto>(r => { resolve = r; }));
    const h = setup({ listReviewQueue, answerReviewItem } as unknown as ApiClient);
    await waitFor(() => expect(h.result.current.currentCard).not.toBeNull());
    act(() => { void h.result.current.submitRating('good'); });
    act(() => h.auth.switchUser({ ...sessionA, access_token: 'refreshed-a' }));
    await act(async () => resolve(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1)));
    expect(listReviewQueue).toHaveBeenCalledTimes(1);
    expect(h.result.current.currentIndex).toBe(1);
    expect(h.result.current.isSubmitting).toBe(false);
  });
});

describe('TASK-007: Review Live Frontend Integration', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    mockSupabase = createMockSupabase(sessionA);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('plays only supplied audio on explicit click and stops it on actor transition without submitting evidence', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    const answerReviewItem = vi.fn();
    const client = { listReviewQueue: vi.fn().mockResolvedValue(mockQueueResponse), answerReviewItem } as unknown as ApiClient;
    render(<AuthProvider customClient={mockSupabase}><ReviewSession apiClient={client} /></AuthProvider>);
    await findReviewCard('appointment');
    await act(async () => {});
    expect(play).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Phát âm từ' })));
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.instances[0].src).toBe(mockQueueItem1.prompt.audioUrl);
    await act(async () => mockSupabase.switchUser(sessionB));
    expect(pause).toHaveBeenCalled();
    expect(answerReviewItem).not.toHaveBeenCalled();
  });

  describe('1. Live Queue Loading & Presentation (TEST-007-01 .. TEST-007-06)', () => {
    it('TEST-007-01: authenticated ready learner loads real Review queue on mount', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const client = { listReviewQueue } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      expect(await screen.findByRole('heading', { name: 'appointment' })).toBeInTheDocument();
      expect(listReviewQueue).toHaveBeenCalledTimes(1);
      expect(screen.getByText('2 từ đến hạn')).toBeInTheDocument();
      expect(screen.getByText('Thẻ 1 / 2')).toBeInTheDocument();
    });

    it('TEST-007-02: presentation adapter preserves exact server text (lemma, IPA, POS, prompt, context, translations)', () => {
      const vm = mapReviewQueueItemToViewModel(mockQueueItem1);

      expect(vm.id).toBe(mockQueueItem1.reviewItemId);
      expect(vm.conceptId).toBe(mockQueueItem1.concept.id);
      expect(vm.term).toBe('appointment');
      expect(vm.pos).toBe('noun');
      expect(vm.contextSentence).toBe('I have an appointment with the doctor.');
      expect(vm.meaningVi).toBe(mockQueueItem1.prompt.promptText);
      expect(vm.audioUrl).toBe('https://cdn.example.test/audio/appointment.mp3');
      expect(vm.isDue).toBe(true);
    });

    it('TEST-007-03: empty queue response displays completion EmptyState with link to /read and /today', async () => {
      const listReviewQueue = vi.fn(async () => ({ data: [], meta: { ...mockQueueResponse.meta, pageSize: 1 } }));
      const client = { listReviewQueue } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      expect(await screen.findByText('Đã hoàn thành toàn bộ hàng đợi ôn tập!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Về trang Hôm nay/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Đọc bài mới trong Reader/i })).toBeInTheDocument();
    });

    it('TEST-007-04: 401 / UNAUTHENTICATED error renders ErrorState with UNAUTHENTICATED message', async () => {
      const listReviewQueue = vi.fn(async () => {
        throw new LinguaApiError({ code: 'UNAUTHENTICATED', httpStatus: 401, requestId: 'req-401' });
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      expect(await screen.findByText('Cần đăng nhập')).toBeInTheDocument();
      expect(screen.getByText('Mã lỗi: UNAUTHENTICATED')).toBeInTheDocument();
    });

    it('TEST-007-05: 500 / INTERNAL_ERROR renders ErrorState with retry button', async () => {
      const listReviewQueue = vi.fn(async () => {
        throw new LinguaApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, requestId: 'req-500' });
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      expect(await screen.findByText('Hệ thống gặp sự cố')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    });

    it('TEST-007-06: clicking retry on initial load error triggers refetch without infinite loops', async () => {
      let callCount = 0;
      const listReviewQueue = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new LinguaApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, requestId: 'req-500' });
        }
        return mockQueueResponse;
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      const retryBtn = await screen.findByRole('button', { name: /Thử lại/i });
      fireEvent.click(retryBtn);

      expect(await findReviewCard('appointment')).toBeInTheDocument();
      expect(callCount).toBe(2);
    });
  });

  describe('2. Authoritative Answers & User Interactions (TEST-007-07 .. TEST-007-11)', () => {
    it('TEST-007-07: clicking rating button submits answerReviewItem with correct reviewItemId, rating, responseTimeMs', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
      fireEvent.click(goodBtn);

      await waitFor(() => {
        expect(answerReviewItem).toHaveBeenCalledTimes(1);
      });

      const call = answerReviewItem.mock.calls[0][0];
      expect(call.reviewItemId).toBe(mockQueueItem1.reviewItemId);
      expect(call.body.rating).toBe('good');
      expect(typeof call.body.responseTimeMs).toBe('number');
      expect(call.body.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(call.headers['Idempotency-Key']).toBeDefined();

      // Advanced to card 2
      expect(await findReviewCard('available')).toBeInTheDocument();
    });

    it('TEST-007-08: rating buttons are disabled while isSubmitting is true', async () => {
      let resolveAnswer: (res: ReviewAnswerResponseDto) => void;
      const answerPromise = new Promise<ReviewAnswerResponseDto>((resolve) => {
        resolveAnswer = resolve;
      });

      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => answerPromise);
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      const againBtn = screen.getByRole('button', { name: /Quên \(Again\)/i });
      const hardBtn = screen.getByRole('button', { name: /Khó \(Hard\)/i });
      const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
      const easyBtn = screen.getByRole('button', { name: /Dễ \(Easy\)/i });

      fireEvent.click(goodBtn);

      // In flight -> all buttons disabled
      await waitFor(() => {
        expect(goodBtn).toBeDisabled();
        expect(againBtn).toBeDisabled();
        expect(hardBtn).toBeDisabled();
        expect(easyBtn).toBeDisabled();
      });

      // Complete request
      await act(async () => {
        resolveAnswer!(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
      });

      // Card 2 active -> buttons re-enabled
      expect(await findReviewCard('available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tốt \(Good\)/i })).not.toBeDisabled();
    });

    it('TEST-007-09: Space key reveals prompt meaning and context translation immediately', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const client = { listReviewQueue } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      expect(screen.queryByText('Tôi có cuộc hẹn với bác sĩ.')).not.toBeInTheDocument();

      // Flush passive listener installation before asserting synchronous keyboard behavior.
      await act(async () => {});
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });

      expect(screen.getByText(mockQueueItem1.prompt.promptText)).toBeInTheDocument();
      expect(screen.getByText('(Tôi có cuộc hẹn với bác sĩ.)')).toBeInTheDocument();
    });

    it('TEST-007-10: numeric keyboard keys 1, 2, 3, 4 trigger Again, Hard, Good, Easy rating submissions', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      // Key 3 = 'good'
      fireEvent.keyDown(window, { key: '3' });

      await waitFor(() => {
        expect(answerReviewItem).toHaveBeenCalledTimes(1);
      });
      expect(answerReviewItem.mock.calls[0][0].body.rating).toBe('good');
    });

    it('TEST-007-11: rapid clicks / keypresses while submitting are locked out and do not generate duplicate API calls', async () => {
      let resolveAnswer: (res: ReviewAnswerResponseDto) => void;
      const answerPromise = new Promise<ReviewAnswerResponseDto>((resolve) => {
        resolveAnswer = resolve;
      });

      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => answerPromise);
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });

      // Click once
      fireEvent.click(goodBtn);
      // Rapid clicks while in flight
      fireEvent.click(goodBtn);
      fireEvent.click(goodBtn);
      fireEvent.keyDown(window, { key: '3' });
      fireEvent.keyDown(window, { key: '4' });

      expect(answerReviewItem).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveAnswer!(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
      });

      expect(await findReviewCard('available')).toBeInTheDocument();
    });
  });

  describe('3. Idempotency Key Lifecycle & Ambiguous Error Recovery (TEST-007-12 .. TEST-007-16)', () => {
    it('TEST-007-12: answer request generates and attaches a valid UUID Idempotency-Key header', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      fireEvent.click(screen.getByRole('button', { name: /Tốt \(Good\)/i }));

      await waitFor(() => {
        expect(answerReviewItem).toHaveBeenCalledTimes(1);
      });

      const key = answerReviewItem.mock.calls[0][0].headers['Idempotency-Key'];
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('TEST-007-13: network error / ambiguous failure retains the exact same Idempotency-Key for retry', async () => {
      let callCount = 0;
      let firstKey = '';
      let retryKey = '';

      const listReviewQueue = vi.fn().mockResolvedValueOnce(mockQueueResponse)
        .mockResolvedValue({ data: [mockQueueItem2], meta: { ...mockQueueResponse.meta, pageSize: 1 } });
      const answerReviewItem = vi.fn(async (input: { headers: { 'Idempotency-Key': string } }) => {
        callCount++;
        if (callCount === 1) {
          firstKey = input.headers['Idempotency-Key'];
          throw new Error('Network timeout');
        }
        retryKey = input.headers['Idempotency-Key'];
        return createMockAnswerResponse(mockQueueItem1.reviewItemId, 1);
      });
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      fireEvent.click(screen.getByRole('button', { name: /Tốt \(Good\)/i }));

      // Error alert displayed with retry button
      const retryBtn = await screen.findByRole('button', { name: /Thử lại/i });
      expect(screen.queryByText('Network timeout')).not.toBeInTheDocument();
      expect(screen.getByText('Lỗi gửi kết quả ôn tập')).toBeInTheDocument();

      // Card must NOT have advanced
      expect(getReviewCard('appointment')).toBeInTheDocument();

      // Click retry
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(callCount).toBe(2);
      });

      // Keys MUST be strictly identical across the failure/retry attempt
      expect(retryKey).toBe(firstKey);
      expect(firstKey.length).toBeGreaterThan(0);

      // Now advanced to card 2
      expect(await findReviewCard('available')).toBeInTheDocument();
    });

    it('TEST-007-14: ambiguous answer error keeps current card on screen and renders inline danger alert with retry button', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => {
        throw new LinguaApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, requestId: 'req-500' });
      });
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      fireEvent.click(screen.getByRole('button', { name: /Tốt \(Good\)/i }));

      expect(await screen.findByText(/Lỗi gửi kết quả ôn tập/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
      // Current card intact
      expect(getReviewCard('appointment')).toBeInTheDocument();
    });

    it('TEST-007-15: successful answer advances to next card and generates a fresh Idempotency-Key for next card', async () => {
      const keys: string[] = [];
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async (input: { reviewItemId: string; headers: { 'Idempotency-Key': string } }) => {
        keys.push(input.headers['Idempotency-Key']);
        return createMockAnswerResponse(input.reviewItemId, keys.length === 1 ? 1 : 0);
      });
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      // Card 1
      await findReviewCard('appointment');
      fireEvent.click(screen.getByRole('button', { name: /Tốt \(Good\)/i }));

      // Card 2
      expect(await findReviewCard('available')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Dễ \(Easy\)/i }));

      await waitFor(() => {
        expect(keys).toHaveLength(2);
      });

      // Keys between different cards must NOT be identical
      expect(keys[0]).not.toBe(keys[1]);
    });

    it('TEST-007-16: idempotent replay (server returning replayed answer) completes transition cleanly without double card skip', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () => {
        return createMockAnswerResponse(mockQueueItem1.reviewItemId, 1, 'Đã ghi nhận (Replayed)');
      });
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      fireEvent.click(screen.getByRole('button', { name: /Tốt \(Good\)/i }));

      // Replay result received -> advances exactly to Card 2, not beyond
      expect(await findReviewCard('available')).toBeInTheDocument();
      expect(screen.getByText('Thẻ 2 / 2')).toBeInTheDocument();
    });
  });

  describe('4. Multi-Actor Lifecycle & Isolation (TEST-007-17 .. TEST-007-21)', () => {
    it('TEST-007-17: switching actor (User A -> User B) invalidates pending queue and wipes cards cleanly', async () => {
      let activeUserQueue = mockQueueResponse;
      const listReviewQueue = vi.fn(async () => activeUserQueue);
      const client = { listReviewQueue } as unknown as ApiClient;

      const { rerender } = render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');

      // Prepare User B queue
      activeUserQueue = {
        data: [{
          ...mockQueueItem2,
          concept: { ...mockQueueItem2.concept, canonicalForm: 'perseverance' },
        }],
        meta: { ...mockQueueResponse.meta, pageSize: 1 },
      };

      // Switch to User B
      act(() => {
        mockSupabase.switchUser(sessionB);
      });

      rerender(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      // Card from User A must disappear and User B card should appear
      expect(await findReviewCard('perseverance')).toBeInTheDocument();
      expect(queryReviewCard('appointment')).not.toBeInTheDocument();
    });

    it('TEST-007-18: late-resolving queue response from User A is discarded and does not mutate User B UI', async () => {
      let resolveUserAQueue: (res: ReviewQueueResponseDto) => void;
      const userAPromise = new Promise<ReviewQueueResponseDto>((resolve) => {
        resolveUserAQueue = resolve;
      });

      const userBQueue: ReviewQueueResponseDto = {
        data: [{ ...mockQueueItem2, concept: { ...mockQueueItem2.concept, canonicalForm: 'resilience' } }],
        meta: { ...mockQueueResponse.meta, pageSize: 1 },
      };

      let requestCount = 0;
      const listReviewQueue = vi.fn(async () => {
        requestCount++;
        if (requestCount === 1) {
          return userAPromise;
        }
        return userBQueue;
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      const { rerender } = render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      // User A request in flight -> switch to User B
      await waitFor(() => expect(listReviewQueue).toHaveBeenCalledTimes(1));
      act(() => {
        mockSupabase.switchUser(sessionB);
      });

      rerender(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      // User B renders
      expect(await findReviewCard('resilience')).toBeInTheDocument();

      // User A's slow promise resolves late
      await act(async () => {
        resolveUserAQueue!(mockQueueResponse);
      });

      // User B's state MUST NOT be overwritten by User A's appointment card
      expect(getReviewCard('resilience')).toBeInTheDocument();
      expect(queryReviewCard('appointment')).not.toBeInTheDocument();
    });

    it('TEST-007-19: late-resolving answer response from User A is discarded and does not advance User B state', async () => {
      let resolveUserAAnswer: (res: ReviewAnswerResponseDto) => void;
      const userAAnswerPromise = new Promise<ReviewAnswerResponseDto>((resolve) => {
        resolveUserAAnswer = resolve;
      });

      const listReviewQueue = vi.fn().mockResolvedValueOnce(mockQueueResponse).mockResolvedValue({
        ...mockQueueResponse,
        data: [{ ...mockQueueItem2, concept: { ...mockQueueItem2.concept, canonicalForm: 'resilience' } }],
      });
      const answerReviewItem = vi.fn(async () => userAAnswerPromise);
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      const { rerender } = render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      // User A clicks good
      fireEvent.click(screen.getByRole('button', { name: /Tốt \(Good\)/i }));

      // Switch to User B while answer is in flight
      act(() => {
        mockSupabase.switchUser(sessionB);
      });

      rerender(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      // Late User A response arrives
      await findReviewCard('resilience');
      await act(async () => {
        resolveUserAAnswer!(createMockAnswerResponse(mockQueueItem1.reviewItemId, 0));
      });

      // Must not crash or advance unowned state
      expect(queryReviewCard('appointment')).not.toBeInTheDocument();
      expect(getReviewCard('resilience')).toBeInTheDocument();
    });

    it('TEST-007-20: sign out clears review queue to empty/unauthenticated state', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const client = { listReviewQueue } as unknown as ApiClient;

      const { rerender } = render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');

      // User signs out
      act(() => {
        mockSupabase.switchUser(null);
      });

      rerender(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      expect(queryReviewCard('appointment')).not.toBeInTheDocument();
    });

    it('TEST-007-21: concurrent refetch calls on same actor cancel/supersede stale requests (sequence check)', async () => {
      let resolveFirstCall: (res: ReviewQueueResponseDto) => void;
      const firstPromise = new Promise<ReviewQueueResponseDto>((resolve) => {
        resolveFirstCall = resolve;
      });

      let callIndex = 0;
      const listReviewQueue = vi.fn(async () => {
        callIndex++;
        if (callIndex === 1) return firstPromise;
        return {
          data: [{ ...mockQueueItem2, concept: { ...mockQueueItem2.concept, canonicalForm: 'fresh-card' } }],
          meta: { ...mockQueueResponse.meta, pageSize: 1 },
        };
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      const { result } = renderHook(() => useReviewSession({ apiClient: client }), {
        wrapper: ({ children }) => <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>,
      });
      await waitFor(() => expect(listReviewQueue).toHaveBeenCalledTimes(1));
      await act(async () => { await result.current.refetch(); });
      expect(listReviewQueue).toHaveBeenCalledTimes(2);

      // Stale first call resolves
      await act(async () => {
        resolveFirstCall!(mockQueueResponse);
      });

      // The newer result (fresh-card) must be rendered, not stale appointment
      expect(result.current.currentCard?.term).toBe('fresh-card');
    });
  });

  describe('5. Zero Client FSRS Calculations & Server Authority (TEST-007-22)', () => {
    it('TEST-007-22: client-side UI strictly displays server-provided remainingDueCount and feedback without client FSRS math', async () => {
      const listReviewQueue = vi.fn(async () => mockQueueResponse);
      const answerReviewItem = vi.fn(async () =>
        createMockAnswerResponse(mockQueueItem1.reviewItemId, 77, 'Server Authoritative Feedback: Rep 3')
      );
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      render(
        <AuthProvider customClient={mockSupabase}>
          <ReviewSession apiClient={client} />
        </AuthProvider>
      );

      await findReviewCard('appointment');
      expect(screen.getByText('2 từ đến hạn')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Tốt \(Good\)/i }));

      // Server returned remainingDueCount = 77 and custom feedback
      expect(await screen.findByText('Server Authoritative Feedback: Rep 3')).toBeInTheDocument();
      expect(screen.getByText('77 từ đến hạn')).toBeInTheDocument();
    });
  });

  describe('6. Overlapping loadQueue() Race Hardening (TEST-007-23 .. TEST-007-25)', () => {
    it('TEST-007-23: stale older queue responses cannot overwrite newer queue state', async () => {
      let resolveFirstCall: (res: ReviewQueueResponseDto) => void;
      const firstPromise = new Promise<ReviewQueueResponseDto>((resolve) => {
        resolveFirstCall = resolve;
      });

      let callIndex = 0;
      const listReviewQueue = vi.fn(async () => {
        callIndex++;
        if (callIndex === 1) return firstPromise;
        return {
          data: [{ ...mockQueueItem2, concept: { ...mockQueueItem2.concept, canonicalForm: 'newer-item' } }],
          meta: { ...mockQueueResponse.meta, pageSize: 1 },
        };
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      const { result } = renderHook(() => useReviewSession({ apiClient: client }), {
        wrapper: ({ children }) => <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>,
      });

      // Wait for first call to be dispatched
      await waitFor(() => expect(listReviewQueue).toHaveBeenCalledTimes(1));

      // Trigger second call while first is still pending
      await act(async () => {
        await result.current.refetch();
      });
      expect(listReviewQueue).toHaveBeenCalledTimes(2);

      // Verify newer item is present in queue
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.currentCard?.term).toBe('newer-item');
      expect(result.current.remainingDueCount).toBe(1);

      // Stale first call resolves late with old items
      await act(async () => {
        resolveFirstCall!(mockQueueResponse);
      });

      // The newer result must NOT be overwritten by the stale first call
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.currentCard?.term).toBe('newer-item');
      expect(result.current.remainingDueCount).toBe(1);
    });

    it('TEST-007-24: actor switch cannot leak prior actor queue state', async () => {
      let resolveUserAQueue: (res: ReviewQueueResponseDto) => void;
      const userAPromise = new Promise<ReviewQueueResponseDto>((resolve) => {
        resolveUserAQueue = resolve;
      });

      const userBQueue: ReviewQueueResponseDto = {
        data: [{ ...mockQueueItem2, concept: { ...mockQueueItem2.concept, canonicalForm: 'user-b-card' } }],
        meta: { ...mockQueueResponse.meta, pageSize: 1 },
      };

      let callCount = 0;
      const listReviewQueue = vi.fn(async () => {
        callCount++;
        if (callCount === 1) return userAPromise;
        return userBQueue;
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      const { result } = renderHook(() => useReviewSession({ apiClient: client }), {
        wrapper: ({ children }) => <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>,
      });

      // User A call initiated
      await waitFor(() => expect(listReviewQueue).toHaveBeenCalledTimes(1));

      // Switch to User B while User A queue call is in flight
      act(() => {
        mockSupabase.switchUser(sessionB);
      });

      // User B should load its own queue
      await waitFor(() => expect(listReviewQueue).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.currentCard?.term).toBe('user-b-card'));

      // Now late User A response arrives with User A items
      await act(async () => {
        resolveUserAQueue!(mockQueueResponse);
      });

      // User B queue must NOT be polluted or overwritten by User A response
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.currentCard?.term).toBe('user-b-card');
      expect(result.current.queue[0].term).toBe('user-b-card');
    });

    it('TEST-007-25: genuine empty latest response still works correctly and is not dropped', async () => {
      let resolveFirstCall: (res: ReviewQueueResponseDto) => void;
      const firstPromise = new Promise<ReviewQueueResponseDto>((resolve) => {
        resolveFirstCall = resolve;
      });

      const emptyQueueResponse: ReviewQueueResponseDto = {
        data: [],
        meta: {
          ...mockQueueResponse.meta,
          pageSize: 0,
        },
      };

      let callIndex = 0;
      const listReviewQueue = vi.fn(async () => {
        callIndex++;
        if (callIndex === 1) return firstPromise;
        return emptyQueueResponse;
      });
      const client = { listReviewQueue } as unknown as ApiClient;

      const { result } = renderHook(() => useReviewSession({ apiClient: client }), {
        wrapper: ({ children }) => <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>,
      });

      await waitFor(() => expect(listReviewQueue).toHaveBeenCalledTimes(1));

      // Second request returns empty queue
      await act(async () => {
        await result.current.refetch();
      });
      expect(listReviewQueue).toHaveBeenCalledTimes(2);

      // Verify empty queue is committed
      expect(result.current.queue).toHaveLength(0);
      expect(result.current.currentCard).toBeNull();
      expect(result.current.remainingDueCount).toBe(0);

      // Stale first call resolves late with non-empty items
      await act(async () => {
        resolveFirstCall!(mockQueueResponse);
      });

      // Must remain empty and not be overwritten by stale non-empty response
      expect(result.current.queue).toHaveLength(0);
      expect(result.current.currentCard).toBeNull();
      expect(result.current.remainingDueCount).toBe(0);
    });

    it('TEST-007-26: answering final card in queue triggers internal loadQueue(), loads new queue, and allows immediate next answer submission', async () => {
      const listReviewQueue = vi.fn()
        .mockResolvedValueOnce({
          data: [mockQueueItem1],
          meta: { ...mockQueueResponse.meta, pageSize: 1 },
        })
        .mockResolvedValueOnce({
          data: [mockQueueItem2],
          meta: { ...mockQueueResponse.meta, pageSize: 1 },
        });

      const answerReviewItem = vi.fn()
        .mockResolvedValueOnce(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1))
        .mockResolvedValueOnce(createMockAnswerResponse(mockQueueItem2.reviewItemId, 0));

      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      const { result } = renderHook(() => useReviewSession({ apiClient: client }), {
        wrapper: ({ children }) => <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>,
      });

      await waitFor(() => expect(result.current.currentCard?.id).toBe(mockQueueItem1.reviewItemId));
      expect(result.current.queue).toHaveLength(1);

      // Submit answer for the final card (currentIndex = 0, queue.length = 1)
      await act(async () => {
        await result.current.submitRating('good');
      });

      // Internal loadQueue() was triggered and completed
      expect(listReviewQueue).toHaveBeenCalledTimes(2);
      expect(answerReviewItem).toHaveBeenCalledTimes(1);

      // Verify new queue is loaded and locks are released
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.currentCard?.id).toBe(mockQueueItem2.reviewItemId);
      expect(result.current.isSubmitting).toBe(false);

      // Must be able to submit answer for the next card immediately (proves busyRef is not locked)
      await act(async () => {
        await result.current.submitRating('easy');
      });

      expect(answerReviewItem).toHaveBeenCalledTimes(2);
      expect(result.current.reviewedCount).toBe(2);
      expect(result.current.isSubmitting).toBe(false);
    });

    it('TEST-007-27: external refetch queue load while answerReviewItem is in-flight preserves answer completion and does not stick busyRef', async () => {
      let resolveAnswer!: (res: ReviewAnswerResponseDto) => void;
      const answerPromise = new Promise<ReviewAnswerResponseDto>((resolve) => {
        resolveAnswer = resolve;
      });

      const listReviewQueue = vi.fn().mockResolvedValue(mockQueueResponse);
      const answerReviewItem = vi.fn(() => answerPromise);
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      const { result } = renderHook(() => useReviewSession({ apiClient: client }), {
        wrapper: ({ children }) => <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>,
      });

      await waitFor(() => expect(result.current.currentCard).not.toBeNull());

      // Start answer submission (remains in flight)
      act(() => {
        void result.current.submitRating('good');
      });

      expect(result.current.isSubmitting).toBe(true);

      // Trigger external refetch while answer is in flight
      await act(async () => {
        await result.current.refetch();
      });

      // Answer settles
      await act(async () => {
        resolveAnswer(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1, 'Great job!'));
      });

      // Answer was NOT dropped: feedback recorded, reviewedCount incremented, busyRef released
      expect(result.current.lastFeedback).toBe('Great job!');
      expect(result.current.reviewedCount).toBe(1);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.pendingRetryOperation).toBeNull();
    });

    it('TEST-007-28: bailout/auth-transition during internal loadQueue does not leave busyRef permanently locked', async () => {
      const listReviewQueue = vi.fn().mockResolvedValueOnce({
        data: [mockQueueItem1],
        meta: { ...mockQueueResponse.meta, pageSize: 1 },
      });

      const answerReviewItem = vi.fn().mockResolvedValueOnce(createMockAnswerResponse(mockQueueItem1.reviewItemId, 1));
      const client = { listReviewQueue, answerReviewItem } as unknown as ApiClient;

      const { result } = renderHook(() => useReviewSession({ apiClient: client }), {
        wrapper: ({ children }) => <AuthProvider customClient={mockSupabase}>{children}</AuthProvider>,
      });

      await waitFor(() => expect(result.current.currentCard?.id).toBe(mockQueueItem1.reviewItemId));

      // Second listReviewQueue (internal reload) throws an unexpected error
      listReviewQueue.mockRejectedValueOnce(new Error('Network disconnected during reload'));

      await act(async () => {
        await result.current.submitRating('good');
      });

      // Even though internal reload failed with an error, busyRef and isSubmitting MUST be released via token cleanup
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error?.message).toBe('Network disconnected during reload');
    });
  });
});
