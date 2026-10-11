/** Contract-shaped transport boundary. React components consume adapter view models, not this API. */
import type {
  AdminContentListResponseDto,
  AdminContentResponseDto,
  AdminContentValidationResponseDto,
  AdminConceptSearchResponseDto,
  AssessmentSessionResponseDto,
  BrainConceptListResponseDto,
  BrainConceptResponseDto,
  BrainSummaryResponseDto,
  CompleteTodayActivityRequestDto,
  ConceptResponseDto,
  ContentRecommendationsResponseDto,
  ContentResponseDto,
  CreateAdminContentRequestDto,
  CreateLanguageProfileRequestDto,
  DictionaryLookupRequestDto,
  DictionaryLookupResponseDto,
  DictionarySearchResponseDto,
  LanguageProfileResponseDto,
  LanguageProfilesResponseDto,
  LibraryItemsResponseDto,
  LibraryMutationResponseDto,
  MeResponseDto,
  OperationHeaders,
  OperationQuery,
  ProgressOverviewResponseDto,
  PutAdminVietnameseTranslationsRequestDto,
  ReaderAnalyzeRequestDto,
  ReaderAnalyzeResponseDto,
  ReaderExposureRequestDto,
  ReaderExposureResponseDto,
  ReadingProgressResponseDto,
  ReviewAnswerRequestDto,
  ReviewAnswerResponseDto,
  ReviewQueueResponseDto,
  SaveSentenceRequestDto,
  StartAssessmentRequestDto,
  SubmitAssessmentResponseRequestDto,
  TodayCompletionResponseDto,
  TodayPlanResponseDto,
  UpdateLanguageProfileRequestDto,
  UpdateMeRequestDto,
  UpdateReaderProgressRequestDto,
  UpdateAdminContentRequestDto,
  PutAdminSentenceConceptRequestDto,
} from './api/dtos';
import {
  createApiError,
  ERROR_HTTP_STATUS_MAP,
  isApiErrorCode,
  LinguaActorAbortedError,
  LinguaApiError,
  LinguaNetworkError,
  type ApiErrorCode,
} from './errors';
import {
  mockApiResponses,
  mockCursorMeta,
  mockFinalCursorMeta,
  mockResponseMeta,
} from './api/mock-fixtures';

import { toAuthTokenProvider, AuthTokenProviderError, type AuthTokenProvider, type AuthTokenProviderFn } from './auth';

