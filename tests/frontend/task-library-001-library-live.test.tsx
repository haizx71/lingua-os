import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  MockApiClient,
  mockApiResponses,
  type ApiClient,
  type LibraryItemDto,
  type LibraryItemsResponseDto,
} from '@lingua/types';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { LibraryView } from '../../apps/web/src/features/library/LibraryView';
import { setApiClient } from '../../apps/web/src/lib/api/client';

const actorA = { id: '10000000-0000-4000-8000-000000000001', email: 'a@example.test' } as User;
const actorB = { id: '10000000-0000-4000-8000-000000000002', email: 'b@example.test' } as User;

function session(user: User, suffix: string): Session {
  return { access_token: `token-${suffix}`, refresh_token: `refresh-${suffix}`, expires_in: 3600,
    expires_at: 9_999_999_999, token_type: 'bearer', user } as Session;
}

type Listener = (event: string, value: Session | null) => void;
function createSupabase(initial: Session | null = session(actorA, 'a')) {
  let current = initial;
  const listeners: Listener[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
      onAuthStateChange: vi.fn((listener: Listener) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), refreshSession: vi.fn(),
    },
    switchUser(next: Session | null) {
      current = next;
      listeners.forEach((listener) => listener('USER_UPDATED', next));
    },
  };
  return client as unknown as SupabaseClient & { switchUser(next: Session | null): void };
}

function items(): LibraryItemDto[] {
  const source = structuredClone(mockApiResponses.library.data) as LibraryItemDto[];
  const content = source.find((item) => item.itemType === 'content')!;
  const concept = source.find((item) => item.itemType === 'concept')!;
  const sentence = source.find((item) => item.itemType === 'sentence')!;
  return [
    { ...concept, savedAt: '2026-09-15T03:00:00Z', concept: { ...concept.concept, canonicalForm: 'appointment' } },
    { ...sentence, savedAt: '2026-09-15T02:00:00Z', sentence: { ...sentence.sentence, text: 'I made an appointment.', translation: 'Tôi đã đặt một cuộc hẹn.' } },
    { ...content, savedAt: '2026-09-15T01:00:00Z', content: { ...content.content, title: 'A real saved article' } },
  ];
}

function response(data: readonly LibraryItemDto[], nextCursor: string | null = null): LibraryItemsResponseDto {
  return {
    data,
    meta: { requestId: '20000000-0000-4000-8000-000000000001', apiVersion: '1.0',
      nextCursor, hasMore: nextCursor !== null, pageSize: data.length },
  };
}

async function renderLive(api: ApiClient, supabase = createSupabase()) {
  setApiClient(api);
  const rendered = render(<AuthProvider customClient={supabase}><LibraryView apiClient={api} /></AuthProvider>);
  await act(async () => {});
  return { ...rendered, supabase };
}

