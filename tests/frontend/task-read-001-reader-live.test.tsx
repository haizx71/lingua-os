import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  MockApiClient,
  mockContentResponse,
  mockConceptResponse,
  mockApiResponses,
  type ApiClient,
  type ContentResponseDto,
} from '@lingua/types';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { InteractiveReader } from '../../apps/web/src/features/read/InteractiveReader';
import { setApiClient } from '../../apps/web/src/lib/api/client';

const IDS = {
  actorA: '10000000-0000-4000-8000-000000000001',
  actorB: '10000000-0000-4000-8000-000000000002',
  content: '20000000-0000-4000-8000-000000000001',
  segment1: '30000000-0000-4000-8000-000000000001',
  segment2: '30000000-0000-4000-8000-000000000002',
  sentence1: '40000000-0000-4000-8000-000000000001',
  sentence2: '40000000-0000-4000-8000-000000000002',
  conceptA: '50000000-0000-4000-8000-000000000001',
  conceptB: '50000000-0000-4000-8000-000000000002',
} as const;

const userA = { id: IDS.actorA, email: 'reader-a@example.test', role: 'authenticated' } as User;
const userB = { id: IDS.actorB, email: 'reader-b@example.test', role: 'authenticated' } as User;

function session(user: User, suffix: string): Session {
  return {
    access_token: `token-${suffix}`,
    refresh_token: `refresh-${suffix}`,
    expires_in: 3600,
    expires_at: 9_999_999_999,
    token_type: 'bearer',
    user,
  } as Session;
}

type AuthChangeListener = (event: string, value: Session | null) => void;