export interface ApiClient {
  readonly transportKind: 'mock' | 'http';
  setActor?(actorId: string | null): void;
  getCurrentActorId?(): string | null;
  getActorGeneration?(): number;
  listAdminContent(): Promise<AdminContentListResponseDto>;
  createAdminContent(body: CreateAdminContentRequestDto): Promise<AdminContentResponseDto>;
  getAdminContent(contentId: string): Promise<AdminContentResponseDto>;
  updateAdminContent(input: { contentId: string; body: UpdateAdminContentRequestDto }): Promise<AdminContentResponseDto>;
  putAdminVietnameseTranslations(input: { contentId: string; body: PutAdminVietnameseTranslationsRequestDto }): Promise<AdminContentResponseDto>;
  validateAdminContent(contentId: string): Promise<AdminContentValidationResponseDto>;
  publishAdminContent(contentId: string): Promise<AdminContentResponseDto>;
  retireAdminContent(contentId: string): Promise<AdminContentResponseDto>;
  searchAdminConcepts(query: OperationQuery<'searchAdminConcepts'>): Promise<AdminConceptSearchResponseDto>;
  putAdminSentenceConcept(input: { contentId: string; sentenceId: string; conceptId: string; body: PutAdminSentenceConceptRequestDto }): Promise<AdminContentResponseDto>;
  deleteAdminSentenceConcept(input: { contentId: string; sentenceId: string; conceptId: string; query: OperationQuery<'deleteAdminSentenceConcept'> }): Promise<AdminContentResponseDto>;
  /** Internal cancellation for readiness/profile bootstrap reads; never sent over the API wire. */
  getMe(options?: { readonly signal?: AbortSignal }): Promise<MeResponseDto>;
  updateMe(input: { body: UpdateMeRequestDto; headers: OperationHeaders<'updateMe'> }): Promise<MeResponseDto>;
  listMyLanguageProfiles(): Promise<LanguageProfilesResponseDto>;
  createMyLanguageProfile(input: { body: CreateLanguageProfileRequestDto; headers: OperationHeaders<'createMyLanguageProfile'> }): Promise<LanguageProfileResponseDto>;
  updateMyLanguageProfile(input: { languageProfileId: string; body: UpdateLanguageProfileRequestDto; headers: OperationHeaders<'updateMyLanguageProfile'> }): Promise<LanguageProfileResponseDto>;
  getTodayPlan(query?: OperationQuery<'getTodayPlan'>): Promise<TodayPlanResponseDto>;
  completeTodayActivity(input: { planId: string; activityId: string; body: CompleteTodayActivityRequestDto; headers: OperationHeaders<'completeTodayActivity'> }): Promise<TodayCompletionResponseDto>;
  listReviewQueue(query?: OperationQuery<'listReviewQueue'>): Promise<ReviewQueueResponseDto>;
  answerReviewItem(input: { reviewItemId: string; body: ReviewAnswerRequestDto; headers: OperationHeaders<'answerReviewItem'> }): Promise<ReviewAnswerResponseDto>;
  getConcept(conceptId: string): Promise<ConceptResponseDto>;
  searchDictionary(query: OperationQuery<'searchDictionary'>): Promise<DictionarySearchResponseDto>;
  lookupDictionaryWord(
    body: DictionaryLookupRequestDto,
    options?: { readonly signal?: AbortSignal }
  ): Promise<DictionaryLookupResponseDto>;
  analyzeReaderText(body: ReaderAnalyzeRequestDto): Promise<ReaderAnalyzeResponseDto>;
  recordReaderExposure(input: { body: ReaderExposureRequestDto; headers: OperationHeaders<'recordReaderExposure'> }): Promise<ReaderExposureResponseDto>;
  updateReaderProgress(input: { contentId: string; body: UpdateReaderProgressRequestDto; headers: OperationHeaders<'updateReaderProgress'> }): Promise<ReadingProgressResponseDto>;
  saveReaderSentence(input: { body: SaveSentenceRequestDto; headers: OperationHeaders<'saveReaderSentence'> }): Promise<LibraryMutationResponseDto>;
  listRecommendedContent(query?: OperationQuery<'listRecommendedContent'>): Promise<ContentRecommendationsResponseDto>;
  getContent(contentId: string): Promise<ContentResponseDto>;
  listLibraryItems(query?: OperationQuery<'listLibraryItems'>): Promise<LibraryItemsResponseDto>;
  saveConceptToLibrary(conceptId: string): Promise<LibraryMutationResponseDto>;
  removeConceptFromLibrary(conceptId: string): Promise<LibraryMutationResponseDto>;
  saveContentToLibrary(contentId: string): Promise<LibraryMutationResponseDto>;
  removeContentFromLibrary(contentId: string): Promise<LibraryMutationResponseDto>;
  saveSentenceToLibrary(sentenceId: string): Promise<LibraryMutationResponseDto>;
  removeSentenceFromLibrary(sentenceId: string): Promise<LibraryMutationResponseDto>;
  startStartingLevelAssessment(input: { body: StartAssessmentRequestDto; headers: OperationHeaders<'startStartingLevelAssessment'> }): Promise<AssessmentSessionResponseDto>;
  getStartingLevelAssessment(assessmentId: string): Promise<AssessmentSessionResponseDto>;
  submitStartingLevelResponse(input: { assessmentId: string; body: SubmitAssessmentResponseRequestDto; headers: OperationHeaders<'submitStartingLevelResponse'> }): Promise<AssessmentSessionResponseDto>;
  getBrainSummary(query?: OperationQuery<'getBrainSummary'>): Promise<BrainSummaryResponseDto>;
  listBrainConcepts(query?: OperationQuery<'listBrainConcepts'>): Promise<BrainConceptListResponseDto>;
  getBrainConcept(conceptId: string): Promise<BrainConceptResponseDto>;
  getProgressOverview(query?: OperationQuery<'getProgressOverview'>): Promise<ProgressOverviewResponseDto>;
}

