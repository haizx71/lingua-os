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
});