function createMockSupabase(initialSession: Session | null = session(userA, 'a')) {
  let currentSession = initialSession;
  const listeners: AuthChangeListener[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
      onAuthStateChange: vi.fn((listener: AuthChangeListener) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
    switchUser(next: Session | null) {
      currentSession = next;
      listeners.forEach((listener) => listener('USER_UPDATED', next));
    },
  };
  return client as unknown as SupabaseClient & { switchUser(next: Session | null): void };
}

function makeContent(title = 'Live Reader Story', withProgress = false, isCompleted = false): ContentResponseDto {
  const base = structuredClone(mockContentResponse) as ContentResponseDto;
  return {
    ...base,
    data: {
      ...base.data,
      summary: {
        ...base.data.summary,
        id: IDS.content,
        title,
        isSaved: false,
        ...(withProgress
          ? {
              readingProgress: {
                contentId: IDS.content,
                currentSegmentId: IDS.segment2,
                furthestSegmentId: IDS.segment2,
                progressPercent: 50,
                isCompleted,
                startedAt: '2026-09-14T01:00:00Z',
                lastOpenedAt: '2026-09-14T01:05:00Z',
              },
            }
          : {}),
        attribution: {
          sourceName: 'LINGUA First Party',
          licenseCode: 'LINGUA-FIRST-PARTY',
          attributionText: 'Written and reviewed by LINGUA OS.',
        },
      },
      totalWords: 8,
      segments: [
        {
          id: IDS.segment1,
          order: 0,
          segmentType: 'paragraph',
          text: 'appointment first',
          sentences: [
            {
              id: IDS.sentence1,
              order: 0,
              text: 'appointment first',
              translation: 'cuộc hẹn đầu tiên',
              concepts: [
                {
                  conceptId: IDS.conceptA,
                  canonicalForm: 'appointment',
                  startOffset: 0,
                  endOffset: 11,
                  status: 'discovered',
                },
              ],
            },
          ],
        },
        {
          id: IDS.segment2,
          order: 1,
          segmentType: 'paragraph',
          text: 'available second',
          sentences: [
            {
              id: IDS.sentence2,
              order: 0,
              text: 'available second',
              translation: 'rảnh ở đoạn thứ hai',
              concepts: [
                {
                  conceptId: IDS.conceptB,
                  canonicalForm: 'available',
                  startOffset: 0,
                  endOffset: 9,
                  status: 'unseen',
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function installHappyPath(api: ApiClient, content = makeContent()) {
  vi.spyOn(api, 'listRecommendedContent').mockResolvedValue({
    data: [content.data.summary],
    meta: { requestId: 'recommendations', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
  });
  vi.spyOn(api, 'getContent').mockResolvedValue(content);
  vi.spyOn(api, 'getConcept').mockImplementation(async (conceptId) => ({
    ...mockConceptResponse,
    data: {
      ...mockConceptResponse.data,
      id: conceptId,
      canonicalForm: conceptId === IDS.conceptB ? 'available' : 'appointment',
    },
  }));
}

async function renderLive(api: ApiClient, supabase = createMockSupabase()) {
  setApiClient(api);
  const result = render(
    <AuthProvider customClient={supabase}>
      <InteractiveReader apiClient={api} />
    </AuthProvider>
  );
  await act(async () => {});
  return { ...result, supabase };
}

describe('TASK-READ-001 Reader live integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('READ-LIVE-01 loads only recommended published content and preserves segment/sentence order', async () => {
    const api = new MockApiClient();
    const content = makeContent();
    installHappyPath(api, content);
    await renderLive(api);

    expect(await screen.findByRole('heading', { level: 1, name: 'Live Reader Story' })).toBeInTheDocument();
    expect(screen.getByText(/Chạm từ được gạch dưới để tra từ/)).toBeInTheDocument();
    expect(screen.getByText(/lưu câu hoặc bài chỉ là dấu trang/)).toBeInTheDocument();
    const segments = screen.getAllByTestId('reader-segment');
    expect(segments.map((node) => node.getAttribute('data-segment-id'))).toEqual([
      IDS.segment1,
      IDS.segment2,
    ]);
    expect(screen.getAllByTestId('reader-sentence').map((node) => node.getAttribute('data-sentence-id'))).toEqual([
      IDS.sentence1,
      IDS.sentence2,
    ]);
    expect(screen.getByText('Written and reviewed by LINGUA OS.')).toBeInTheDocument();
    expect(screen.queryByText('Making an Appointment')).not.toBeInTheDocument();
  });

  it('READ-LIVE-02 shows an empty catalog without requesting fixture detail', async () => {
    const api = new MockApiClient();
    const detail = vi.spyOn(api, 'getContent');
    vi.spyOn(api, 'listRecommendedContent').mockResolvedValue({
      data: [],
      meta: { requestId: 'empty', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 0 },
    });
    await renderLive(api);
    expect(await screen.findByText('Chưa có bài đọc nào')).toBeInTheDocument();
    expect(detail).not.toHaveBeenCalled();
    expect(screen.queryByText('Making an Appointment')).not.toBeInTheDocument();
  });

  it('READ-LIVE-03 maps backend failure and supports an authoritative retry', async () => {
    const api = new MockApiClient();
    const list = vi.spyOn(api, 'listRecommendedContent')
      .mockRejectedValueOnce(new Error('private backend detail'))
      .mockResolvedValueOnce({
        data: [makeContent().data.summary],
        meta: { requestId: 'retry', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
      });
    vi.spyOn(api, 'getContent').mockResolvedValue(makeContent());
    await renderLive(api);
    expect(await screen.findByText('Không thể tải bài đọc')).toBeInTheDocument();
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('heading', { name: 'Live Reader Story' })).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('READ-LIVE-04 uses canonical concept ID for detail and lookup exposure without Save/Learn', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    const getConcept = vi.spyOn(api, 'getConcept');
    const exposure = vi.spyOn(api, 'recordReaderExposure').mockResolvedValue(mockApiResponses.readerExposure);
    const saveConcept = vi.spyOn(api, 'saveConceptToLibrary');
    await renderLive(api);

    fireEvent.click(await screen.findByRole('button', { name: 'appointment' }));
    await waitFor(() => expect(getConcept).toHaveBeenCalledWith(IDS.conceptA));
    await waitFor(() => expect(exposure).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        contentId: IDS.content,
        segmentId: IDS.segment1,
        sentenceId: IDS.sentence1,
        startOffset: 0,
        endOffset: 11,
        exposureType: 'lookup',
      }),
    })));
    expect(exposure.mock.calls[0]?.[0].body).not.toHaveProperty('conceptId');
    expect(saveConcept).not.toHaveBeenCalled();
  });

  it('READ-LIVE-05 records an explicit read exposure and authoritative progress', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    const exposure = vi.spyOn(api, 'recordReaderExposure').mockResolvedValue(mockApiResponses.readerExposure);
    const progress = vi.spyOn(api, 'updateReaderProgress').mockResolvedValue(mockApiResponses.readingProgress);
    await renderLive(api);

    fireEvent.click(await screen.findByRole('button', { name: 'Đã đọc đoạn 1' }));
    await waitFor(() => expect(exposure).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ segmentId: IDS.segment1, exposureType: 'read' }),
    })));
    await waitFor(() => expect(progress).toHaveBeenCalledWith(expect.objectContaining({
      contentId: IDS.content,
      body: expect.objectContaining({ currentSegmentId: IDS.segment1, isCompleted: false }),
    })));
  });

  it('READ-LIVE-06 saves sentence and content through their existing mutations with duplicate suppression', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    let releaseSentence!: () => void;
    const sentencePending = new Promise<void>((resolve) => { releaseSentence = resolve; });
    const saveSentence = vi.spyOn(api, 'saveReaderSentence').mockImplementation(async () => {
      await sentencePending;
      return { ...mockApiResponses.libraryMutation, data: { id: IDS.sentence1, itemType: 'sentence', isSaved: true } };
    });
    const saveContent = vi.spyOn(api, 'saveContentToLibrary').mockResolvedValue({
      ...mockApiResponses.libraryMutation,
      data: { id: IDS.content, itemType: 'content', isSaved: true },
    });
    await renderLive(api);

    const sentenceButton = await screen.findByRole('button', { name: 'Lưu câu 1' });
    fireEvent.click(sentenceButton);
    fireEvent.click(sentenceButton);
    expect(saveSentence).toHaveBeenCalledTimes(1);
    releaseSentence();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Câu 1 đã lưu' })).toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'Lưu bài đọc' }));
    await waitFor(() => expect(saveContent).toHaveBeenCalledWith(IDS.content));
    expect(screen.queryByRole('link', { name: 'Xem từ đến hạn ôn' })).not.toBeInTheDocument();
  });

  it('READ-LIVE-07 explicit concept Save/Learn uses only the canonical Library concept endpoint', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    const getTodayPlan = vi.spyOn(api, 'getTodayPlan');
    const listReviewQueue = vi.spyOn(api, 'listReviewQueue');
    vi.spyOn(api, 'recordReaderExposure').mockResolvedValue(mockApiResponses.readerExposure);
    const saveConcept = vi.spyOn(api, 'saveConceptToLibrary').mockResolvedValue({
      ...mockApiResponses.libraryMutation,
      data: { id: IDS.conceptA, itemType: 'concept', isSaved: true },
    });
    await renderLive(api);
    fireEvent.click(await screen.findByRole('button', { name: 'appointment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu vào ôn tập' }));
    await waitFor(() => expect(saveConcept).toHaveBeenCalledWith(IDS.conceptA));
    const reviewLink = await screen.findByRole('link', { name: 'Xem từ đến hạn ôn' });
    expect(reviewLink).toHaveAttribute('href', '/review');
    expect(getTodayPlan).not.toHaveBeenCalled();
    expect(listReviewQueue).not.toHaveBeenCalled();
  });

  it('READ-LIVE-07A does not offer review progression when concept Save/Learn fails', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    const getTodayPlan = vi.spyOn(api, 'getTodayPlan');
    const listReviewQueue = vi.spyOn(api, 'listReviewQueue');
    vi.spyOn(api, 'recordReaderExposure').mockResolvedValue(mockApiResponses.readerExposure);
    const saveConcept = vi.spyOn(api, 'saveConceptToLibrary').mockRejectedValue(new Error('save failed'));
    const updateProgress = vi.spyOn(api, 'updateReaderProgress');
    await renderLive(api);

    fireEvent.click(await screen.findByRole('button', { name: 'appointment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu vào ôn tập' }));
    expect(await screen.findByText('Không thể lưu từ vựng')).toBeInTheDocument();
    expect(saveConcept).toHaveBeenCalledWith(IDS.conceptA);
    expect(screen.queryByRole('link', { name: 'Xem từ đến hạn ôn' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Đã lưu “appointment” để học/)).not.toBeInTheDocument();
    expect(updateProgress).not.toHaveBeenCalled();
    expect(getTodayPlan).not.toHaveBeenCalled();
    expect(listReviewQueue).not.toHaveBeenCalled();
  });

  it('READ-LIVE-07B shows the Today link only for server-confirmed reading completion', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    const getTodayPlan = vi.spyOn(api, 'getTodayPlan');
    const listReviewQueue = vi.spyOn(api, 'listReviewQueue');
    vi.spyOn(api, 'recordReaderExposure').mockResolvedValue(mockApiResponses.readerExposure);
    const updateProgress = vi.spyOn(api, 'updateReaderProgress').mockResolvedValue({
      ...mockApiResponses.readingProgress,
      data: {
        ...mockApiResponses.readingProgress.data,
        contentId: IDS.content,
        currentSegmentId: IDS.segment2,
        furthestSegmentId: IDS.segment2,
        progressPercent: 100,
        isCompleted: true,
      },
    });
    await renderLive(api);

    expect(screen.queryByRole('link', { name: 'Xem kế hoạch hôm nay' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Hoàn thành bài đọc' }));
    const todayLink = await screen.findByRole('link', { name: 'Xem kế hoạch hôm nay' });
    expect(todayLink).toHaveAttribute('href', '/today');
    expect(updateProgress).toHaveBeenCalledWith(expect.objectContaining({
      contentId: IDS.content,
      body: expect.objectContaining({ currentSegmentId: IDS.segment2, isCompleted: true }),
    }));
    expect(getTodayPlan).not.toHaveBeenCalled();
    expect(listReviewQueue).not.toHaveBeenCalled();
  });

  it('READ-LIVE-07C does not show Today guidance for unread or incomplete server progress', async () => {
    const api = new MockApiClient();
    installHappyPath(api, makeContent('Unfinished Story', true, false));
    const getTodayPlan = vi.spyOn(api, 'getTodayPlan');
    await renderLive(api);

    expect(await screen.findByRole('heading', { name: 'Unfinished Story' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Xem kế hoạch hôm nay' })).not.toBeInTheDocument();
    expect(getTodayPlan).not.toHaveBeenCalled();
  });

  it('READ-LIVE-07D revealing a supplied sentence translation does not activate learning', async () => {
    const api = new MockApiClient();
    const original = makeContent();
    const content: ContentResponseDto = {
      ...original,
      data: {
        ...original.data,
        segments: original.data.segments.map((segment, index) => index === 1
          ? {
              ...segment,
              sentences: segment.sentences.map((sentence, sentenceIndex) => sentenceIndex === 0
                ? { ...sentence, translation: '' }
                : sentence),
            }
          : segment),
      },
    };
    installHappyPath(api, content);
    const exposure = vi.spyOn(api, 'recordReaderExposure');
    const getConcept = vi.spyOn(api, 'getConcept');
    const saveConcept = vi.spyOn(api, 'saveConceptToLibrary');
    await renderLive(api);

    expect(screen.getAllByRole('button', { name: 'Xem nghĩa câu' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Xem nghĩa câu' }));
    expect(await screen.findByText('cuộc hẹn đầu tiên')).toBeInTheDocument();
    expect(screen.queryByText('rảnh ở đoạn thứ hai')).not.toBeInTheDocument();
    expect(exposure).not.toHaveBeenCalled();
    expect(getConcept).not.toHaveBeenCalled();
    expect(saveConcept).not.toHaveBeenCalled();
  });

  it('READ-LIVE-08 restores server progress after remount without local persistence', async () => {
    const api = new MockApiClient();
    installHappyPath(api, makeContent('Resume Story', true));
    const first = await renderLive(api);
    expect(await screen.findByRole('progressbar')).toHaveAccessibleName('Tiến độ bài đọc: 50%');
    expect(screen.getByText('Đoạn 2 / 2')).toBeInTheDocument();
    first.unmount();
    await renderLive(api);
    expect(await screen.findByRole('progressbar')).toHaveAccessibleName('Tiến độ bài đọc: 50%');
    expect(screen.getByText('Đoạn 2 / 2')).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('READ-LIVE-09 retries one logical progress mutation with the same idempotency key', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    vi.spyOn(api, 'recordReaderExposure').mockResolvedValue(mockApiResponses.readerExposure);
    const update = vi.spyOn(api, 'updateReaderProgress')
      .mockRejectedValueOnce(new Error('ambiguous'))
      .mockResolvedValueOnce(mockApiResponses.readingProgress);
    await renderLive(api);
    const button = await screen.findByRole('button', { name: 'Đã đọc đoạn 1' });
    fireEvent.click(button);
    await screen.findByText('Không thể lưu tiến độ đọc');
    fireEvent.click(button);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]?.[0].headers['Idempotency-Key']).toBe(
      update.mock.calls[0]?.[0].headers['Idempotency-Key']
    );
  });

  it('READ-LIVE-10 drops stale same-actor concept responses', async () => {
    const api = new MockApiClient();
    installHappyPath(api);
    vi.spyOn(api, 'recordReaderExposure').mockResolvedValue(mockApiResponses.readerExposure);
    let resolveFirst!: (value: typeof mockConceptResponse) => void;
    const first = new Promise<typeof mockConceptResponse>((resolve) => { resolveFirst = resolve; });
    vi.spyOn(api, 'getConcept')
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ ...mockConceptResponse, data: { ...mockConceptResponse.data, id: IDS.conceptB, canonicalForm: 'available' } });
    await renderLive(api);
    fireEvent.click(await screen.findByRole('button', { name: 'appointment' }));
    fireEvent.click(screen.getByRole('button', { name: 'available' }));
    expect(await screen.findByRole('heading', { name: 'available' })).toBeInTheDocument();
    resolveFirst({ ...mockConceptResponse, data: { ...mockConceptResponse.data, id: IDS.conceptA, canonicalForm: 'appointment' } });
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'available' })).toBeInTheDocument();
  });

  it('READ-LIVE-11 isolates stale Actor A load from Actor B', async () => {
    const api = new MockApiClient();
    const supabase = createMockSupabase();
    let resolveA!: (value: ReturnType<typeof makeContent>) => void;
    const aDetail = new Promise<ReturnType<typeof makeContent>>((resolve) => { resolveA = resolve; });
    const bContent = makeContent('Actor B Story');
    vi.spyOn(api, 'listRecommendedContent').mockResolvedValue({
      data: [makeContent().data.summary],
      meta: { requestId: 'actors', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
    });
    vi.spyOn(api, 'getContent')
      .mockImplementationOnce(() => aDetail)
      .mockResolvedValueOnce(bContent);
    await renderLive(api, supabase);
    await waitFor(() => expect(api.getContent).toHaveBeenCalledTimes(1));
    act(() => supabase.switchUser(session(userB, 'b')));
    expect(await screen.findByRole('heading', { name: 'Actor B Story' })).toBeInTheDocument();
    resolveA(makeContent('Actor A Story'));
    await act(async () => {});
    expect(screen.queryByText('Actor A Story')).not.toBeInTheDocument();
  });

  it('READ-LIVE-12 clears Actor A content through logout/login before Actor B resolves', async () => {
    const api = new MockApiClient();
    const supabase = createMockSupabase();
    installHappyPath(api, makeContent('Actor A Story'));
    await renderLive(api, supabase);
    expect(await screen.findByText('Actor A Story')).toBeInTheDocument();
    act(() => supabase.switchUser(null));
    expect(screen.queryByText('Actor A Story')).not.toBeInTheDocument();
    act(() => supabase.switchUser(session(userB, 'b')));
    await waitFor(() => expect(api.listRecommendedContent).toHaveBeenCalledTimes(2));
  });
});
