import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { DictionaryView } from '../../apps/web/src/features/dictionary/DictionaryView';
import {
  MockApiClient,
  mockConceptSummary,
  mockSecondConceptSummary,
  type ApiClient,
  type DictionarySearchResponseDto,
  type LibraryMutationResponseDto,
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
      signInWithPassword: vi.fn(async () => ({ data: { session: currentSession, user: currentSession?.user ?? null }, error: null })),
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

describe('TASK-009 MINI: Live Concept Discovery + Explicit Save/Learn UI', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase(sessionA);
    api = new MockApiClient();
    // By default in unit tests, mock listLibraryItems returns empty list so tests start clean
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue({
      data: [],
      meta: { requestId: 'req-clean', hasMore: false, pageSize: 0 },
    });
  });

  async function renderDictionary(customApi = api, initialConcepts?: any[]) {
    const rendered = render(
      <AuthProvider customClient={mockSupabase}>
        <DictionaryView apiClient={customApi} initialConcepts={initialConcepts} />
      </AuthProvider>
    );
    // Allow AuthProvider session bootstrap to settle
    await act(async () => {});
    return rendered;
  }

  it('TEST-009-01: authenticated ready learner searches and renders backend concepts', async () => {
    const searchSpy = vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 1 },
    });

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'appointment' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith({ query: 'appointment' });
    });

    expect(await screen.findByRole('heading', { level: 2, name: 'appointment' })).toBeInTheDocument();
  });

  it('TEST-009-02: concept IDs preserved through adapter/view model without mutation', async () => {
    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 1 },
    });

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'appointment' } });

    const heading = await screen.findByRole('heading', { level: 2, name: 'appointment' });
    expect(heading).toBeInTheDocument();

    // Verify Save button is tagged with concept term
    expect(screen.getByRole('button', { name: /Lưu từ appointment để học/i })).toBeInTheDocument();
  });

  it('TEST-009-03: empty/no-result state handled cleanly when query yields no items', async () => {
    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [],
      meta: { requestId: 'req-empty', hasMore: false, pageSize: 0 },
    });

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'unknownwordxyz' } });

    expect(await screen.findByText('Không tìm thấy từ vựng')).toBeInTheDocument();
    expect(
      screen.getByText('Không có kết quả nào khớp với từ khóa tìm kiếm của bạn.')
    ).toBeInTheDocument();
  });

  it('TEST-009-04: search API error state renders actionable error alert with retry', async () => {
    const searchSpy = vi.spyOn(api, 'searchDictionary')
      .mockRejectedValueOnce(new Error('Mạng không ổn định'))
      .mockResolvedValueOnce({
        data: [mockConceptSummary],
        meta: { requestId: 'req-retry', hasMore: false, pageSize: 1 },
      });

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'appointment' } });

    expect(await screen.findByText('Mạng không ổn định')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByRole('heading', { level: 2, name: 'appointment' })).toBeInTheDocument();
  });

  it('TEST-009-05: stale search results do not overwrite newer query results (cat -> dog)', async () => {
    let resolveCat: (val: DictionarySearchResponseDto) => void;
    let resolveDog: (val: DictionarySearchResponseDto) => void;

    const catPromise = new Promise<DictionarySearchResponseDto>((resolve) => {
      resolveCat = resolve;
    });
    const dogPromise = new Promise<DictionarySearchResponseDto>((resolve) => {
      resolveDog = resolve;
    });

    vi.spyOn(api, 'searchDictionary').mockImplementation(async ({ query }) => {
      if (query === 'cat') return catPromise;
      if (query === 'dog') return dogPromise;
      return { data: [], meta: { requestId: 'req', hasMore: false, pageSize: 0 } };
    });

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);

    // 1. User types 'cat'
    fireEvent.change(searchInput, { target: { value: 'cat' } });

    // 2. User rapidly changes to 'dog'
    fireEvent.change(searchInput, { target: { value: 'dog' } });

    // 3. 'dog' query completes first
    await act(async () => {
      resolveDog({
        data: [{ ...mockConceptSummary, id: 'dog-id', canonicalForm: 'dog' }],
        meta: { requestId: 'req-dog', hasMore: false, pageSize: 1 },
      });
    });

    expect(await screen.findByRole('heading', { level: 2, name: 'dog' })).toBeInTheDocument();

    // 4. Stale 'cat' query arrives late
    await act(async () => {
      resolveCat({
        data: [{ ...mockConceptSummary, id: 'cat-id', canonicalForm: 'cat' }],
        meta: { requestId: 'req-cat', hasMore: false, pageSize: 1 },
      });
    });

    // 5. 'cat' MUST be dropped; 'dog' remains active!
    expect(screen.queryByRole('heading', { level: 2, name: 'cat' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'dog' })).toBeInTheDocument();
  });

  it('TEST-009-06: stale Actor A search cannot modify Actor B UI', async () => {
    let resolveSearchA: (val: DictionarySearchResponseDto) => void;
    const searchPromiseA = new Promise<DictionarySearchResponseDto>((resolve) => {
      resolveSearchA = resolve;
    });

    vi.spyOn(api, 'searchDictionary').mockImplementation(async () => searchPromiseA);

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'concept-for-actor-a' } });

    // Actor switches to Actor B before request A resolves
    await act(async () => {
      mockSupabase.switchUser(sessionB);
    });

    // Request A finally resolves
    await act(async () => {
      resolveSearchA({
        data: [{ ...mockConceptSummary, id: 'actor-a-concept', canonicalForm: 'actor-a-term' }],
        meta: { requestId: 'req-a', hasMore: false, pageSize: 1 },
      });
    });

    // Actor A's result must not be committed to Actor B's view
    expect(screen.queryByRole('heading', { level: 2, name: 'actor-a-term' })).not.toBeInTheDocument();
  });

  it('TEST-009-07: clicking Save/Learn invokes saveConceptToLibrary for exact concept ID', async () => {
    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockSecondConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 1 },
    });
    const saveSpy = vi.spyOn(api, 'saveConceptToLibrary').mockResolvedValue({
      data: { id: mockSecondConceptSummary.id, itemType: 'concept', isSaved: true, savedAt: '2026-09-05T12:00:00Z' },
      meta: { requestId: 'req-save' },
    });

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'available' } });

    const saveBtn = await screen.findByRole('button', { name: `Lưu từ ${mockSecondConceptSummary.canonicalForm} để học` });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(mockSecondConceptSummary.id);
    });
  });

  it('TEST-009-08: no save occurs automatically on mount, search, or view', async () => {
    const saveSpy = vi.spyOn(api, 'saveConceptToLibrary');
    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockConceptSummary, mockSecondConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 2 },
    });

    await renderDictionary();

    // 1. Mount check
    expect(saveSpy).not.toHaveBeenCalled();

    // 2. Search check
    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'app' } });
    await screen.findByRole('heading', { level: 2, name: 'appointment' });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('TEST-009-09: pending state disables button and prevents duplicate save requests', async () => {
    let resolveSave: (val: LibraryMutationResponseDto) => void;
    const savePromise = new Promise<LibraryMutationResponseDto>((resolve) => {
      resolveSave = resolve;
    });

    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockSecondConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 1 },
    });
    const saveSpy = vi.spyOn(api, 'saveConceptToLibrary').mockImplementation(async () => savePromise);

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'available' } });

    const saveBtn = await screen.findByRole('button', { name: `Lưu từ ${mockSecondConceptSummary.canonicalForm} để học` });
    fireEvent.click(saveBtn);

    // In-flight state: button disabled and labeled "Đang lưu..."
    expect(await screen.findByRole('button', { name: `Đang lưu từ ${mockSecondConceptSummary.canonicalForm}` })).toBeDisabled();

    // Secondary click attempt should be blocked
    fireEvent.click(saveBtn);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Complete the save
    await act(async () => {
      resolveSave({
        data: { id: mockSecondConceptSummary.id, itemType: 'concept', isSaved: true, savedAt: '2026-09-05T12:00:00Z' },
        meta: { requestId: 'req-save' },
      });
    });

    expect(await screen.findByText('Đã lưu vào kho học')).toBeInTheDocument();
  });

  it('TEST-009-10: successful save updates UI to saved state', async () => {
    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockSecondConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 1 },
    });
    vi.spyOn(api, 'saveConceptToLibrary').mockResolvedValue({
      data: { id: mockSecondConceptSummary.id, itemType: 'concept', isSaved: true, savedAt: '2026-09-05T12:00:00Z' },
      meta: { requestId: 'req-save' },
    });

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'available' } });

    const saveBtn = await screen.findByRole('button', { name: `Lưu từ ${mockSecondConceptSummary.canonicalForm} để học` });
    fireEvent.click(saveBtn);

    expect(await screen.findByText('Đã lưu vào kho học')).toBeInTheDocument();
  });

  it('TEST-009-11: save failure does not mark concept as saved and exposes actionable error', async () => {
    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockSecondConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 1 },
    });
    vi.spyOn(api, 'saveConceptToLibrary').mockRejectedValue(new Error('Máy chủ gặp sự cố khi lưu'));

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'available' } });

    const saveBtn = await screen.findByRole('button', { name: `Lưu từ ${mockSecondConceptSummary.canonicalForm} để học` });
    fireEvent.click(saveBtn);

    expect(await screen.findByText('Máy chủ gặp sự cố khi lưu')).toBeInTheDocument();
    // Concept must NOT be marked saved
    expect(screen.queryByLabelText(`Đã lưu từ ${mockSecondConceptSummary.canonicalForm} vào kho học`)).not.toBeInTheDocument();
    // Button reverts back to enabled "Lưu để học"
    expect(screen.getByRole('button', { name: `Lưu từ ${mockSecondConceptSummary.canonicalForm} để học` })).toBeEnabled();
  });

  it('TEST-009-12: stale Actor A save result cannot mutate Actor B UI', async () => {
    let resolveSaveA: (val: LibraryMutationResponseDto) => void;
    const savePromiseA = new Promise<LibraryMutationResponseDto>((resolve) => {
      resolveSaveA = resolve;
    });

    vi.spyOn(api, 'searchDictionary').mockResolvedValue({
      data: [mockSecondConceptSummary],
      meta: { requestId: 'req-1', hasMore: false, pageSize: 1 },
    });
    vi.spyOn(api, 'saveConceptToLibrary').mockImplementation(async () => savePromiseA);

    await renderDictionary();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
    fireEvent.change(searchInput, { target: { value: 'available' } });

    const saveBtn = await screen.findByRole('button', { name: `Lưu từ ${mockSecondConceptSummary.canonicalForm} để học` });
    fireEvent.click(saveBtn);

    // Switch actor before save resolves
    await act(async () => {
      mockSupabase.switchUser(sessionB);
    });

    // Save resolves late
    await act(async () => {
      resolveSaveA({
        data: { id: mockSecondConceptSummary.id, itemType: 'concept', isSaved: true, savedAt: '2026-09-05T12:00:00Z' },
        meta: { requestId: 'req-save-a' },
      });
    });

    // Actor B must not have concept marked as saved from Actor A's request
    expect(screen.queryByLabelText(`Đã lưu từ ${mockSecondConceptSummary.canonicalForm} vào kho học`)).not.toBeInTheDocument();
  });

  it('TEST-009-13: re-entry / initial load reconciles with library saved concepts', async () => {
    // Return mockConceptSummary as already saved in library
    vi.spyOn(api, 'listLibraryItems').mockResolvedValue({
      data: [
        { itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: mockConceptSummary },
      ],
      meta: { requestId: 'req-lib', hasMore: false, pageSize: 1 },
    });

    await renderDictionary();

    // Concept "appointment" was in default initial concepts and saved in library
    expect(await screen.findByLabelText(`Đã lưu từ ${mockConceptSummary.canonicalForm} vào kho học`)).toBeInTheDocument();
  });

  describe('PAGINATION-009: Paginated Saved-State Authority', () => {
    it('TEST-009-PAGE-01: multi-page traversal discovers concepts on later pages without PUT', async () => {
      const conceptA: ConceptSummaryDto = {
        id: '00000000-0000-4000-8000-000000000091',
        term: 'apple',
        canonicalForm: 'apple',
        partOfSpeech: 'noun',
        ipa: '/ˈæp.əl/',
        cefrLevel: 'A1',
        status: 'learning',
        isDue: false,
      };
      const conceptTarget: ConceptSummaryDto = {
        id: '00000000-0000-4000-8000-000000000092',
        term: 'target-concept',
        canonicalForm: 'target-concept',
        partOfSpeech: 'noun',
        ipa: '/ˈtɑː.ɡɪt/',
        cefrLevel: 'B1',
        status: 'learning',
        isDue: false,
      };

      const listSpy = vi.spyOn(api, 'listLibraryItems').mockImplementation(async (query) => {
        if (!query?.cursor) {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: conceptA }],
            meta: { requestId: 'req-p1', apiVersion: '1.0', nextCursor: 'C1', hasMore: true, pageSize: 1 },
          };
        }
        if (query.cursor === 'C1') {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: conceptTarget }],
            meta: { requestId: 'req-p2', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
          };
        }
        throw new Error(`Unexpected cursor: ${query.cursor}`);
      });

      const saveSpy = vi.spyOn(api, 'saveConceptToLibrary');
      vi.spyOn(api, 'searchDictionary').mockResolvedValue({
        data: [conceptTarget],
        meta: { requestId: 'req-s', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
      });

      await renderDictionary();

      // Ensure both pages were fetched
      expect(listSpy).toHaveBeenCalledTimes(2);

      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'target-concept' } });

      // ConceptTarget renders as already saved
      expect(await screen.findByLabelText(`Đã lưu từ ${conceptTarget.canonicalForm} vào kho học`)).toBeInTheDocument();
      // No PUT was required
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('TEST-009-PAGE-02: second request passes exact opaque cursor and itemType=concept', async () => {
      const opaqueCursor = 'opaque-cursor-xyz-789==';
      const listSpy = vi.spyOn(api, 'listLibraryItems').mockImplementation(async (query) => {
        if (!query?.cursor) {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: mockConceptSummary }],
            meta: { requestId: 'req-1', apiVersion: '1.0', nextCursor: opaqueCursor, hasMore: true, pageSize: 1 },
          };
        }
        return {
          data: [],
          meta: { requestId: 'req-2', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 0 },
        };
      });

      await renderDictionary();

      expect(listSpy).toHaveBeenCalledTimes(2);
      expect(listSpy).toHaveBeenNthCalledWith(1, { itemType: 'concept' });
      expect(listSpy).toHaveBeenNthCalledWith(2, { itemType: 'concept', cursor: opaqueCursor });
    });

    it('TEST-009-PAGE-03: three-page traversal merges all saved IDs without overwriting', async () => {
      const c1: ConceptSummaryDto = { ...mockConceptSummary, id: '00000000-0000-4000-8000-000000000001', canonicalForm: 'term-one' };
      const c2: ConceptSummaryDto = { ...mockConceptSummary, id: '00000000-0000-4000-8000-000000000002', canonicalForm: 'term-two' };
      const c3: ConceptSummaryDto = { ...mockConceptSummary, id: '00000000-0000-4000-8000-000000000003', canonicalForm: 'term-three' };

      vi.spyOn(api, 'listLibraryItems').mockImplementation(async (query) => {
        if (!query?.cursor) {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: c1 }],
            meta: { requestId: 'req-1', apiVersion: '1.0', nextCursor: 'C1', hasMore: true, pageSize: 1 },
          };
        }
        if (query.cursor === 'C1') {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: c2 }],
            meta: { requestId: 'req-2', apiVersion: '1.0', nextCursor: 'C2', hasMore: true, pageSize: 1 },
          };
        }
        if (query.cursor === 'C2') {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: c3 }],
            meta: { requestId: 'req-3', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
          };
        }
        throw new Error(`Unexpected cursor: ${query.cursor}`);
      });

      vi.spyOn(api, 'searchDictionary').mockResolvedValue({
        data: [c1, c2, c3],
        meta: { requestId: 'req-all', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 3 },
      });

      await renderDictionary();

      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'term' } });

      // All 3 concepts are rendered as saved, proving all 3 pages merged into authoritative state
      expect(await screen.findByLabelText(`Đã lưu từ ${c1.canonicalForm} vào kho học`)).toBeInTheDocument();
      expect(await screen.findByLabelText(`Đã lưu từ ${c2.canonicalForm} vào kho học`)).toBeInTheDocument();
      expect(await screen.findByLabelText(`Đã lưu từ ${c3.canonicalForm} vào kho học`)).toBeInTheDocument();
    });

    it('TEST-009-PAGE-04: stale Actor A page resolution cannot mutate Actor B saved state', async () => {
      const cA1: ConceptSummaryDto = { ...mockConceptSummary, id: 'actor-a-concept-1', canonicalForm: 'a1-term' };
      const cA2: ConceptSummaryDto = { ...mockConceptSummary, id: 'actor-a-concept-2', canonicalForm: 'a2-term' };
      const cB1: ConceptSummaryDto = { ...mockConceptSummary, id: 'actor-b-concept-1', canonicalForm: 'b1-term' };

      let resolvePageA2: (val: LibraryItemsResponseDto) => void;
      const pageA2Promise = new Promise<LibraryItemsResponseDto>((resolve) => {
        resolvePageA2 = resolve;
      });

      let pageCount = 0;
      vi.spyOn(api, 'listLibraryItems').mockImplementation(async (query) => {
        pageCount++;
        // First call: Actor A page 1
        if (pageCount === 1) {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: cA1 }],
            meta: { requestId: 'req-a1', apiVersion: '1.0', nextCursor: 'cursor-a1', hasMore: true, pageSize: 1 },
          };
        }
        // Second call: Actor A page 2 (delayed)
        if (pageCount === 2) {
          return pageA2Promise;
        }
        // Third call: Actor B page 1
        return {
          data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: cB1 }],
          meta: { requestId: 'req-b1', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
        };
      });

      vi.spyOn(api, 'searchDictionary').mockResolvedValue({
        data: [cA1, cA2, cB1],
        meta: { requestId: 'req-s', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 3 },
      });

      await renderDictionary();

      // Actor A has page 2 pending. Now switch to Actor B
      await act(async () => {
        mockSupabase.switchUser(sessionB);
      });

      // Now Actor A's page 2 resolves with concept cA2
      await act(async () => {
        resolvePageA2({
          data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: cA2 }],
          meta: { requestId: 'req-a2', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
        });
      });

      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'term' } });

      // Actor B sees cB1 as saved
      expect(await screen.findByLabelText(`Đã lưu từ ${cB1.canonicalForm} vào kho học`)).toBeInTheDocument();
      // Actor B must NOT have cA1 or cA2 saved!
      expect(screen.queryByLabelText(`Đã lưu từ ${cA1.canonicalForm} vào kho học`)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(`Đã lưu từ ${cA2.canonicalForm} vào kho học`)).not.toBeInTheDocument();
    });

    it('TEST-009-PAGE-05: repeated server next cursor anomaly terminates, fails closed, and does not treat absent concepts as unsaved', async () => {
      let callCount = 0;
      const conceptA: ConceptSummaryDto = {
        ...mockConceptSummary,
        id: '00000000-0000-4000-8000-000000000001',
        canonicalForm: 'concept-a',
      };
      const conceptTarget: ConceptSummaryDto = {
        ...mockSecondConceptSummary,
        id: '00000000-0000-4000-8000-000000000002',
        canonicalForm: 'concept-target',
      };

      vi.spyOn(api, 'listLibraryItems').mockImplementation(async () => {
        callCount++;
        // Page 1: returns conceptA with nextCursor C1
        // Page 2: repeats nextCursor C1
        return {
          data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: conceptA }],
          meta: { requestId: `req-${callCount}`, apiVersion: '1.0', nextCursor: 'C1', hasMore: true, pageSize: 1 },
        };
      });

      vi.spyOn(api, 'searchDictionary').mockResolvedValue({
        data: [conceptA, conceptTarget],
        meta: { requestId: 'req-search', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 2 },
      });

      await renderDictionary();

      // Loop was caught on second call when 'C1' was repeated
      expect(callCount).toBe(2);
      // Fails closed with standard InlineAlert
      expect(await screen.findByText('Lỗi đồng bộ kho từ vựng')).toBeInTheDocument();
      expect(screen.getByText(/Pagination loop detected/i)).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'concept' } });

      // 1. Saved A was positively confirmed on page 1 before loop failure: remains positively known as saved
      expect(await screen.findByLabelText(`Đã lưu từ ${conceptA.canonicalForm} vào kho học`)).toBeInTheDocument();

      // 2. TARGET was absent from incomplete traversal: MUST NOT be treated as definitively unsaved!
      // Active "Lưu để học" must NOT appear for TARGET
      expect(screen.queryByRole('button', { name: `Lưu từ ${conceptTarget.canonicalForm} để học` })).not.toBeInTheDocument();

      // 3. TARGET displays safe non-authoritative retry CTA instead of false unsaved button
      expect(await screen.findByRole('button', { name: `Thử đồng bộ lại trạng thái lưu của từ ${conceptTarget.canonicalForm}` })).toBeInTheDocument();
    });

    it('TEST-009-PAGE-06: concept not present after full cursor exhaustion is treated as unsaved', async () => {
      let resolvePage2: (val: LibraryItemsResponseDto) => void;
      const page2Promise = new Promise<LibraryItemsResponseDto>((resolve) => {
        resolvePage2 = resolve;
      });

      const cUnsaved: ConceptSummaryDto = {
        id: 'unsaved-concept-99',
        term: 'ephemeral',
        canonicalForm: 'ephemeral',
        partOfSpeech: 'adjective',
        ipa: '/ɪˈfem.ər.əl/',
        cefrLevel: 'C1',
        status: 'unseen',
        isDue: false,
      };

      vi.spyOn(api, 'listLibraryItems').mockImplementation(async (query) => {
        if (!query?.cursor) {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: mockConceptSummary }],
            meta: { requestId: 'req-1', apiVersion: '1.0', nextCursor: 'cursor-2', hasMore: true, pageSize: 1 },
          };
        }
        return page2Promise;
      });

      vi.spyOn(api, 'searchDictionary').mockResolvedValue({
        data: [cUnsaved],
        meta: { requestId: 'req-s', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
      });

      // Render dictionary while page 2 is in-flight
      render(
        <AuthProvider customClient={mockSupabase}>
          <DictionaryView apiClient={api} />
        </AuthProvider>
      );
      // Settle initial user bootstrap so reconciliation starts and fetches page 1
      await act(async () => {});

      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'ephemeral' } });

      // Before full cursor exhaustion: NOT treated as unsaved yet!
      // Must NOT display active "Lưu để học" button
      expect(screen.queryByRole('button', { name: `Lưu từ ${cUnsaved.canonicalForm} để học` })).not.toBeInTheDocument();
      // Displays checking indicator
      expect(await screen.findByRole('button', { name: `Đang kiểm tra trạng thái lưu của từ ${cUnsaved.canonicalForm}` })).toBeDisabled();

      // Now resolve page 2 with empty items and no further cursor (full exhaustion)
      await act(async () => {
        resolvePage2({
          data: [],
          meta: { requestId: 'req-2', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 0 },
        });
      });

      // Only NOW after full cursor exhaustion is the concept authoritatively treated as unsaved
      expect(await screen.findByRole('button', { name: `Lưu từ ${cUnsaved.canonicalForm} để học` })).toBeInTheDocument();
    });

    it('TEST-009-PAGE-07: clean retry after reconciliation failure reaches cursor exhaustion and discovers TARGET without PUT', async () => {
      const conceptA: ConceptSummaryDto = {
        ...mockConceptSummary,
        id: '00000000-0000-4000-8000-000000000001',
        canonicalForm: 'concept-a',
      };
      const conceptTarget: ConceptSummaryDto = {
        ...mockSecondConceptSummary,
        id: '00000000-0000-4000-8000-000000000002',
        canonicalForm: 'concept-target',
      };

      let attempt = 1;
      let firstRunCalls = 0;
      const listSpy = vi.spyOn(api, 'listLibraryItems').mockImplementation(async (query) => {
        if (attempt === 1) {
          firstRunCalls++;
          // First reconciliation: repeated cursor loop error
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: conceptA }],
            meta: { requestId: `req-1-${firstRunCalls}`, apiVersion: '1.0', nextCursor: 'C1', hasMore: true, pageSize: 1 },
          };
        }
        // Second reconciliation: clean multi-page traversal
        if (!query?.cursor) {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: conceptA }],
            meta: { requestId: 'req-2-1', apiVersion: '1.0', nextCursor: 'C2', hasMore: true, pageSize: 1 },
          };
        }
        if (query.cursor === 'C2') {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: conceptTarget }],
            meta: { requestId: 'req-2-2', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
          };
        }
        throw new Error(`Unexpected cursor: ${query.cursor}`);
      });

      const saveSpy = vi.spyOn(api, 'saveConceptToLibrary');
      vi.spyOn(api, 'searchDictionary').mockResolvedValue({
        data: [conceptTarget],
        meta: { requestId: 'req-search', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
      });

      await renderDictionary();

      // First run failed with loop error
      expect(firstRunCalls).toBe(2);
      expect(await screen.findByText('Lỗi đồng bộ kho từ vựng')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'target' } });

      // Before retry: TARGET shows retry action, NOT authoritative unsaved
      expect(screen.queryByRole('button', { name: `Lưu từ ${conceptTarget.canonicalForm} để học` })).not.toBeInTheDocument();
      const retryCardBtn = await screen.findByRole('button', { name: `Thử đồng bộ lại trạng thái lưu của từ ${conceptTarget.canonicalForm}` });

      // Learner retries
      attempt = 2;
      fireEvent.click(retryCardBtn);

      // Second reconciliation succeeds with full cursor exhaustion:
      // TARGET becomes "Đã lưu vào kho học"
      expect(await screen.findByLabelText(`Đã lưu từ ${conceptTarget.canonicalForm} vào kho học`)).toBeInTheDocument();
      expect(screen.queryByText('Lỗi đồng bộ kho từ vựng')).not.toBeInTheDocument();

      // No PUT Save/Learn is issued
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('TEST-009-PAGE-08: Actor A reconciliation failure cannot contaminate Actor B state', async () => {
      const cA1: ConceptSummaryDto = { ...mockConceptSummary, id: 'actor-a-concept-1', canonicalForm: 'a1-term' };
      const cB1: ConceptSummaryDto = { ...mockConceptSummary, id: 'actor-b-concept-1', canonicalForm: 'b1-term' };
      const cUnsaved: ConceptSummaryDto = { ...mockSecondConceptSummary, id: 'b-unsaved-1', canonicalForm: 'b2-term-unsaved' };

      let rejectPageA2: (err: Error) => void;
      const pageA2Promise = new Promise<LibraryItemsResponseDto>((_, reject) => {
        rejectPageA2 = reject;
      });

      let pageCount = 0;
      vi.spyOn(api, 'listLibraryItems').mockImplementation(async () => {
        pageCount++;
        // First call: Actor A page 1
        if (pageCount === 1) {
          return {
            data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: cA1 }],
            meta: { requestId: 'req-a1', apiVersion: '1.0', nextCursor: 'cursor-a1', hasMore: true, pageSize: 1 },
          };
        }
        // Second call: Actor A page 2 (delayed failure)
        if (pageCount === 2) {
          return pageA2Promise;
        }
        // Third call: Actor B page 1 (successful exhaustion)
        return {
          data: [{ itemType: 'concept', savedAt: '2026-08-20T00:00:00Z', concept: cB1 }],
          meta: { requestId: 'req-b1', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 1 },
        };
      });

      vi.spyOn(api, 'searchDictionary').mockResolvedValue({
        data: [cB1, cUnsaved],
        meta: { requestId: 'req-s', apiVersion: '1.0', nextCursor: null, hasMore: false, pageSize: 2 },
      });

      await renderDictionary();

      // Actor A has page 2 pending. Switch to Actor B
      await act(async () => {
        mockSupabase.switchUser(sessionB);
      });

      // Now Actor A's page 2 fails with error
      await act(async () => {
        rejectPageA2(new Error('Pagination loop detected for cursor: cursor-a1'));
      });

      const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh/i);
      fireEvent.change(searchInput, { target: { value: 'term' } });

      // Actor B must NOT receive Actor A's error
      expect(screen.queryByText('Lỗi đồng bộ kho từ vựng')).not.toBeInTheDocument();

      // Actor B sees cB1 as saved
      expect(await screen.findByLabelText(`Đã lưu từ ${cB1.canonicalForm} vào kho học`)).toBeInTheDocument();

      // Actor B reached full cursor exhaustion, so cUnsaved is authoritatively treated as unsaved with active Save CTA
      expect(await screen.findByRole('button', { name: `Lưu từ ${cUnsaved.canonicalForm} để học` })).toBeInTheDocument();
    });
  });
});