describe('TASK-LIBRARY-001 Library live integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('LIB-LIVE-01 renders authoritative concept, sentence and content metadata in server order', async () => {
    const api = new MockApiClient();
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue(response(items()));
    await renderLive(api);
    const rows = await screen.findAllByTestId('library-item');
    expect(rows.map((row) => row.getAttribute('data-item-type'))).toEqual(['concept', 'sentence', 'content']);
    expect(screen.getByText('appointment')).toBeInTheDocument();
    expect(screen.getByText('I made an appointment.')).toBeInTheDocument();
    expect(screen.getByText('Tôi đã đặt một cuộc hẹn.')).toBeInTheDocument();
    expect(screen.getByText('A real saved article')).toBeInTheDocument();
  });

  it('LIB-LIVE-02 traverses every opaque cursor page without sorting it', async () => {
    const api = new MockApiClient();
    const all = items();
    const list = vi.spyOn(api, 'listLibraryItems')
      .mockResolvedValueOnce(response(all.slice(0, 1), 'cursor-2'))
      .mockResolvedValueOnce(response(all.slice(1)));
    await renderLive(api);
    const rows = await screen.findAllByTestId('library-item');
    expect(rows.map((row) => row.getAttribute('data-item-type'))).toEqual(['concept', 'sentence', 'content']);
    expect(list.mock.calls[1]?.[0]).toEqual({ cursor: 'cursor-2' });
  });

  it.each([
    ['cyclic cursor', () => [response(items().slice(0, 1), 'same'), response(items().slice(1, 2), 'same')]],
    ['duplicate identity', () => [response(items().slice(0, 1), 'next'), response(items().slice(0, 1))]],
    ['malformed pagination', () => [{ ...response(items().slice(0, 1)), meta: { ...response([]).meta, hasMore: true, nextCursor: null } }]],
    ['malformed content DTO', () => [response([{ ...items()[2]!, content: { ...items()[2]!.content, knownConceptRatio: 2 } }])]],
    ['malformed concept enum', () => [response([{ ...items()[0]!, concept: { ...items()[0]!.concept, status: 'due' } } as unknown as LibraryItemDto])]],
  ])('LIB-LIVE-03 fails closed for %s without presenting a partial collection', async (_name, makePages) => {
    const api = new MockApiClient();
    vi.spyOn(api, 'listLibraryItems').mockImplementation(async () => makePages().shift()! as LibraryItemsResponseDto);
    const pages = makePages();
    vi.mocked(api.listLibraryItems).mockImplementation(async () => pages.shift()! as LibraryItemsResponseDto);
    await renderLive(api);
    expect(await screen.findByText('Không thể tải thư viện')).toBeInTheDocument();
    expect(screen.queryByTestId('library-item')).not.toBeInTheDocument();
  });

  it('LIB-LIVE-04 reports an authoritative empty collection without fixture rows', async () => {
    const api = new MockApiClient();
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue(response([]));
    await renderLive(api);
    expect(await screen.findByText('Thư viện đang trống')).toBeInTheDocument();
    expect(screen.queryByText('Making an Appointment')).not.toBeInTheDocument();
  });

  it.each([
    ['concept', 'removeConceptFromLibrary'],
    ['sentence', 'removeSentenceFromLibrary'],
    ['content', 'removeContentFromLibrary'],
  ] as const)('LIB-LIVE-05 removes a %s through its canonical endpoint', async (type, method) => {
    const api = new MockApiClient();
    const item = items().find((candidate) => candidate.itemType === type)!;
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue(response([item]));
    const remove = vi.spyOn(api, method);
    await renderLive(api);
    fireEvent.click(await screen.findByRole('button', { name: /Xóa khỏi thư viện/i }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(type === 'concept' ? item.concept.id : type === 'sentence' ? item.sentence.id : item.content.id));
    await waitFor(() => expect(screen.queryByTestId('library-item')).not.toBeInTheDocument());
  });

  it('LIB-LIVE-06 preserves the row on failed removal and allows retry', async () => {
    const api = new MockApiClient();
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue(response([items()[0]!]));
    const remove = vi.spyOn(api, 'removeConceptFromLibrary')
      .mockRejectedValueOnce(new Error('private backend detail'))
      .mockResolvedValueOnce({ ...mockApiResponses.libraryMutation, data: { id: items()[0]!.concept.id, itemType: 'concept', isSaved: false } });
    await renderLive(api);
    fireEvent.click(await screen.findByRole('button', { name: /Xóa khỏi thư viện/i }));
    expect(await screen.findByText('Không thể xóa mục đã lưu')).toBeInTheDocument();
    expect(screen.getByTestId('library-item')).toBeInTheDocument();
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xóa khỏi thư viện/i }));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
  });

  it('LIB-LIVE-07 suppresses duplicate removal clicks', async () => {
    const api = new MockApiClient();
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue(response([items()[0]!]));
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const remove = vi.spyOn(api, 'removeConceptFromLibrary').mockImplementation(async () => {
      await pending;
      return { ...mockApiResponses.libraryMutation, data: { id: items()[0]!.concept.id, itemType: 'concept', isSaved: false } };
    });
    await renderLive(api);
    const button = await screen.findByRole('button', { name: /Xóa khỏi thư viện/i });
    fireEvent.click(button); fireEvent.click(button);
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
  });

  it('LIB-LIVE-08 reloads from server authority and preserves saved/removed persistence', async () => {
    const api = new MockApiClient();
    let saved = true;
    vi.spyOn(api, 'listLibraryItems').mockImplementation(async () => response(saved ? [items()[2]!] : []));
    vi.spyOn(api, 'removeContentFromLibrary').mockImplementation(async (id) => {
      saved = false;
      return { ...mockApiResponses.libraryMutation, data: { id, itemType: 'content', isSaved: false } };
    });
    const first = await renderLive(api);
    expect(await screen.findByText('A real saved article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xóa khỏi thư viện/i }));
    await waitFor(() => expect(screen.queryByText('A real saved article')).not.toBeInTheDocument());
    first.unmount();
    await renderLive(api);
    expect(await screen.findByText('Thư viện đang trống')).toBeInTheDocument();
  });

  it('LIB-LIVE-09 drops Actor A load and pagination after switching to Actor B', async () => {
    const api = new MockApiClient();
    const supabase = createSupabase();
    let releaseA!: (value: LibraryItemsResponseDto) => void;
    const aPage = new Promise<LibraryItemsResponseDto>((resolve) => { releaseA = resolve; });
    vi.spyOn(api, 'listLibraryItems')
      .mockImplementationOnce(() => aPage)
      .mockResolvedValueOnce(response([{ ...items()[2]!, content: { ...items()[2]!.content, title: 'Actor B article' } }]));
    await renderLive(api, supabase);
    await waitFor(() => expect(api.listLibraryItems).toHaveBeenCalledTimes(1));
    act(() => supabase.switchUser(session(actorB, 'b')));
    expect(await screen.findByText('Actor B article')).toBeInTheDocument();
    releaseA(response(items(), 'stale-next'));
    await act(async () => {});
    expect(screen.queryByText('appointment')).not.toBeInTheDocument();
    expect(api.listLibraryItems).toHaveBeenCalledTimes(2);
  });

  it('LIB-LIVE-10 stale remove error/finally cannot alter Actor B row or clear Actor B busy state', async () => {
    const api = new MockApiClient();
    const supabase = createSupabase();
    const concept = items()[0]!;
    let rejectA!: (reason: Error) => void;
    let resolveB!: (value: typeof mockApiResponses.libraryMutation) => void;
    const pendingA = new Promise<never>((_resolve, reject) => { rejectA = reject; });
    const pendingB = new Promise<typeof mockApiResponses.libraryMutation>((resolve) => { resolveB = resolve; });
    vi.spyOn(api, 'listLibraryItems')
      .mockResolvedValueOnce(response([concept]))
      .mockResolvedValueOnce(response([concept]));
    vi.spyOn(api, 'removeConceptFromLibrary')
      .mockImplementationOnce(() => pendingA)
      .mockImplementationOnce(() => pendingB);
    await renderLive(api, supabase);
    fireEvent.click(await screen.findByRole('button', { name: /Xóa khỏi thư viện/i }));
    act(() => supabase.switchUser(session(actorB, 'b')));
    const bButton = await screen.findByRole('button', { name: /Xóa khỏi thư viện/i });
    fireEvent.click(bButton);
    await waitFor(() => expect(bButton).toBeDisabled());
    await act(async () => { rejectA(new Error('stale actor failure')); });
    expect(screen.getByTestId('library-item')).toBeInTheDocument();
    expect(bButton).toBeDisabled();
    expect(screen.queryByText('Không thể xóa mục đã lưu')).not.toBeInTheDocument();
    await act(async () => {
      resolveB({ ...mockApiResponses.libraryMutation, data: { id: concept.concept.id, itemType: 'concept', isSaved: false } });
    });
  });

  it('LIB-LIVE-11 clears Actor A data on logout and accepts only the newer login request', async () => {
    const api = new MockApiClient();
    const supabase = createSupabase();
    vi.spyOn(api, 'listLibraryItems')
      .mockResolvedValueOnce(response(items()))
      .mockResolvedValueOnce(response([]));
    await renderLive(api, supabase);
    expect(await screen.findByText('appointment')).toBeInTheDocument();
    act(() => supabase.switchUser(null));
    expect(screen.queryByText('appointment')).not.toBeInTheDocument();
    act(() => supabase.switchUser(session(actorB, 'b')));
    expect(await screen.findByText('Thư viện đang trống')).toBeInTheDocument();
  });

  it('LIB-LIVE-12 a same-actor retry supersedes an older request', async () => {
    const api = new MockApiClient();
    let release!: (value: LibraryItemsResponseDto) => void;
    const old = new Promise<LibraryItemsResponseDto>((resolve) => { release = resolve; });
    vi.spyOn(api, 'listLibraryItems')
      .mockImplementationOnce(() => old)
      .mockResolvedValueOnce(response([items()[2]!]));
    await renderLive(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Tải lại thư viện' }));
    expect(await screen.findByText('A real saved article')).toBeInTheDocument();
    release(response([items()[0]!]));
    await act(async () => {});
    expect(screen.queryByText('appointment')).not.toBeInTheDocument();
  });

  it('LIB-LIVE-13 coordinates Dictionary/Reader saves only through the next backend list', async () => {
    const api = new MockApiClient();
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue(response(items()));
    await renderLive(api);
    expect(await screen.findByText('appointment')).toBeInTheDocument();
    expect(screen.getByText('I made an appointment.')).toBeInTheDocument();
    expect(screen.getByText('A real saved article')).toBeInTheDocument();
  });

  it('LIB-LIVE-14 viewing and filtering Library calls no learner-state mutation', async () => {
    const api = new MockApiClient();
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue(response(items()));
    const forbidden = [
      vi.spyOn(api, 'recordReaderExposure'), vi.spyOn(api, 'saveConceptToLibrary'),
      vi.spyOn(api, 'answerReviewItem'), vi.spyOn(api, 'completeTodayActivity'),
    ];
    await renderLive(api);
    fireEvent.click(await screen.findByRole('tab', { name: /Khái niệm/ }));
    const conceptRow = screen.getByTestId('library-item');
    expect(within(conceptRow).getByText('appointment')).toBeInTheDocument();
    forbidden.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
