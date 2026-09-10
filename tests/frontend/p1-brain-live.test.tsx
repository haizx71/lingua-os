import React, { startTransition, Suspense, useLayoutEffect } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthProvider } from '../../apps/web/src/features/auth';
import { BrainPage } from '../../apps/web/src/features/brain/BrainPage';
import { LanguageBrainCanvas } from '../../apps/web/src/features/brain/LanguageBrainCanvas';
import BrainRoute from '../../apps/web/src/app/brain/page';
import { useBrain, type UseBrainResult } from '../../apps/web/src/features/brain/useBrain';
import * as webApi from '../../apps/web/src/lib/api/client';
import {
  HttpApiClient,
  mapBrainConceptToViewModel,
  mockApiResponses,
  type ApiClient,
  type BrainConceptListResponseDto,
  type BrainConceptResponseDto,
  type BrainSummaryResponseDto,
  type CompetenceSignalsDto,
} from '@lingua/types';

const profileA = '00000000-0000-4000-8000-000000000101';
const profileB = '00000000-0000-4000-8000-000000000102';
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
  ...sessionA,
  access_token: 'token-b',
  refresh_token: 'refresh-b',
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
        return { data: { subscription: { unsubscribe: () => undefined } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
    switchUser: (next: Session | null) => {
      currentSession = next;
      listeners.forEach((listener) => listener('USER_UPDATED', next));
    },
  };
  return client as unknown as SupabaseClient & { switchUser: (next: Session | null) => void };
}

function competence(seed: number): CompetenceSignalsDto {
  return {
    recognition: { score: seed, confidence: seed / 2, evidenceCount: 11, updatedAt: '2026-09-09T01:00:00Z' },
    listening: { score: seed / 2, confidence: seed / 3, evidenceCount: 7, updatedAt: '2026-09-09T01:00:00Z' },
    production: { score: seed / 4, confidence: seed / 4, evidenceCount: 3, updatedAt: '2026-09-09T01:00:00Z' },
  };
}

function summaryResponse(languageProfileId: string, mastered: number, memoryHealth: number | null): BrainSummaryResponseDto {
  return {
    data: {
      ...mockApiResponses.brainSummary.data,
      languageProfileId,
      statusCounts: {
        total: 2, unseen: 0, discovered: 0, learning: 1, familiar: 0,
        active: 0, mastered, weak: 1, forgotten: 0,
      },
      dueCount: 1,
      memoryHealth,
      competence: competence(0.8),
      recentConcepts: [],
      calculatedAt: '2026-09-09T01:00:00Z',
    },
    meta: mockApiResponses.brainSummary.meta,
  };
}

function conceptsResponse(items: BrainConceptListResponseDto['data'], nextCursor: string | null = null, hasMore = false): BrainConceptListResponseDto {
  return {
    data: items,
    meta: { ...mockApiResponses.brainConcepts.meta, nextCursor, hasMore, pageSize: items.length },
  };
}

function detailResponse(item = mockApiResponses.brainConcept.data): BrainConceptResponseDto {
  return { data: item, meta: mockApiResponses.brainConcept.meta };
}