/** Options for configuring the HTTP API client transport. */
export interface HttpApiClientOptions {
  readonly baseUrl?: string;
  readonly authTokenProvider?: AuthTokenProvider | AuthTokenProviderFn;
  readonly fetchFn?: typeof fetch;
  readonly actorId?: string | null;
}

type RequestHeaders = Record<string, string>;
type QueryValue = string | number | boolean | null | undefined;

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function awaitWithAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(createAbortError());
    };
    signal.addEventListener('abort', abort, { once: true });
    operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      }
    );
  });
}

function queryString(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function normalizeHeaders(headers?: Record<string, unknown>): RequestHeaders {
  const normalized: RequestHeaders = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined && value !== null) normalized[key] = String(value);
  }
  return normalized;
}

function fallbackErrorCode(status: number): ApiErrorCode {
  const entry = (Object.entries(ERROR_HTTP_STATUS_MAP) as [ApiErrorCode, number][]).find(([, value]) => value === status);
  return entry?.[0] ?? 'INTERNAL_ERROR';
}

/** Shared contract-compatible FastAPI transport. It never retries or mutates caller idempotency keys. */
export class HttpApiClient implements ApiClient {
  readonly transportKind = 'http' as const;
  readonly authTokenProvider: AuthTokenProvider;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly etags = new Map<string, string>();
  private currentActorId: string | null = null;
  private actorGeneration = 0;

