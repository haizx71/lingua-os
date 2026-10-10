import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  MockApiClient,
  mockApiResponses,
  mockContentResponse,
  type ContentResponseDto,
} from '@lingua/types';
import ReadPage from '../../apps/web/src/app/read/page';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { useReaderSession } from '../../apps/web/src/features/read/useReaderSession';
import { setApiClient } from '../../apps/web/src/lib/api/client';

const IDS = {
  actor: '10000000-0000-4000-8000-000000000031',
  recommendation: '20000000-0000-4000-8000-000000000031',
  requested: '20000000-0000-4000-8000-000000000032',
  next: '20000000-0000-4000-8000-000000000033',
} as const;

const user = {
  id: IDS.actor,
  email: 'synthetic-reader@example.test',
  role: 'authenticated',
} as User;
const session = {
  access_token: 'synthetic-access-token',
  refresh_token: 'synthetic-refresh-token',
  expires_in: 3600,
  expires_at: 9_999_999_999,
  token_type: 'bearer',
  user,
} as Session;

type AuthChangeListener = (event: string, value: Session | null) => void;

function syntheticSupabase() {
  let currentSession: Session | null = session;
  const listeners: AuthChangeListener[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
      onAuthStateChange: vi.fn((listener: AuthChangeListener) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    switchActor(actorId: string | null) {
      currentSession = actorId === null ? null : {
        ...session,
        user: { ...user, id: actorId },
      } as Session;
      listeners.forEach((listener) => listener(actorId === null ? 'SIGNED_OUT' : 'USER_UPDATED', currentSession));
    },
  };
  return client as unknown as SupabaseClient & { switchActor(actorId: string | null): void };
}

function publishedContent(id: string, title: string): ContentResponseDto {
  const template = structuredClone(mockContentResponse) as ContentResponseDto;
  return {
    ...template,
    data: {
      ...template.data,
      summary: { ...template.data.summary, id, title, isSaved: false },
    },
  };
}

function pageFor(contentId?: string | string[]) {
  return ReadPage({ searchParams: Promise.resolve(contentId === undefined ? {} : { contentId }) });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function apiWithContent(contents: readonly ContentResponseDto[]) {
  const api = new MockApiClient();
  const getContent = vi.spyOn(api, 'getContent').mockImplementation(async (contentId) => {
    const content = contents.find((item) => item.data.summary.id === contentId);
    if (!content) throw new Error('Unexpected synthetic content ID');
    return content;
  });
  return { api, getContent };
}

describe('PILOT-005 explicit Reader content selection', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.clearAllMocks();
  });

  it('opens the contentId requested by the actual /read route instead of its first recommendation', async () => {
    const api = new MockApiClient();
    const recommendation = publishedContent(IDS.recommendation, 'First recommendation');
    const requested = publishedContent(IDS.requested, 'Second requested article');
    vi.spyOn(api, 'listRecommendedContent').mockResolvedValue({
      data: [recommendation.data.summary],
      meta: {
        requestId: 'synthetic-recommendations',
        apiVersion: '1.0',
        nextCursor: null,
        hasMore: false,
        pageSize: 1,
      },
    });
    const getContent = vi.spyOn(api, 'getContent').mockImplementation(async (contentId) => {
      if (contentId === IDS.recommendation) return recommendation;
      if (contentId === IDS.requested) return requested;
      throw new Error('Unexpected synthetic content ID');
    });

    setApiClient(api);
    const page = await pageFor(IDS.requested);
    render(
      <AuthProvider customClient={syntheticSupabase()}>
        {page}
      </AuthProvider>,
    );
    await act(async () => {});

    const renderedTitle = await screen.findByRole('heading', { level: 1 });
    await expect({
      renderedTitle: renderedTitle.textContent,
      fetchedContentIds: getContent.mock.calls.map(([contentId]) => contentId),
    }).toEqual({
      renderedTitle: 'Second requested article',
      fetchedContentIds: [IDS.requested],
    });
    expect(api.listRecommendedContent).not.toHaveBeenCalled();
  });

  it('keeps recommendation-first loading when contentId is absent', async () => {
    const api = new MockApiClient();
    const recommendation = publishedContent(IDS.recommendation, 'Recommended article');
    vi.spyOn(api, 'listRecommendedContent').mockResolvedValue({
      data: [recommendation.data.summary],
      meta: { requestId: 'synthetic-recommendations', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
    });
    const getContent = vi.spyOn(api, 'getContent').mockResolvedValue(recommendation);

    setApiClient(api);
    render(<AuthProvider customClient={syntheticSupabase()}>{await pageFor()}</AuthProvider>);

    expect(await screen.findByRole('heading', { level: 1, name: 'Recommended article' })).toBeInTheDocument();
    expect(api.listRecommendedContent).toHaveBeenCalledTimes(1);
    expect(getContent).toHaveBeenCalledExactlyOnceWith(IDS.recommendation);
  });

  it.each([
    ['blank selector', ''],
    ['malformed selector', 'not-a-uuid'],
    ['duplicate selector', [IDS.requested, IDS.next]],
  ])('fails closed for a %s without requesting recommendations or content', async (_label, contentId) => {
    const api = new MockApiClient();
    const recommendations = vi.spyOn(api, 'listRecommendedContent');
    const getContent = vi.spyOn(api, 'getContent');

    setApiClient(api);
    render(<AuthProvider customClient={syntheticSupabase()}>{await pageFor(contentId)}</AuthProvider>);

    expect(await screen.findByText(/Bài đọc này không khả dụng/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại|Tải lại|Thử lại/ })).toBeInTheDocument();
    expect(recommendations).not.toHaveBeenCalled();
    expect(getContent).not.toHaveBeenCalled();
  });

  it.each(['not-found', 'mismatched-response'])('does not fall back after a requested item is %s', async (failure) => {
    const api = new MockApiClient();
    const recommendations = vi.spyOn(api, 'listRecommendedContent');
    const getContent = vi.spyOn(api, 'getContent').mockImplementation(async () => {
      if (failure === 'not-found') throw new Error('not published or inaccessible');
      return publishedContent(IDS.recommendation, 'Wrong response identity');
    });

    setApiClient(api);
    render(<AuthProvider customClient={syntheticSupabase()}>{await pageFor(IDS.requested)}</AuthProvider>);

    expect(await screen.findByText(/Bài đọc này không khả dụng/)).toBeInTheDocument();
    expect(recommendations).not.toHaveBeenCalled();
    expect(getContent).toHaveBeenCalledExactlyOnceWith(IDS.requested);
    expect(screen.queryByRole('heading', { name: 'Wrong response identity' })).not.toBeInTheDocument();
  });

  it('ignores a late load for route A after route B has been selected', async () => {
    const api = new MockApiClient();
    const aContent = deferred<ContentResponseDto>();
    const b = publishedContent(IDS.next, 'Route B article');
    const getContent = vi.spyOn(api, 'getContent').mockImplementation((contentId) =>
      contentId === IDS.requested ? aContent.promise : Promise.resolve(b),
    );
    const supabase = syntheticSupabase();
    setApiClient(api);
    const rendered = render(<AuthProvider customClient={supabase}>{await pageFor(IDS.requested)}</AuthProvider>);
    await waitFor(() => expect(getContent).toHaveBeenCalledWith(IDS.requested));

    rendered.rerender(<AuthProvider customClient={supabase}>{await pageFor(IDS.next)}</AuthProvider>);
    expect(await screen.findByRole('heading', { level: 1, name: 'Route B article' })).toBeInTheDocument();
    await act(async () => { aContent.resolve(publishedContent(IDS.requested, 'Late route A article')); });

    expect(screen.getByRole('heading', { level: 1, name: 'Route B article' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Late route A article' })).not.toBeInTheDocument();
  });

  it('ignores a selected content load started by Actor A after switching to Actor B', async () => {
    const api = new MockApiClient();
    const aContent = deferred<ContentResponseDto>();
    const getContent = vi.spyOn(api, 'getContent')
      .mockImplementationOnce(() => aContent.promise)
      .mockResolvedValueOnce(publishedContent(IDS.requested, 'Actor B selected article'));
    const supabase = syntheticSupabase();
    setApiClient(api);
    render(<AuthProvider customClient={supabase}>{await pageFor(IDS.requested)}</AuthProvider>);
    await waitFor(() => expect(getContent).toHaveBeenCalledTimes(1));

    act(() => { supabase.switchActor('10000000-0000-4000-8000-000000000032'); });
    expect(await screen.findByRole('heading', { level: 1, name: 'Actor B selected article' })).toBeInTheDocument();
    await act(async () => { aContent.resolve(publishedContent(IDS.requested, 'Late Actor A selected article')); });

    expect(screen.getByRole('heading', { level: 1, name: 'Actor B selected article' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Late Actor A selected article' })).not.toBeInTheDocument();
  });

  it('keeps a late lookup and exposure error/finally from changing B inspector state', async () => {
    const contentA = publishedContent(IDS.requested, 'Route A article');
    const contentB = publishedContent(IDS.next, 'Route B article');
    const { api } = apiWithContent([contentA, contentB]);
    const lookupA = deferred<typeof mockApiResponses.concept>();
    const lookupB = deferred<typeof mockApiResponses.concept>();
    const getConcept = vi.spyOn(api, 'getConcept')
      .mockImplementationOnce(() => lookupA.promise)
      .mockImplementationOnce(() => lookupB.promise);
    const exposureA = deferred<typeof mockApiResponses.readerExposure>();
    const recordExposure = vi.spyOn(api, 'recordReaderExposure').mockImplementation((input) =>
      input.body.contentId === IDS.requested ? exposureA.promise : Promise.resolve(mockApiResponses.readerExposure),
    );
    const supabase = syntheticSupabase();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider customClient={supabase}>{children}</AuthProvider>
    );
    const { result, rerender } = renderHook(
      ({ contentId }: { contentId: string }) => useReaderSession({ apiClient: api, requestedContentId: contentId }),
      { initialProps: { contentId: IDS.requested }, wrapper },
    );

    await waitFor(() => expect(result.current.passage?.id).toBe(IDS.requested));
    const findToken = (raw: string) => result.current.passage!.sentences
      .flatMap((sentence) => sentence.tokens)
      .find((token) => token.raw === raw)!;
    act(() => { void result.current.inspectToken(findToken('appointment')); });
    await waitFor(() => expect(getConcept).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(recordExposure).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ contentId: IDS.requested, exposureType: 'lookup' }),
    })));

    rerender({ contentId: IDS.next });
    await waitFor(() => expect(result.current.passage?.id).toBe(IDS.next));
    act(() => { void result.current.inspectToken(findToken('available')); });
    await waitFor(() => expect(getConcept).toHaveBeenCalledTimes(2));
    expect(result.current.inspecting).toBe(true);
    expect(result.current.selectedToken?.raw).toBe('available');

    await act(async () => {
      lookupA.resolve({ ...mockApiResponses.concept, data: { ...mockApiResponses.concept.data, id: getConcept.mock.calls[0]![0] } });
      exposureA.reject(new Error('late lookup exposure failure'));
    });

    expect(result.current.inspecting).toBe(true);
    expect(result.current.selectedToken?.raw).toBe('available');
    expect(result.current.actionError).toBeNull();
    await act(async () => {
      lookupB.resolve({ ...mockApiResponses.concept, data: { ...mockApiResponses.concept.data, id: getConcept.mock.calls[1]![0] } });
    });
    await waitFor(() => expect(result.current.inspecting).toBe(false));
  });

  it('keeps late A save success, error, and finally out of B while preserving B busy state', async () => {
    const contentA = publishedContent(IDS.requested, 'Route A article');
    const contentB = publishedContent(IDS.next, 'Route B article');
    const { api } = apiWithContent([contentA, contentB]);
    const saveA = deferred<typeof mockApiResponses.libraryMutation>();
    const saveB = deferred<typeof mockApiResponses.libraryMutation>();
    const sentenceA = deferred<typeof mockApiResponses.libraryMutation>();
    const conceptA = deferred<typeof mockApiResponses.libraryMutation>();
    vi.spyOn(api, 'saveContentToLibrary').mockImplementation((contentId) => contentId === IDS.requested ? saveA.promise : saveB.promise);
    vi.spyOn(api, 'saveReaderSentence').mockReturnValue(sentenceA.promise);
    vi.spyOn(api, 'getConcept').mockResolvedValue(mockApiResponses.concept);
    vi.spyOn(api, 'saveConceptToLibrary').mockReturnValue(conceptA.promise);
    const supabase = syntheticSupabase();
    setApiClient(api);
    const rendered = render(<AuthProvider customClient={supabase}>{await pageFor(IDS.requested)}</AuthProvider>);

    await screen.findByRole('heading', { level: 1, name: 'Route A article' });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bài đọc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu câu 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'appointment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu vào ôn tập' }));
    await waitFor(() => {
      expect(api.saveContentToLibrary).toHaveBeenCalledWith(IDS.requested);
      expect(api.saveReaderSentence).toHaveBeenCalled();
      expect(api.saveConceptToLibrary).toHaveBeenCalled();
    });

    rendered.rerender(<AuthProvider customClient={supabase}>{await pageFor(IDS.next)}</AuthProvider>);
    await screen.findByRole('heading', { level: 1, name: 'Route B article' });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bài đọc' }));
    await waitFor(() => expect(api.saveContentToLibrary).toHaveBeenCalledWith(IDS.next));

    await act(async () => {
      saveA.resolve({ ...mockApiResponses.libraryMutation, data: { ...mockApiResponses.libraryMutation.data, id: IDS.requested, itemType: 'content', isSaved: true } });
      sentenceA.reject(new Error('late sentence save failure'));
      conceptA.resolve({ ...mockApiResponses.libraryMutation, data: { ...mockApiResponses.libraryMutation.data, id: IDS.recommendation, itemType: 'concept', isSaved: true } });
    });
    const bSaveButton = screen.getByRole('button', { name: 'Lưu bài đọc' });
    expect(bSaveButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Đã lưu bài đọc' })).not.toBeInTheDocument();
    expect(screen.queryByText('Không thể lưu câu')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Đã lưu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đã lưu vào Brain' })).not.toBeInTheDocument();

    await act(async () => {
      saveB.resolve({ ...mockApiResponses.libraryMutation, data: { ...mockApiResponses.libraryMutation.data, id: IDS.next, itemType: 'content', isSaved: true } });
    });
    expect(await screen.findByRole('button', { name: 'Đã lưu bài đọc' })).toBeInTheDocument();
  });

  it('keeps progress and exposure requests bound to A and ignores their late completion on B', async () => {
    const contentA = publishedContent(IDS.requested, 'Route A article');
    const contentB = publishedContent(IDS.next, 'Route B article');
    const { api } = apiWithContent([contentA, contentB]);
    const exposureA = deferred<typeof mockApiResponses.readerExposure>();
    const progressA = deferred<typeof mockApiResponses.readingProgress>();
    const exposure = vi.spyOn(api, 'recordReaderExposure').mockImplementation((input) =>
      input.body.contentId === IDS.requested ? exposureA.promise : Promise.resolve(mockApiResponses.readerExposure),
    );
    const progress = vi.spyOn(api, 'updateReaderProgress').mockReturnValue(progressA.promise);
    const supabase = syntheticSupabase();
    setApiClient(api);
    const rendered = render(<AuthProvider customClient={supabase}>{await pageFor(IDS.requested)}</AuthProvider>);

    await screen.findByRole('heading', { level: 1, name: 'Route A article' });
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành bài đọc' }));
    await waitFor(() => expect(exposure).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ contentId: IDS.requested, exposureType: 'read' }),
    })));

    rendered.rerender(<AuthProvider customClient={supabase}>{await pageFor(IDS.next)}</AuthProvider>);
    await screen.findByRole('heading', { level: 1, name: 'Route B article' });
    await act(async () => { exposureA.resolve(mockApiResponses.readerExposure); });
    await waitFor(() => expect(progress).toHaveBeenCalledWith(expect.objectContaining({
      contentId: IDS.requested,
      body: expect.objectContaining({ languageProfileId: mockApiResponses.me.data.languageProfiles[0]!.id }),
    })));
    await act(async () => {
      progressA.resolve({
        ...mockApiResponses.readingProgress,
        data: { ...mockApiResponses.readingProgress.data, contentId: IDS.requested, isCompleted: true, progressPercent: 100 },
      });
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Route B article' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Xem kế hoạch hôm nay' })).not.toBeInTheDocument();
  });

  it('invalidates an in-flight save when retry reloads under a changed active profile', async () => {
    const api = new MockApiClient();
    const profileA = { ...mockApiResponses.me.data.languageProfiles[0]!, id: '60000000-0000-4000-8000-000000000001' };
    const profileB = { ...mockApiResponses.me.data.languageProfiles[0]!, id: '60000000-0000-4000-8000-000000000002' };
    vi.spyOn(api, 'getMe')
      .mockResolvedValueOnce({ ...mockApiResponses.me, data: { ...mockApiResponses.me.data, languageProfiles: [profileA] } })
      .mockResolvedValueOnce({ ...mockApiResponses.me, data: { ...mockApiResponses.me.data, languageProfiles: [profileB] } });
    vi.spyOn(api, 'getContent').mockResolvedValue(publishedContent(IDS.requested, 'Profile change article'));
    const save = deferred<typeof mockApiResponses.libraryMutation>();
    vi.spyOn(api, 'saveContentToLibrary').mockReturnValue(save.promise);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider customClient={syntheticSupabase()}>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useReaderSession({ apiClient: api, requestedContentId: IDS.requested }), { wrapper });

    await waitFor(() => expect(result.current.languageProfileId).toBe(profileA.id));
    act(() => { void result.current.saveContent(); });
    await waitFor(() => expect(api.saveContentToLibrary).toHaveBeenCalledWith(IDS.requested));
    act(() => { result.current.retry(); });
    await waitFor(() => expect(result.current.languageProfileId).toBe(profileB.id));
    await act(async () => {
      save.resolve({ ...mockApiResponses.libraryMutation, data: { ...mockApiResponses.libraryMutation.data, id: IDS.requested, itemType: 'content', isSaved: true } });
    });

    expect(result.current.passage?.isSaved).toBe(false);
    expect(result.current.actionError).toBeNull();
  });
});