function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  const base = new (class {
      transportKind = 'http' as const;
      async getMe() { return mockApiResponses.me; }
      async updateMe() { return mockApiResponses.me; }
      async listMyLanguageProfiles() { return mockApiResponses.languageProfiles; }
      async createMyLanguageProfile() { return mockApiResponses.languageProfile; }
      async updateMyLanguageProfile() { return mockApiResponses.languageProfile; }
      async getTodayPlan() { return mockApiResponses.today; }
      async completeTodayActivity() { return mockApiResponses.todayCompletion; }
      async listReviewQueue() { return mockApiResponses.reviewQueue; }
      async answerReviewItem() { return mockApiResponses.reviewAnswer; }
      async getConcept() { return mockApiResponses.concept; }
      async searchDictionary() { return mockApiResponses.dictionary; }
      async analyzeReaderText() { return mockApiResponses.readerAnalysis; }
      async saveReaderSentence() { return mockApiResponses.libraryMutation; }
      async listRecommendedContent() { return mockApiResponses.recommendations; }
      async getContent() { return mockApiResponses.content; }
      async listLibraryItems() { return mockApiResponses.library; }
      async saveConceptToLibrary() { return mockApiResponses.libraryMutation; }
      async removeConceptFromLibrary() { return mockApiResponses.libraryMutation; }
      async saveContentToLibrary() { return mockApiResponses.libraryMutation; }
      async removeContentFromLibrary() { return mockApiResponses.libraryMutation; }
      async saveSentenceToLibrary() { return mockApiResponses.libraryMutation; }
      async removeSentenceFromLibrary() { return mockApiResponses.libraryMutation; }
      async startStartingLevelAssessment() { return mockApiResponses.assessment; }
      async getStartingLevelAssessment() { return mockApiResponses.assessment; }
      async submitStartingLevelResponse() { return mockApiResponses.assessment; }
      async getBrainSummary() { return summaryResponse(profileA, 1, null); }
      async listBrainConcepts() { return conceptsResponse(mockApiResponses.brainConcepts.data); }
      async getBrainConcept() { return mockApiResponses.brainConcept; }
      async getProgressOverview() { return mockApiResponses.progress; }
    })();
  return Object.assign(base, overrides) as ApiClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Observe committed render output before passive effects can clear stale state.
function BrainProbe({ api, profile = profileA, enabled = true, observe }: {
  api: ApiClient; profile?: string; enabled?: boolean; observe?: (value: UseBrainResult) => void;
}) {
  const brain = useBrain(api, profile, enabled);
  useLayoutEffect(() => { observe?.(brain); });
  return <>
    <output data-testid="brain-state">{brain.status}:{brain.summary?.statusCounts.mastered}</output>
    <output data-testid="brain-detail">{brain.detailLoading ? 'pending' : 'settled'}:{brain.selectedDetail?.label}:{brain.detailError?.code}</output>
    <button onClick={brain.retry}>Reload Brain</button>
    {brain.nodes.map((node) => <button key={node.id} onClick={() => brain.selectConcept(node)}>Select {node.label}</button>)}
  </>;
}

function SuspenseBrain({ api, hidden, gate, profile = profileA }: {
  api: ApiClient; hidden: boolean; gate: ReturnType<typeof deferred<void>>; profile?: string;
}) {
  const brain = useBrain(api, profile);
  if (hidden) throw gate.promise;
  return <output data-testid="suspense-brain-state">{brain.status}:{brain.summary?.statusCounts.mastered}</output>;
}