  constructor(options: HttpApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '').trim().replace(/\/+$/, '');
    this.authTokenProvider = toAuthTokenProvider(
      options.authTokenProvider ?? { getAccessToken: async () => null }
    );
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    if (options.actorId !== undefined && options.actorId !== null) {
      this.currentActorId = options.actorId;
      this.actorGeneration = 1;
    }
  }

  setActor(actorId: string | null): void {
    if (this.currentActorId !== actorId) {
      this.currentActorId = actorId;
      this.actorGeneration += 1;
      this.etags.clear();
    }
  }

  getCurrentActorId(): string | null {
    return this.currentActorId;
  }

  getActorGeneration(): number {
    return this.actorGeneration;
  }

  clearEtags(): void {
    this.etags.clear();
  }

  getLastEtag(resourceKey: string): string | undefined {
    return this.etags.get(resourceKey);
  }

  private async request<T>(params: {
    method: string;
    path: string;
    query?: Record<string, QueryValue>;
    body?: unknown;
    headers?: Record<string, unknown>;
    resourceKey?: string;
    signal?: AbortSignal;
  }): Promise<T> {
    const requestGeneration = this.actorGeneration;
    const requestActorId = this.currentActorId;

    let token: string | null;
    try {
      throwIfAborted(params.signal);
      token = await awaitWithAbort(this.authTokenProvider.getAccessToken(), params.signal);
    } catch (error) {
      if (params.signal?.aborted || isAbortError(error)) throw createAbortError();
      if (error instanceof AuthTokenProviderError) throw error;
      throw new AuthTokenProviderError('Không thể kiểm tra phiên đăng nhập.', 'INFRASTRUCTURE_ERROR', { cause: error });
    }
    if (!token) {
      throw new AuthTokenProviderError('Chưa có phiên đăng nhập.', 'UNAUTHENTICATED');
    }

    if (this.actorGeneration !== requestGeneration || this.currentActorId !== requestActorId) {
      throw new LinguaActorAbortedError();
    }
    throwIfAborted(params.signal);

    const headers: RequestHeaders = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...normalizeHeaders(params.headers),
    };
    if (this.baseUrl === '/api') {
      const ifMatchEntry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'if-match');
      if (ifMatchEntry) {
        delete headers[ifMatchEntry[0]];
        headers['X-Lingua-If-Match'] = ifMatchEntry[1];
      }
    }
    const init: RequestInit = { method: params.method, headers };
    if (params.signal) init.signal = params.signal;
    if (params.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(params.body);
    }

    let response: Response;
    try {
      response = await awaitWithAbort(
        this.fetchFn(joinUrl(this.baseUrl, params.path) + queryString(params.query), init),
        params.signal
      );
    } catch (error) {
      if (this.actorGeneration !== requestGeneration || this.currentActorId !== requestActorId) {
        throw new LinguaActorAbortedError();
      }
      if (params.signal?.aborted || isAbortError(error)) throw createAbortError();
      throw new LinguaNetworkError({ cause: error });
    }

    if (this.actorGeneration !== requestGeneration || this.currentActorId !== requestActorId) {
      throw new LinguaActorAbortedError();
    }

    throwIfAborted(params.signal);
    const raw = await awaitWithAbort(response.text(), params.signal);

    if (this.actorGeneration !== requestGeneration || this.currentActorId !== requestActorId) {
      throw new LinguaActorAbortedError();
    }

    let payload: unknown;
    try {
      payload = raw ? JSON.parse(raw) : undefined;
    } catch (error) {
      if (!response.ok) {
        throw new LinguaApiError({ code: fallbackErrorCode(response.status), httpStatus: response.status });
      }
      throw new LinguaApiError({ code: 'INTERNAL_ERROR', httpStatus: response.status });
    }

    if (!response.ok) {
      const detail = typeof payload === 'object' && payload !== null && 'error' in payload
        ? (payload as { error?: unknown }).error
        : undefined;
      const code = typeof detail === 'object' && detail !== null && 'code' in detail && isApiErrorCode((detail as { code: unknown }).code)
        ? (detail as { code: ApiErrorCode }).code
        : fallbackErrorCode(response.status);
      const requestId = typeof detail === 'object' && detail !== null && 'requestId' in detail
        ? String((detail as { requestId?: unknown }).requestId ?? '') || undefined
        : undefined;
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
      throw new LinguaApiError({ code, httpStatus: response.status, requestId, retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined });
    }
    if (typeof payload !== 'object' || payload === null || !('data' in payload) || !('meta' in payload)) {
      throw new LinguaApiError({ code: 'INTERNAL_ERROR', httpStatus: response.status });
    }
    throwIfAborted(params.signal);
    if (params.resourceKey) {
      const etag = response.headers.get('X-Lingua-Upstream-ETag') ?? response.headers.get('ETag');
      if (etag && this.actorGeneration === requestGeneration && this.currentActorId === requestActorId) {
        this.etags.set(params.resourceKey, etag);
      }
    }
    return payload as T;
  }

  listAdminContent() { return this.request<AdminContentListResponseDto>({ method: 'GET', path: '/v1/admin/content' }); }
  createAdminContent(body: CreateAdminContentRequestDto) { return this.request<AdminContentResponseDto>({ method: 'POST', path: '/v1/admin/content', body }); }
  getAdminContent(contentId: string) { return this.request<AdminContentResponseDto>({ method: 'GET', path: `/v1/admin/content/${encodeURIComponent(contentId)}` }); }
  updateAdminContent(input: Parameters<ApiClient['updateAdminContent']>[0]) { return this.request<AdminContentResponseDto>({ method: 'PATCH', path: `/v1/admin/content/${encodeURIComponent(input.contentId)}`, body: input.body }); }
  putAdminVietnameseTranslations(input: Parameters<ApiClient['putAdminVietnameseTranslations']>[0]) { return this.request<AdminContentResponseDto>({ method: 'PUT', path: `/v1/admin/content/${encodeURIComponent(input.contentId)}/translations/vi`, body: input.body }); }
  validateAdminContent(contentId: string) { return this.request<AdminContentValidationResponseDto>({ method: 'POST', path: `/v1/admin/content/${encodeURIComponent(contentId)}/validate` }); }
  publishAdminContent(contentId: string) { return this.request<AdminContentResponseDto>({ method: 'POST', path: `/v1/admin/content/${encodeURIComponent(contentId)}/publish` }); }
  retireAdminContent(contentId: string) { return this.request<AdminContentResponseDto>({ method: 'POST', path: `/v1/admin/content/${encodeURIComponent(contentId)}/retire` }); }
  searchAdminConcepts(query: OperationQuery<'searchAdminConcepts'>) { return this.request<AdminConceptSearchResponseDto>({ method: 'GET', path: '/v1/admin/concepts/search', query }); }
  putAdminSentenceConcept(input: Parameters<ApiClient['putAdminSentenceConcept']>[0]) { return this.request<AdminContentResponseDto>({ method: 'PUT', path: `/v1/admin/content/${encodeURIComponent(input.contentId)}/sentences/${encodeURIComponent(input.sentenceId)}/concepts/${encodeURIComponent(input.conceptId)}`, body: input.body }); }
  deleteAdminSentenceConcept(input: Parameters<ApiClient['deleteAdminSentenceConcept']>[0]) { return this.request<AdminContentResponseDto>({ method: 'DELETE', path: `/v1/admin/content/${encodeURIComponent(input.contentId)}/sentences/${encodeURIComponent(input.sentenceId)}/concepts/${encodeURIComponent(input.conceptId)}`, query: input.query }); }

  getMe(options?: { readonly signal?: AbortSignal }) {
    return this.request<MeResponseDto>({ method: 'GET', path: '/v1/me', resourceKey: 'me', signal: options?.signal });
  }
  updateMe(input: Parameters<ApiClient['updateMe']>[0]) { return this.request<MeResponseDto>({ method: 'PATCH', path: '/v1/me', body: input.body, headers: input.headers, resourceKey: 'me' }); }
  listMyLanguageProfiles() { return this.request<LanguageProfilesResponseDto>({ method: 'GET', path: '/v1/me/languages' }); }
  createMyLanguageProfile(input: Parameters<ApiClient['createMyLanguageProfile']>[0]) { return this.request<LanguageProfileResponseDto>({ method: 'POST', path: '/v1/me/languages', body: input.body, headers: input.headers, resourceKey: 'language-profile' }); }
  updateMyLanguageProfile(input: Parameters<ApiClient['updateMyLanguageProfile']>[0]) { return this.request<LanguageProfileResponseDto>({ method: 'PATCH', path: `/v1/me/languages/${encodeURIComponent(input.languageProfileId)}`, body: input.body, headers: input.headers, resourceKey: `language-profile:${input.languageProfileId}` }); }
  getTodayPlan(query?: OperationQuery<'getTodayPlan'>) { return this.request<TodayPlanResponseDto>({ method: 'GET', path: '/v1/today', query: query as Record<string, QueryValue> | undefined }); }
  completeTodayActivity(input: Parameters<ApiClient['completeTodayActivity']>[0]) { return this.request<TodayCompletionResponseDto>({ method: 'POST', path: `/v1/today/${encodeURIComponent(input.planId)}/activities/${encodeURIComponent(input.activityId)}/complete`, body: input.body, headers: input.headers }); }
  listReviewQueue(query?: OperationQuery<'listReviewQueue'>) { return this.request<ReviewQueueResponseDto>({ method: 'GET', path: '/v1/review/queue', query: query as Record<string, QueryValue> | undefined }); }
  answerReviewItem(input: Parameters<ApiClient['answerReviewItem']>[0]) { return this.request<ReviewAnswerResponseDto>({ method: 'POST', path: `/v1/review/${encodeURIComponent(input.reviewItemId)}/answer`, body: input.body, headers: input.headers }); }
  getConcept(conceptId: string) { return this.request<ConceptResponseDto>({ method: 'GET', path: `/v1/concepts/${encodeURIComponent(conceptId)}` }); }
  searchDictionary(query: OperationQuery<'searchDictionary'>) { return this.request<DictionarySearchResponseDto>({ method: 'GET', path: '/v1/dictionary/search', query: query as Record<string, QueryValue> }); }
  lookupDictionaryWord(body: DictionaryLookupRequestDto, options?: { readonly signal?: AbortSignal }) {
    return this.request<DictionaryLookupResponseDto>({
      method: 'POST',
      path: '/v1/dictionary/lookup',
      body,
      signal: options?.signal,
    });
  }
  analyzeReaderText(body: ReaderAnalyzeRequestDto) { return this.request<ReaderAnalyzeResponseDto>({ method: 'POST', path: '/v1/reader/analyze', body }); }
  recordReaderExposure(input: Parameters<ApiClient['recordReaderExposure']>[0]) { return this.request<ReaderExposureResponseDto>({ method: 'POST', path: '/v1/reader/exposures', body: input.body, headers: input.headers }); }
  updateReaderProgress(input: Parameters<ApiClient['updateReaderProgress']>[0]) { return this.request<ReadingProgressResponseDto>({ method: 'PUT', path: `/v1/reader/progress/${encodeURIComponent(input.contentId)}`, body: input.body, headers: input.headers }); }
  saveReaderSentence(input: Parameters<ApiClient['saveReaderSentence']>[0]) { return this.request<LibraryMutationResponseDto>({ method: 'POST', path: '/v1/reader/save-sentence', body: input.body, headers: input.headers }); }
  listRecommendedContent(query?: OperationQuery<'listRecommendedContent'>) { return this.request<ContentRecommendationsResponseDto>({ method: 'GET', path: '/v1/content/recommended', query: query as Record<string, QueryValue> | undefined }); }
  getContent(contentId: string) { return this.request<ContentResponseDto>({ method: 'GET', path: `/v1/content/${encodeURIComponent(contentId)}` }); }
  listLibraryItems(query?: OperationQuery<'listLibraryItems'>) { return this.request<LibraryItemsResponseDto>({ method: 'GET', path: '/v1/library/items', query: query as Record<string, QueryValue> | undefined }); }
  saveConceptToLibrary(conceptId: string) { return this.request<LibraryMutationResponseDto>({ method: 'PUT', path: `/v1/library/concepts/${encodeURIComponent(conceptId)}` }); }
  removeConceptFromLibrary(conceptId: string) { return this.request<LibraryMutationResponseDto>({ method: 'DELETE', path: `/v1/library/concepts/${encodeURIComponent(conceptId)}` }); }
  saveContentToLibrary(contentId: string) { return this.request<LibraryMutationResponseDto>({ method: 'PUT', path: `/v1/library/content/${encodeURIComponent(contentId)}` }); }
  removeContentFromLibrary(contentId: string) { return this.request<LibraryMutationResponseDto>({ method: 'DELETE', path: `/v1/library/content/${encodeURIComponent(contentId)}` }); }
  saveSentenceToLibrary(sentenceId: string) { return this.request<LibraryMutationResponseDto>({ method: 'PUT', path: `/v1/library/sentences/${encodeURIComponent(sentenceId)}` }); }
  removeSentenceFromLibrary(sentenceId: string) { return this.request<LibraryMutationResponseDto>({ method: 'DELETE', path: `/v1/library/sentences/${encodeURIComponent(sentenceId)}` }); }
  startStartingLevelAssessment(input: Parameters<ApiClient['startStartingLevelAssessment']>[0]) { return this.request<AssessmentSessionResponseDto>({ method: 'POST', path: '/v1/assessments', body: input.body, headers: input.headers, resourceKey: `assessment:${input.body.languageProfileId}` }); }
  getStartingLevelAssessment(assessmentId: string) { return this.request<AssessmentSessionResponseDto>({ method: 'GET', path: `/v1/assessments/${encodeURIComponent(assessmentId)}`, resourceKey: `assessment:${assessmentId}` }); }
  submitStartingLevelResponse(input: Parameters<ApiClient['submitStartingLevelResponse']>[0]) { return this.request<AssessmentSessionResponseDto>({ method: 'POST', path: `/v1/assessments/${encodeURIComponent(input.assessmentId)}/responses`, body: input.body, headers: input.headers, resourceKey: `assessment:${input.assessmentId}` }); }
  getBrainSummary(query?: OperationQuery<'getBrainSummary'>) { return this.request<BrainSummaryResponseDto>({ method: 'GET', path: '/v1/brain/summary', query: query as Record<string, QueryValue> | undefined }); }
  listBrainConcepts(query?: OperationQuery<'listBrainConcepts'>) { return this.request<BrainConceptListResponseDto>({ method: 'GET', path: '/v1/brain/concepts', query: query as Record<string, QueryValue> | undefined }); }
  getBrainConcept(conceptId: string) { return this.request<BrainConceptResponseDto>({ method: 'GET', path: `/v1/brain/concepts/${encodeURIComponent(conceptId)}` }); }
  getProgressOverview(query?: OperationQuery<'getProgressOverview'>) { return this.request<ProgressOverviewResponseDto>({ method: 'GET', path: '/v1/progress/overview', query: query as Record<string, QueryValue> | undefined }); }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyCursorResponse<T extends readonly unknown[]>(): { data: T; meta: typeof mockFinalCursorMeta } {
  return { data: [] as unknown as T, meta: mockFinalCursorMeta };
}

export class MockApiClient implements ApiClient {
  readonly transportKind = 'mock' as const;
  private latencyMs: number;
  private forcedError: ApiErrorCode | null = null;
  private returnEmpty = false;
  private currentActorId: string | null = null;
  private actorGeneration = 0;

  constructor(initialLatencyMs = 0) {
    this.latencyMs = Math.max(0, initialLatencyMs);
  }

  setLatency(ms: number): this { this.latencyMs = Math.max(0, ms); return this; }
  setForceError(code: ApiErrorCode | null): this { this.forcedError = code; return this; }
  setReturnEmpty(empty: boolean): this { this.returnEmpty = empty; return this; }
  resetState(): void { this.forcedError = null; this.returnEmpty = false; }
  setActor(actorId: string | null): void {
    if (this.currentActorId !== actorId) {
      this.currentActorId = actorId;
      this.actorGeneration += 1;
    }
  }

  getCurrentActorId(): string | null {
    return this.currentActorId;
  }

  getActorGeneration(): number {
    return this.actorGeneration;
  }

  private async ready(): Promise<void> {
    const gen = this.actorGeneration;
    const actorId = this.currentActorId;
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    if (this.actorGeneration !== gen || this.currentActorId !== actorId) {
      throw new LinguaActorAbortedError();
    }
    if (this.forcedError) throw createApiError(this.forcedError);
  }