describe('P1 live Brain route and presentation boundary', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('maps server scores, confidence, evidence counts, statuses, and nullable values without projection', () => {
    const item = {
      ...mockApiResponses.brainConcepts.data[0],
      concept: { ...mockApiResponses.brainConcepts.data[0].concept, status: 'forgotten' as const },
      mastery: null,
      confidence: 0.17,
      competence: competence(0.8),
      exposureCount: 19,
    };
    const view = mapBrainConceptToViewModel(item, 'served translation');

    expect(view.status).toBe('forgotten');
    expect(view.mastery).toBeNull();
    expect(view.confidence).toBe(0.17);
    expect(view.exposureCount).toBe(19);
    expect(view.recognitionScore).toBe(80);
    expect(view.recognitionConfidence).toBe(40);
    expect(view.recognitionEvidenceCount).toBe(11);
    expect(view.translationVi).toBe('served translation');
  });

  it('loads summary and cursor-paginated concepts from the supplied client without fixture fallback', async () => {
    const first = mockApiResponses.brainConcepts.data[0];
    const second = { ...mockApiResponses.brainConcepts.data[1], concept: { ...mockApiResponses.brainConcepts.data[1].concept, canonicalForm: 'server-only' } };
    const getBrainSummary = vi.fn().mockResolvedValue(summaryResponse(profileA, 1, null));
    const listBrainConcepts = vi.fn()
      .mockResolvedValueOnce(conceptsResponse([first], 'cursor-1', true))
      .mockResolvedValueOnce(conceptsResponse([second]));
    const getBrainConcept = vi.fn().mockResolvedValue(detailResponse());
    const api = makeApi({ getBrainSummary, listBrainConcepts, getBrainConcept });

    render(<BrainPage apiClient={api} languageProfileId={profileA} />);

    expect(await screen.findByText('server-only')).toBeInTheDocument();
    const masteredCard = screen.getByText('Đã vững (Mastered)').closest('div');
    expect(masteredCard).not.toBeNull();
    expect(within(masteredCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('server-only')).toBeInTheDocument();
    expect(screen.queryByText('483')).not.toBeInTheDocument();
    expect(getBrainSummary).toHaveBeenCalledWith({ languageProfileId: profileA });
    expect(listBrainConcepts).toHaveBeenNthCalledWith(1, { languageProfileId: profileA });
    expect(listBrainConcepts).toHaveBeenNthCalledWith(2, { languageProfileId: profileA, cursor: 'cursor-1' });
    expect(getBrainConcept).not.toHaveBeenCalled();
  });

  it('keeps previous learner values out of loading and clears them on profile changes', async () => {
    let resolveSummary: ((value: BrainSummaryResponseDto) => void) | undefined;
    const getBrainSummary = vi.fn()
      .mockResolvedValueOnce(summaryResponse(profileA, 7, null))
      .mockImplementationOnce(() => new Promise<BrainSummaryResponseDto>((resolve) => { resolveSummary = resolve; }));
    const api = makeApi({ getBrainSummary });
    const view = render(<BrainPage apiClient={api} languageProfileId={profileA} />);
    expect(await view.findByText('7')).toBeInTheDocument();

    view.rerender(<BrainPage apiClient={api} languageProfileId={profileB} />);
    expect(screen.getByText('Đang tải dữ liệu mạng lưới Language Brain...')).toBeInTheDocument();
    expect(screen.queryByText('7')).not.toBeInTheDocument();

    await act(async () => resolveSummary?.(summaryResponse(profileB, 3, null)));
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('renders a genuine empty collection and preserves unavailable memory health', async () => {
    const api = makeApi({
      getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileA, 0, null)),
      listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([])),
    });
    render(<BrainPage apiClient={api} languageProfileId={profileA} />);

    expect(await screen.findByText('Chưa có từ vựng trong Brain')).toBeInTheDocument();
    expect(screen.getByText(/Chưa có dữ liệu sức khỏe trí nhớ/i)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('483')).not.toBeInTheDocument();
  });

  it('renders a localized retry state and never displays a raw server error or fixture values', async () => {
    const api = makeApi({
      getBrainSummary: vi.fn().mockRejectedValue(new Error('private database details')),
      listBrainConcepts: vi.fn(),
    });
    render(<BrainPage apiClient={api} languageProfileId={profileA} />);

    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
    expect(screen.queryByText('private database details')).not.toBeInTheDocument();
    expect(screen.queryByText('483')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));
    expect(api.getBrainSummary).toHaveBeenCalledTimes(2);
  });

  it('loads selected concept detail lazily and renders nullable mastery as unavailable', async () => {
    const concept = { ...mockApiResponses.brainConcepts.data[0], mastery: null, confidence: 0.24 };
    const getBrainConcept = vi.fn().mockResolvedValue(detailResponse({
      ...mockApiResponses.brainConcept.data,
      concept: { ...mockApiResponses.brainConcept.data.concept, canonicalForm: 'selected-server-concept' },
      mastery: null,
      confidence: 0.24,
    }));
    const api = makeApi({
      getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileA, 1, null)),
      listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([concept])),
      getBrainConcept,
    });
    render(<BrainPage apiClient={api} languageProfileId={profileA} />);
    const node = await screen.findByRole('button', { name: /appointment/i });
    expect(getBrainConcept).not.toHaveBeenCalled();
    fireEvent.click(node);
    expect(await screen.findByRole('dialog', { name: 'Chi tiết khái niệm' })).toHaveTextContent('Chưa có dữ liệu');
    expect(getBrainConcept).toHaveBeenCalledWith(concept.concept.id);
    expect(getBrainConcept.mock.calls[0]).toHaveLength(1);
  });

  it('rejects a malformed required Brain DTO instead of fabricating a node', async () => {
    const malformed = { data: [{ concept: { id: '', canonicalForm: 'bad', status: 'learning', isDue: false } }], meta: mockApiResponses.brainConcepts.meta };
    const api = makeApi({
      getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileA, 1, null)),
      listBrainConcepts: vi.fn().mockResolvedValue(malformed as unknown as BrainConceptListResponseDto),
    });
    render(<BrainPage apiClient={api} languageProfileId={profileA} />);
    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
    expect(screen.queryByText('bad')).not.toBeInTheDocument();
  });

  it('drops stale actor responses while accepting the current actor response', async () => {
    let resolveA: ((value: BrainSummaryResponseDto) => void) | undefined;
    const getBrainSummary = vi.fn()
      .mockImplementationOnce(() => new Promise<BrainSummaryResponseDto>((resolve) => { resolveA = resolve; }))
      .mockResolvedValueOnce(summaryResponse(profileB, 9, null));
    const api = makeApi({
      getBrainSummary,
      listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse(mockApiResponses.brainConcepts.data)),
    });
    const supabase = createMockSupabase(sessionA);
    const view = render(
      <AuthProvider customClient={supabase}>
        <BrainPage apiClient={api} languageProfileId={profileA} />
      </AuthProvider>
    );
    await act(async () => {});
    supabase.switchUser(sessionB);
    view.rerender(
      <AuthProvider customClient={supabase}>
        <BrainPage apiClient={api} languageProfileId={profileB} />
      </AuthProvider>
    );
    await waitFor(() => expect(getBrainSummary).toHaveBeenCalledTimes(2));
    await act(async () => resolveA?.(summaryResponse(profileA, 99, null)));
    expect(await screen.findByText('9')).toBeInTheDocument();
    expect(screen.queryByText('99')).not.toBeInTheDocument();
  });

  it('rejects a summary for a different requested profile before loading concepts', async () => {
    const api = makeApi({
      getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileB, 9, null)),
      listBrainConcepts: vi.fn(),
    });
    render(<BrainPage apiClient={api} languageProfileId={profileA} />);

    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
    expect(api.listBrainConcepts).not.toHaveBeenCalled();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });

  it('fails closed when cursor pagination repeats a cursor', async () => {
    const first = mockApiResponses.brainConcepts.data[0];
    const second = { ...mockApiResponses.brainConcepts.data[1], concept: { ...mockApiResponses.brainConcepts.data[1].concept, canonicalForm: 'cycle-server-concept' } };
    const api = makeApi({
      getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileA, 1, null)),
      listBrainConcepts: vi.fn()
        .mockResolvedValueOnce(conceptsResponse([first], 'cycle-cursor', true))
        .mockResolvedValueOnce(conceptsResponse([second], 'cycle-cursor', true)),
    });
    render(<BrainPage apiClient={api} languageProfileId={profileA} />);

    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
    expect(screen.queryByText('cycle-server-concept')).not.toBeInTheDocument();
  });

  it('presentation fixtures remain opt-in for the frozen F08 canvas checks', () => {
    const fixture = mapBrainConceptToViewModel(mockApiResponses.brainConcepts.data[0], 'fixture translation');
    render(<LanguageBrainCanvas initialNodes={[fixture]} forcedState="success" />);
    expect(screen.getByRole('button', { name: /appointment/i })).toBeInTheDocument();
  });

  it('hides old data on the first committed render when the API client changes', async () => {
    const oldApi = makeApi({ getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileA, 77, null)) });
    const pending = deferred<BrainSummaryResponseDto>();
    const nextApi = makeApi({ getBrainSummary: vi.fn().mockReturnValue(pending.promise) });
    const observe = vi.fn();
    const view = render(<BrainProbe api={oldApi} observe={observe} />);
    await screen.findByText('success:77');
    observe.mockClear();
    view.rerender(<BrainProbe api={nextApi} observe={observe} />);
    expect(observe.mock.calls[0][0].summary).toBeNull();
    expect(observe.mock.calls[0][0].nodes).toEqual([]);
    expect(screen.getByTestId('brain-state')).toHaveTextContent('loading:');
  });

  it('hides data on the first render when the live boundary is disabled', async () => {
    const api = makeApi({ getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileA, 77, null)) });
    const observe = vi.fn();
    const view = render(<BrainProbe api={api} observe={observe} />);
    await screen.findByText('success:77');
    observe.mockClear();
    view.rerender(<BrainProbe api={api} enabled={false} observe={observe} />);
    expect(observe.mock.calls[0][0].summary).toBeNull();
    expect(observe.mock.calls[0][0].status).toBe('error');
  });

  it('hides profile data before transition effects run', async () => {
    const pending = deferred<BrainSummaryResponseDto>();
    const api = makeApi({ getBrainSummary: vi.fn()
      .mockResolvedValueOnce(summaryResponse(profileA, 77, null)).mockReturnValueOnce(pending.promise) });
    const observe = vi.fn();
    const view = render(<BrainProbe api={api} observe={observe} />);
    await screen.findByText('success:77');
    observe.mockClear();
    view.rerender(<BrainProbe api={api} profile={profileB} observe={observe} />);
    expect(observe.mock.calls[0][0].summary).toBeNull();
    expect(observe.mock.calls[0][0].selectedDetail).toBeNull();
  });

  it.each(['success', 'error'] as const)('ignores an old list %s after same-actor reload completes', async (outcome) => {
    const oldList = deferred<BrainConceptListResponseDto>();
    const api = makeApi({
      getBrainSummary: vi.fn().mockResolvedValueOnce(summaryResponse(profileA, 77, null))
        .mockResolvedValueOnce(summaryResponse(profileA, 88, null)),
      listBrainConcepts: vi.fn().mockReturnValueOnce(oldList.promise)
        .mockResolvedValueOnce(conceptsResponse(mockApiResponses.brainConcepts.data)),
    });
    render(<BrainProbe api={api} />);
    await waitFor(() => expect(api.listBrainConcepts).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Reload Brain'));
    await screen.findByText('success:88');
    await act(async () => {
      if (outcome === 'error') oldList.reject(new Error('old private error'));
      else oldList.resolve(conceptsResponse([]));
    });
    expect(screen.getByTestId('brain-state')).toHaveTextContent('success:88');
    expect(screen.queryByText('old private error')).not.toBeInTheDocument();
  });

  it.each(['success', 'error'] as const)('ignores superseded detail %s and its finally while the new detail is pending', async (outcome) => {
    const oldDetail = deferred<BrainConceptResponseDto>();
    const nextDetail = deferred<BrainConceptResponseDto>();
    const first = mockApiResponses.brainConcepts.data[0];
    const second = mockApiResponses.brainConcepts.data[1];
    const api = makeApi({ getBrainConcept: vi.fn().mockReturnValueOnce(oldDetail.promise).mockReturnValueOnce(nextDetail.promise) });
    render(<BrainProbe api={api} />);
    fireEvent.click(await screen.findByText(`Select ${first.concept.canonicalForm}`));
    fireEvent.click(screen.getByText(`Select ${second.concept.canonicalForm}`));
    await act(async () => {
      if (outcome === 'error') oldDetail.reject(new Error('old detail error'));
      else oldDetail.resolve(detailResponse());
    });
    expect(screen.getByTestId('brain-detail')).toHaveTextContent('pending::');
    await act(async () => nextDetail.resolve(detailResponse({ ...mockApiResponses.brainConcept.data,
      concept: { ...mockApiResponses.brainConcept.data.concept, id: second.concept.id, canonicalForm: 'current detail' } })));
    expect(screen.getByTestId('brain-detail')).toHaveTextContent('settled:current detail:');
  });

  it('does not even inspect a late detail payload after unmount', async () => {
    const pending = deferred<BrainConceptResponseDto>();
    const api = makeApi({ getBrainConcept: vi.fn().mockReturnValue(pending.promise) });
    const view = render(<BrainProbe api={api} />);
    fireEvent.click(await screen.findByText(`Select ${mockApiResponses.brainConcepts.data[0].concept.canonicalForm}`));
    view.unmount();
    const readData = vi.fn(() => mockApiResponses.brainConcept.data);
    await act(async () => pending.resolve({ get data() { return readData(); }, meta: mockApiResponses.brainConcept.meta }));
    expect(readData).not.toHaveBeenCalled();
  });

  it('preserves in-flight Brain reads across same-actor token refresh', async () => {
    const pending = deferred<BrainSummaryResponseDto>();
    const api = makeApi({ getBrainSummary: vi.fn().mockReturnValue(pending.promise) });
    const auth = createMockSupabase(sessionA);
    render(<AuthProvider customClient={auth}><BrainProbe api={api} /></AuthProvider>);
    await waitFor(() => expect(api.getBrainSummary).toHaveBeenCalledTimes(1));
    await act(async () => auth.switchUser({ ...sessionA, access_token: 'refreshed-token' }));
    await act(async () => pending.resolve(summaryResponse(profileA, 88, null)));
    expect(screen.getByTestId('brain-state')).toHaveTextContent('success:88');
    expect(api.getBrainSummary).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['POS object', { partOfSpeech: { bad: true } }],
    ['IPA number', { ipa: 7 }],
    ['level missing code', { level: { frameworkCode: 'CEFR', label: 'invalid' } }],
  ])('rejects malformed consumed presentation data: %s', async (_label, fields) => {
    const item = mockApiResponses.brainConcepts.data[0];
    const api = makeApi({ listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([
      { ...item, concept: { ...item.concept, ...fields } } as typeof item,
    ])) });
    render(<BrainPage apiClient={api} />);
    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
  });

  it('accepts empty optional IPA and absent POS/level without inventing labels', async () => {
    const item = mockApiResponses.brainConcepts.data[0];
    const concept = { ...item.concept, partOfSpeech: null, level: null, ipa: '' };
    const api = makeApi({ listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([{ ...item, concept }])),
      getBrainConcept: vi.fn().mockResolvedValue(detailResponse({ ...mockApiResponses.brainConcept.data,
        concept: { ...mockApiResponses.brainConcept.data.concept, partOfSpeech: null, level: null, ipa: '' } })) });
    render(<BrainPage apiClient={api} />);
    fireEvent.click(await screen.findByRole('button', { name: /appointment/i }));
    await waitFor(() => expect(screen.queryByText('Đang tải chi tiết khái niệm...')).not.toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveTextContent('A0');
    expect(dialog).not.toHaveTextContent('noun');
    expect(mapBrainConceptToViewModel({ ...item, concept }).cefr).toBeUndefined();
    expect(mapBrainConceptToViewModel({ ...item, concept }).pos).toBeUndefined();
  });

  it('accepts a server proficiency code without imposing the provisional CEFR enum', async () => {
    const item = mockApiResponses.brainConcepts.data[0];
    const api = makeApi({ listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([{ ...item,
      concept: { ...item.concept, level: { frameworkCode: 'catalog', code: 'L1', label: 'Level one' } } }])) });
    render(<BrainPage apiClient={api} />);
    expect(await screen.findByRole('button', { name: /appointment/i })).toBeInTheDocument();
  });

  it('rejects a definition missing its required text instead of fabricating empty translation', async () => {
    const response = { ...mockApiResponses.brainConcept, data: { ...mockApiResponses.brainConcept.data,
      concept: { ...mockApiResponses.brainConcept.data.concept,
        definitions: [{ languageCode: 'en', order: 0 }] } } } as unknown as BrainConceptResponseDto;
    const api = makeApi({ getBrainConcept: vi.fn().mockResolvedValue(response) });
    render(<BrainProbe api={api} />);
    fireEvent.click(await screen.findByText(`Select ${mockApiResponses.brainConcepts.data[0].concept.canonicalForm}`));
    await waitFor(() => expect(screen.getByTestId('brain-detail')).toHaveTextContent('settled::NETWORK_ERROR'));
  });

  it('uses the real route and HttpApiClient for all three frozen read endpoints', async () => {
    const first = mockApiResponses.brainConcepts.data[0];
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(summaryResponse(profileA, 88, null))))
      .mockResolvedValueOnce(new Response(JSON.stringify(conceptsResponse([first]))))
      .mockResolvedValueOnce(new Response(JSON.stringify(detailResponse({ ...mockApiResponses.brainConcept.data,
        concept: { ...mockApiResponses.brainConcept.data.concept, canonicalForm: 'HTTP detail' } }))));
    const api = new HttpApiClient({ baseUrl: 'https://api.example.test', fetchFn,
      authTokenProvider: { getAccessToken: async () => 'test-token' }, actorId: userA.id });
    vi.spyOn(webApi, 'getApiClient').mockReturnValue(api);
    render(<AuthProvider customClient={createMockSupabase()}><BrainRoute /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /appointment/i }));
    expect(await screen.findByText('HTTP detail')).toBeInTheDocument();
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/brain/summary',
      `https://api.example.test/v1/brain/concepts?languageProfileId=${profileA}`,
      `https://api.example.test/v1/brain/concepts/${first.concept.id}`,
    ]);
    expect(fetchFn.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true);
  });

  it('fails closed on the real route when only mock transport is configured', async () => {
    const api = makeApi({ transportKind: 'mock', getBrainSummary: vi.fn() });
    vi.spyOn(webApi, 'getApiClient').mockReturnValue(api);
    render(<BrainRoute />);
    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
    expect(api.getBrainSummary).not.toHaveBeenCalled();
    expect(screen.queryByText('483')).not.toBeInTheDocument();
  });

  it('does not load Brain for an unauthenticated actor', async () => {
    const api = makeApi({ getBrainSummary: vi.fn() });
    vi.spyOn(webApi, 'getApiClient').mockReturnValue(api);
    render(<AuthProvider customClient={createMockSupabase(null)}><BrainRoute /></AuthProvider>);
    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
    expect(api.getBrainSummary).not.toHaveBeenCalled();
  });

  it.each(['success', 'error'] as const)('isolates actor B from a late actor A detail %s', async (outcome) => {
    const pending = deferred<BrainConceptResponseDto>();
    const api = makeApi({ getBrainSummary: vi.fn().mockResolvedValueOnce(summaryResponse(profileA, 77, null))
      .mockResolvedValueOnce(summaryResponse(profileA, 88, null)),
      getBrainConcept: vi.fn().mockReturnValue(pending.promise) });
    const auth = createMockSupabase();
    const observe = vi.fn();
    render(<AuthProvider customClient={auth}><BrainProbe api={api} observe={observe} /></AuthProvider>);
    fireEvent.click(await screen.findByText(`Select ${mockApiResponses.brainConcepts.data[0].concept.canonicalForm}`));
    observe.mockClear();
    await act(async () => auth.switchUser(sessionB));
    expect(observe.mock.calls[0][0].summary).toBeNull();
    expect(observe.mock.calls[0][0].selectedDetail).toBeNull();
    await screen.findByText('success:88');
    await act(async () => {
      if (outcome === 'error') pending.reject(new Error('actor A private detail'));
      else pending.resolve(detailResponse());
    });
    expect(screen.getByTestId('brain-state')).toHaveTextContent('success:88');
    expect(screen.getByTestId('brain-detail')).toHaveTextContent('settled::');
  });

  it('does not turn a stale selection callback into a new profile request', async () => {
    const observe = vi.fn();
    const api = makeApi({ getBrainSummary: vi.fn().mockResolvedValueOnce(summaryResponse(profileA, 77, null))
      .mockResolvedValueOnce(summaryResponse(profileB, 88, null)), getBrainConcept: vi.fn().mockResolvedValue(detailResponse()) });
    const view = render(<BrainProbe api={api} observe={observe} />);
    await screen.findByText('success:77');
    const oldBrain = observe.mock.lastCall![0] as UseBrainResult;
    view.rerender(<BrainProbe api={api} profile={profileB} observe={observe} />);
    await screen.findByText('success:88');
    await act(async () => oldBrain.selectConcept(oldBrain.nodes[0]));
    expect(api.getBrainConcept).not.toHaveBeenCalled();
    expect(screen.getByTestId('brain-detail')).toHaveTextContent('settled::');
  });

  it.each(['memoryHealth', 'recognitionConfidence', 'mastery'] as const)('fails closed for missing required %s', async (field) => {
    const summary = summaryResponse(profileA, 77, null);
    const item = mockApiResponses.brainConcepts.data[0];
    const malformedSummary = field === 'memoryHealth' ? { ...summary, data: { ...summary.data, memoryHealth: undefined } }
      : field === 'recognitionConfidence' ? { ...summary, data: { ...summary.data, competence: {
        ...summary.data.competence, recognition: { ...summary.data.competence.recognition, confidence: undefined },
      } } } : summary;
    const api = makeApi({ getBrainSummary: vi.fn().mockResolvedValue(malformedSummary),
      listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([
        field === 'mastery' ? { ...item, mastery: undefined } as unknown as typeof item : item,
      ])) });
    render(<BrainPage apiClient={api} />);
    expect(await screen.findByText('Không thể tải Language Brain')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /appointment/i })).not.toBeInTheDocument();
  });

  it('keeps the committed request valid when a different profile render suspends without committing', async () => {
    const pending = deferred<BrainSummaryResponseDto>();
    const suspended = deferred<void>();
    const api = makeApi({ getBrainSummary: vi.fn().mockReturnValue(pending.promise) });
    function ConcurrentBrain({ profile }: { profile: string }) {
      const brain = useBrain(api, profile);
      if (profile === profileB) throw suspended.promise;
      return <output>{brain.status}:{brain.summary?.statusCounts.mastered}</output>;
    }
    const view = render(<Suspense fallback="suspended"><ConcurrentBrain profile={profileA} /></Suspense>);
    await waitFor(() => expect(api.getBrainSummary).toHaveBeenCalledTimes(1));
    act(() => startTransition(() => view.rerender(<Suspense fallback="suspended"><ConcurrentBrain profile={profileB} /></Suspense>)));
    await act(async () => pending.resolve(summaryResponse(profileA, 77, null)));
    expect(await screen.findByText('success:77')).toBeInTheDocument();
    expect(api.getBrainSummary).toHaveBeenCalledTimes(1);
  });

  it('recovers the same Brain snapshot after a Suspense hide and reveal', async () => {
    const gate = deferred<void>();
    const api = makeApi({
      getBrainSummary: vi.fn().mockResolvedValue(summaryResponse(profileA, 77, null)),
      listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([mockApiResponses.brainConcepts.data[0]])),
    });
    const view = render(
      <React.Suspense fallback={<output data-testid="suspense-fallback">hidden</output>}>
        <SuspenseBrain api={api} hidden={false} gate={gate} />
      </React.Suspense>
    );
    expect(await screen.findByTestId('suspense-brain-state')).toHaveTextContent('success:77');
    view.rerender(
      <React.Suspense fallback={<output data-testid="suspense-fallback">hidden</output>}>
        <SuspenseBrain api={api} hidden gate={gate} />
      </React.Suspense>
    );
    expect(screen.getByTestId('suspense-fallback')).toBeInTheDocument();
    view.rerender(
      <React.Suspense fallback={<output data-testid="suspense-fallback">hidden</output>}>
        <SuspenseBrain api={api} hidden={false} gate={gate} />
      </React.Suspense>
    );
    await act(async () => gate.resolve());
    await waitFor(() => expect(screen.getByTestId('suspense-brain-state')).toHaveTextContent('success:77'));
    expect(api.getBrainSummary.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('recovers the correct state when a response arrives while Brain is hidden', async () => {
    const gate = deferred<void>();
    const hiddenResponse = deferred<BrainSummaryResponseDto>();
    const api = makeApi({
      getBrainSummary: vi.fn().mockImplementationOnce(() => hiddenResponse.promise)
        .mockResolvedValueOnce(summaryResponse(profileA, 88, null)),
      listBrainConcepts: vi.fn().mockResolvedValue(conceptsResponse([mockApiResponses.brainConcepts.data[0]])),
    });
    const view = render(
      <React.Suspense fallback={<output data-testid="suspense-fallback">hidden</output>}>
        <SuspenseBrain api={api} hidden={false} gate={gate} />
      </React.Suspense>
    );
    await waitFor(() => expect(api.getBrainSummary).toHaveBeenCalledTimes(1));
    view.rerender(
      <React.Suspense fallback={<output data-testid="suspense-fallback">hidden</output>}>
        <SuspenseBrain api={api} hidden gate={gate} />
      </React.Suspense>
    );
    await act(async () => hiddenResponse.resolve(summaryResponse(profileA, 99, null)));
    view.rerender(
      <React.Suspense fallback={<output data-testid="suspense-fallback">hidden</output>}>
        <SuspenseBrain api={api} hidden={false} gate={gate} />
      </React.Suspense>
    );
    await act(async () => gate.resolve());
    await waitFor(() => expect(screen.getByTestId('suspense-brain-state')).toHaveTextContent('success:88'));
    expect(screen.getByTestId('suspense-brain-state')).not.toHaveTextContent('99');
    expect(api.getBrainSummary).toHaveBeenCalledTimes(2);
  });
});