  private async fixture<T>(value: T): Promise<T> { await this.ready(); return clone(value); }

  private async adminForbidden(): Promise<never> {
    await this.ready();
    throw createApiError('FORBIDDEN');
  }

  listAdminContent(): Promise<AdminContentListResponseDto> { return this.adminForbidden(); }
  createAdminContent(_body: CreateAdminContentRequestDto): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  getAdminContent(_contentId: string): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  updateAdminContent(_input: Parameters<ApiClient['updateAdminContent']>[0]): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  putAdminVietnameseTranslations(_input: Parameters<ApiClient['putAdminVietnameseTranslations']>[0]): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  validateAdminContent(_contentId: string): Promise<AdminContentValidationResponseDto> { return this.adminForbidden(); }
  publishAdminContent(_contentId: string): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  retireAdminContent(_contentId: string): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  searchAdminConcepts(_query: OperationQuery<'searchAdminConcepts'>): Promise<AdminConceptSearchResponseDto> { return this.adminForbidden(); }
  putAdminSentenceConcept(_input: Parameters<ApiClient['putAdminSentenceConcept']>[0]): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  deleteAdminSentenceConcept(_input: Parameters<ApiClient['deleteAdminSentenceConcept']>[0]): Promise<AdminContentResponseDto> { return this.adminForbidden(); }
  getMe() { return this.fixture(mockApiResponses.me); }
  updateMe(_input: Parameters<ApiClient['updateMe']>[0]) { return this.fixture(mockApiResponses.me); }
  listMyLanguageProfiles() { return this.fixture(this.returnEmpty ? { data: [], meta: mockResponseMeta } : mockApiResponses.languageProfiles); }
  createMyLanguageProfile(_input: Parameters<ApiClient['createMyLanguageProfile']>[0]) { return this.fixture(mockApiResponses.languageProfile); }
  updateMyLanguageProfile(_input: Parameters<ApiClient['updateMyLanguageProfile']>[0]) { return this.fixture(mockApiResponses.languageProfile); }
  getTodayPlan(_query?: OperationQuery<'getTodayPlan'>) { return this.fixture(mockApiResponses.today); }
  completeTodayActivity(_input: Parameters<ApiClient['completeTodayActivity']>[0]) { return this.fixture(mockApiResponses.todayCompletion); }
  listReviewQueue(_query?: OperationQuery<'listReviewQueue'>) { return this.fixture(this.returnEmpty ? emptyCursorResponse<ReviewQueueResponseDto['data']>() : mockApiResponses.reviewQueue); }
  answerReviewItem(_input: Parameters<ApiClient['answerReviewItem']>[0]) { return this.fixture(mockApiResponses.reviewAnswer); }
  getConcept(_conceptId: string) { return this.fixture(mockApiResponses.concept); }
  searchDictionary(_query: OperationQuery<'searchDictionary'>) { return this.fixture(this.returnEmpty ? emptyCursorResponse<DictionarySearchResponseDto['data']>() : mockApiResponses.dictionary); }
  async lookupDictionaryWord(
    body: DictionaryLookupRequestDto,
    options?: { readonly signal?: AbortSignal }
  ): Promise<DictionaryLookupResponseDto> {
    await awaitWithAbort(this.ready(), options?.signal);
    throwIfAborted(options?.signal);
    return {
      data: { surface: body.surface, matchStatus: 'not_found', entries: [] },
      meta: mockResponseMeta,
    };
  }
  analyzeReaderText(_body: ReaderAnalyzeRequestDto) { return this.fixture(mockApiResponses.readerAnalysis); }
  recordReaderExposure(_input: Parameters<ApiClient['recordReaderExposure']>[0]) { return this.fixture(mockApiResponses.readerExposure); }
  updateReaderProgress(_input: Parameters<ApiClient['updateReaderProgress']>[0]) { return this.fixture(mockApiResponses.readingProgress); }
  saveReaderSentence(input: Parameters<ApiClient['saveReaderSentence']>[0]) { return this.libraryMutation(input.body.sentenceId, 'sentence', true); }
  listRecommendedContent(_query?: OperationQuery<'listRecommendedContent'>) { return this.fixture(this.returnEmpty ? emptyCursorResponse<ContentRecommendationsResponseDto['data']>() : mockApiResponses.recommendations); }
  getContent(_contentId: string) { return this.fixture(mockApiResponses.content); }
  listLibraryItems(_query?: OperationQuery<'listLibraryItems'>) { return this.fixture(this.returnEmpty ? emptyCursorResponse<LibraryItemsResponseDto['data']>() : mockApiResponses.library); }
  saveConceptToLibrary(conceptId: string) { return this.libraryMutation(conceptId, 'concept', true); }
  removeConceptFromLibrary(conceptId: string) { return this.libraryMutation(conceptId, 'concept', false); }
  saveContentToLibrary(contentId: string) { return this.libraryMutation(contentId, 'content', true); }
  removeContentFromLibrary(contentId: string) { return this.libraryMutation(contentId, 'content', false); }
  saveSentenceToLibrary(sentenceId: string) { return this.libraryMutation(sentenceId, 'sentence', true); }
  removeSentenceFromLibrary(sentenceId: string) { return this.libraryMutation(sentenceId, 'sentence', false); }
  startStartingLevelAssessment(_input: Parameters<ApiClient['startStartingLevelAssessment']>[0]) { return this.fixture(mockApiResponses.assessment); }
  getStartingLevelAssessment(_assessmentId: string) { return this.fixture(mockApiResponses.assessment); }
  submitStartingLevelResponse(_input: Parameters<ApiClient['submitStartingLevelResponse']>[0]) { return this.fixture(mockApiResponses.assessment); }
  getBrainSummary(_query?: OperationQuery<'getBrainSummary'>) { return this.fixture(mockApiResponses.brainSummary); }
  listBrainConcepts(_query?: OperationQuery<'listBrainConcepts'>) { return this.fixture(this.returnEmpty ? emptyCursorResponse<BrainConceptListResponseDto['data']>() : mockApiResponses.brainConcepts); }
  getBrainConcept(_conceptId: string) { return this.fixture(mockApiResponses.brainConcept); }
  getProgressOverview(_query?: OperationQuery<'getProgressOverview'>) { return this.fixture(mockApiResponses.progress); }

  private async libraryMutation(id: string, itemType: 'concept' | 'content' | 'sentence', isSaved: boolean): Promise<LibraryMutationResponseDto> {
    await this.ready();
    return clone({
      data: { id, itemType, isSaved, ...(isSaved ? { savedAt: '2026-08-22T03:00:00Z' } : {}) },
      meta: mockResponseMeta,
    });
  }
}

export const mockApiClient = new MockApiClient();
export const defaultMockApiClient = mockApiClient;

// Exported for cursor-boundary tests; consumers must treat cursors as opaque strings.
export const mockOpaqueCursor = mockCursorMeta.nextCursor;
