import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  CEFR_LEVELS,
  CONCEPT_STATUS_LABELS_VI,
  CONCEPT_STATUSES,
  CONFIDENCE_LEVELS,
  ERROR_HTTP_STATUS_MAP,
  ERROR_MESSAGE_VI_MAP,
  EXERCISE_MODES,
  LEARNING_ACTIVITY_TYPES,
  LinguaApiError,
  MEMORY_STATES,
  MockApiClient,
  PERSISTENCE_GAPS,
  REASON_CODES,
  REASON_CODE_LABELS_VI,
  REVIEW_RATINGS,
  REVIEW_RATING_LABELS_VI,
  createApiError,
  isApiErrorCode,
  isCEFRLevel,
  isConceptStatus,
  isConfidenceLevel,
  isExerciseMode,
  isLearningActivityType,
  isLinguaApiError,
  isMemoryState,
  isReasonCode,
  isReviewRating,
  ASSESSMENT_DOMAINS,
  STARTING_LEVEL_BANDS,
  isAssessmentDomain,
  isStartingLevelBand,
  mapApiErrorToUi,
  mapBrainConceptToViewModel,
  mapConceptDetailToDictionaryViewModel,
  mapContentToReaderPassage,
  mapProfileToViewModel,
  mapProgressToViewModel,
  mapReviewItemToViewModel,
  mapTodayActivityToViewModel,
  mockAdditionalConceptDetails,
  mockApiResponses,
  mockAssessmentItemGrammar,
  mockAssessmentItemListening,
  mockAssessmentItemReading,
  mockAssessmentItemVocabulary,
  mockAssessmentSessionResponse,
  mockBrainConceptResponse,
  mockBrainConceptSummary,
  mockBrainSummaryResponse,
  mockBootstrapMeResponse,
  mockCompletedAssessmentSessionResponse,
  mockConceptDetail,
  mockContentResponse,
  mockConceptSummaryKinds,
  mockGrammarConceptDetail,
  mockGrammarConceptSummary,
  mockMeResponse,
  mockProgressOverviewResponse,
  mockReviewQueueResponse,
  mockSkillConceptSummary,
  mockTodayPlanResponse,
  mockZeroEvidenceBrainConceptSummary,
  mockZeroEvidenceCompetence,
  startingLevelEstimate,
  type ApiClient,
  type AssessmentItemDto,
  type AssessmentSessionDto,
  type AssessmentSessionResponseDto,
  type BrainConceptDetailDto,
  type BrainConceptListResponseDto,
  type BrainConceptResponseDto,
  type BrainConceptSummaryDto,
  type BrainSummaryDto,
  type BrainSummaryResponseDto,
  type ConceptDetailDto,
  type ConceptResponseDto,
  type ConceptSummaryDto,
  type ContentResponseDto,
  type MeResponseDto,
  type ReviewQueueResponseDto,
  type StartingLevelEstimateDto,
  type TodayPlanResponseDto,
} from '@lingua/types';



const idempotencyHeaders = { 'Idempotency-Key': '10000000-0000-4000-8000-000000000001' } as const;

describe('TASK-005 generated contract compatibility', () => {
  it('requires the generated child ETag and keeps every language-profile fixture representation consistent', async () => {
    const generated = readFileSync(resolve('packages/types/src/generated/openapi.ts'), 'utf8');
    const languageSchema = generated.slice(generated.indexOf('readonly LanguageProfile: {'), generated.indexOf('readonly CreateLanguageProfileRequest: {'));
    expect(languageSchema).toContain('readonly etag: string;');
    expect(languageSchema).not.toContain('etag?:');
    const api = new MockApiClient();
    const listed = await api.listMyLanguageProfiles();
    expect(listed.data[0]?.etag).toBe(mockApiResponses.languageProfile.data.etag);
    expect(mockApiResponses.me.data.languageProfiles[0]?.etag).toBe(listed.data[0]?.etag);
    expect(listed.data[0]?.etag).toEqual(expect.any(String));
  });
  it('keeps fixture responses assignable to generated OpenAPI DTOs', () => {
    const me: MeResponseDto = mockApiResponses.me;
    const today: TodayPlanResponseDto = mockApiResponses.today;
    const review: ReviewQueueResponseDto = mockApiResponses.reviewQueue;
    const concept: ConceptResponseDto = mockApiResponses.concept;
    const content: ContentResponseDto = mockApiResponses.content;
    const brain: BrainConceptListResponseDto = mockApiResponses.brainConcepts;
    expect([me, today, review, concept, content, brain]).toHaveLength(6);
  });

  it('uses UUID identifiers and RFC 3339 UTC instants in mock DTOs', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
    const visit = (value: unknown, key = ''): void => {
      if (Array.isArray(value)) return value.forEach((item) => visit(item, key));
      if (typeof value !== 'object' || value === null) {
        if (typeof value === 'string' && (key === 'id' || key.endsWith('Id'))) expect(value).toMatch(uuid);
        if (typeof value === 'string' && key.endsWith('At')) expect(value).toMatch(utc);
        return;
      }
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    };
    visit(mockApiResponses);
  });

  it('keeps product-safe attribution and omits ingestion workflow state', () => {
    expect(mockContentResponse.data.summary.attribution).toEqual(
      expect.objectContaining({ sourceName: expect.any(String), licenseCode: expect.any(String) })
    );
    expect(mockContentResponse.data.summary).not.toHaveProperty('qualityStatus');
  });

  it('uses generated source with the no-hand-edit banner', () => {
    const generated = readFileSync(resolve('packages/types/src/generated/openapi.ts'), 'utf8');
    expect(generated).toContain('auto-generated by openapi-typescript');
    expect(generated).toContain('export interface operations');
    expect(generated).toContain(
      'readonly partOfSpeech?: components["schemas"]["PartOfSpeech"] | null;'
    );
  });

  it('accepts lexical, grammar, and skill ConceptSummary transport shapes', () => {
    const [lexical, grammar, skill] = mockConceptSummaryKinds;
    const typedGrammar: ConceptSummaryDto = mockGrammarConceptSummary;
    const typedSkill: ConceptSummaryDto = mockSkillConceptSummary;

    expect(lexical.partOfSpeech).toBe('noun');
    expect(grammar).not.toHaveProperty('partOfSpeech');
    expect(skill).not.toHaveProperty('partOfSpeech');
    expect([typedGrammar, typedSkill]).toHaveLength(2);
  });

  it('has exactly eight ConceptStatus values and never due', () => {
    expect(CONCEPT_STATUSES).toEqual([
      'unseen', 'discovered', 'learning', 'familiar',
      'active', 'mastered', 'weak', 'forgotten',
    ]);
    expect(CONCEPT_STATUSES).not.toContain('due');
    expect(mockReviewQueueResponse.data[0].concept.status).not.toBe('due');
    expect(mockReviewQueueResponse.data[0].memory.isDue).toBe(true);
  });

  it('synchronizes all eleven public error codes', () => {
    expect(API_ERROR_CODES).toHaveLength(11);
    expect(API_ERROR_CODES).toContain('PRECONDITION_FAILED');
    expect(API_ERROR_CODES).toContain('IDEMPOTENCY_KEY_REUSED');
    expect(API_ERROR_CODES).toContain('SERVICE_UNAVAILABLE');
    expect(API_ERROR_CODES).not.toContain('NETWORK_ERROR');
  });

  it('validates every authoritative runtime enum guard and rejects garbage', () => {
    const guards: ReadonlyArray<readonly [readonly string[], (value: unknown) => boolean]> = [
      [CONCEPT_STATUSES, isConceptStatus],
      [LEARNING_ACTIVITY_TYPES, isLearningActivityType],
      [REVIEW_RATINGS, isReviewRating],
      [EXERCISE_MODES, isExerciseMode],
      [MEMORY_STATES, isMemoryState],
      [REASON_CODES, isReasonCode],
      [CONFIDENCE_LEVELS, isConfidenceLevel],
      [CEFR_LEVELS, isCEFRLevel],
      [ASSESSMENT_DOMAINS, isAssessmentDomain],
      [STARTING_LEVEL_BANDS, isStartingLevelBand],
    ];
    for (const [values, guard] of guards) {
      for (const value of values) expect(guard(value)).toBe(true);
      for (const invalid of ['__invalid__', '', null, 42]) expect(guard(invalid)).toBe(false);
    }
  });


  it('keeps Vietnamese labels complete for authoritative presentation enums', () => {
    for (const status of CONCEPT_STATUSES) expect(CONCEPT_STATUS_LABELS_VI[status]).toBeTruthy();
    for (const rating of REVIEW_RATINGS) expect(REVIEW_RATING_LABELS_VI[rating]).toBeTruthy();
    for (const reason of REASON_CODES) expect(REASON_CODE_LABELS_VI[reason]).toBeTruthy();
  });

  it('maps every API error code to its catalog HTTP status and safe local copy', () => {
    for (const code of API_ERROR_CODES) {
      expect(isApiErrorCode(code)).toBe(true);
      expect(ERROR_HTTP_STATUS_MAP[code]).toBeGreaterThanOrEqual(400);
      expect(ERROR_HTTP_STATUS_MAP[code]).toBeLessThan(600);
      expect(ERROR_MESSAGE_VI_MAP[code].length).toBeGreaterThan(5);
    }
    expect(isApiErrorCode('ARBITRARY_DATABASE_ERROR')).toBe(false);
  });

  it('preserves LinguaApiError prototype, guard, and catalog-derived safe message', () => {
    const error = createApiError('NOT_FOUND');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LinguaApiError);
    expect(isLinguaApiError(error)).toBe(true);
    expect(isLinguaApiError({ code: 'NOT_FOUND' })).toBe(false);
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: ERROR_HTTP_STATUS_MAP.NOT_FOUND,
      message: ERROR_MESSAGE_VI_MAP.NOT_FOUND,
    });
  });
});

describe('TASK-006E nullable Profile compatibility', () => {
  it('maps an existing non-null profile without changing authoritative values', () => {
    const view = mapProfileToViewModel(
      mockMeResponse.data,
      mockBrainSummaryResponse.data,
      mockProgressOverviewResponse.data
    );

    expect(view.name).toBe('Learner Account');
    expect(view.email).toBe('learner@lingua-os.dev');
    expect(view.timeZone).toBe('Asia/Ho_Chi_Minh');
  });

  it('preserves absent email and timezone as null without fabricating values', () => {
    const view = mapProfileToViewModel(
      mockBootstrapMeResponse.data,
      mockBrainSummaryResponse.data,
      mockProgressOverviewResponse.data
    );

    expect(view.name).toBeNull();
    expect(view.email).toBeNull();
    expect(view.timeZone).toBeNull();
  });

  it('does not derive a display name from a present email claim', () => {
    const view = mapProfileToViewModel(
      { ...mockMeResponse.data, displayName: null },
      mockBrainSummaryResponse.data,
      mockProgressOverviewResponse.data
    );

    expect(view.name).toBeNull();
    expect(view.email).toBe('learner@lingua-os.dev');
  });

  it('contains no empty-string or email-to-name domain fallback in the Profile adapter', () => {
    const source = readFileSync(resolve('packages/types/src/adapters/index.ts'), 'utf8');

    expect(source).not.toMatch(/name:\s*profile\.displayName\s*\?\?\s*profile\.email/);
    expect(source).not.toMatch(/profile\.(?:email|timeZone)\s*\?\?\s*['"]{2}/);
  });
});

describe('TASK-005 adapters', () => {
  it('renames Today fields and preserves backend reason text', () => {
    const dto = mockTodayPlanResponse.data.activities[0];
    const view = mapTodayActivityToViewModel(dto);
    expect(view.durationMinutes).toBe(dto.estimatedMinutes);
    expect(view.reasonText).toBe(dto.reasonText);
    expect(view).not.toHaveProperty('position');
    expect(view).not.toHaveProperty('reasonCodes');
  });

  it('maps Review memory due state without exposing FSRS internals', () => {
    const view = mapReviewItemToViewModel(mockReviewQueueResponse.data[0]);
    expect(view.isDue).toBe(true);
    expect(view.dueText).toBe('Đến hạn ôn');
    expect(view).not.toHaveProperty('memory');
    expect(view).not.toHaveProperty('difficulty');
    expect(view).not.toHaveProperty('stability');
  });

  it('preserves absent non-lexical POS without generating a fake fallback', () => {
    const grammarSummary: ConceptSummaryDto = mockGrammarConceptSummary;
    const grammarDetail: ConceptDetailDto = mockGrammarConceptDetail;

    const review = mapReviewItemToViewModel({
      ...mockReviewQueueResponse.data[0],
      concept: grammarSummary,
    });
    const dictionary = mapConceptDetailToDictionaryViewModel(grammarDetail);
    const brain = mapBrainConceptToViewModel({
      ...mockBrainConceptSummary,
      concept: grammarSummary,
    });
    const reader = mapContentToReaderPassage(mockContentResponse.data, [grammarDetail]);
    const values = [
      review.pos,
      dictionary.pos,
      brain.pos,
      ...reader.sentences.flatMap((sentence) => sentence.tokens.map((token) => token.pos)),
    ];

    expect(review.pos).toBeUndefined();
    expect(dictionary.pos).toBeUndefined();
    expect(brain.pos).toBeUndefined();
    expect(values).not.toContain('unknown');
    expect(values).not.toContain('other');
    expect(values).not.toContain('n/a');
  });

  it('keeps dictionary presentation free of scheduler state', () => {
    const view = mapConceptDetailToDictionaryViewModel(mockConceptDetail);
    expect(view.term).toBe('appointment');
    expect(view.primaryTranslationVi).toContain('Cuộc hẹn');
    expect(view).not.toHaveProperty('memory');
    expect(view).not.toHaveProperty('qualityStatus');
  });

  it('uses server offsets to create Reader tokens without changing transport data', () => {
    const view = mapContentToReaderPassage(mockContentResponse.data, [
      mockConceptDetail,
      ...mockAdditionalConceptDetails,
    ]);
    expect(view.sentences[0].tokens.filter((token) => token.isTarget).map((token) => token.raw))
      .toEqual(['appointment', 'available']);
    expect(mockContentResponse.data.segments[0].sentences[0].concepts[0].startOffset).toBe(24);
  });

  it('keeps competence as three separate presentation signals', () => {
    const view = mapBrainConceptToViewModel(mockBrainConceptSummary, 'Cuộc hẹn');
    expect(view.recognitionScore).toBe(78);
    expect(view.listeningScore).toBe(56);
    expect(view.productionScore).toBe(41);
    expect(view).not.toHaveProperty('masteryScore');
  });

  it('satisfies TASK-012 Language Brain contract requirements for mastery, confidence, and nullable memoryHealth', () => {
    // 1. BrainConceptSummary supports mastery as number and aggregate confidence
    const summary: BrainConceptSummaryDto = mockBrainConceptSummary;
    expect(summary.mastery).toBe(0.62);
    expect(typeof summary.confidence).toBe('number');
    expect(summary.confidence).toBe(0.72);

    // 2. Zero-evidence BrainConceptSummary supports mastery = null and confidence = 0
    const zeroEvidenceSummary: BrainConceptSummaryDto = mockZeroEvidenceBrainConceptSummary;
    expect(zeroEvidenceSummary.mastery).toBeNull();
    expect(zeroEvidenceSummary.confidence).toBe(0);
    expect(zeroEvidenceSummary.competence.recognition.score).toBe(0.5);
    expect(zeroEvidenceSummary.competence.recognition.confidence).toBe(0);
    expect(zeroEvidenceSummary.competence.recognition.evidenceCount).toBe(0);

    // 3. Competence dimension scores and confidences remain distinct
    expect(mockZeroEvidenceCompetence.recognition.score).toBe(0.5);
    expect(mockZeroEvidenceCompetence.recognition.confidence).toBe(0);
    expect(mockZeroEvidenceCompetence.recognition.evidenceCount).toBe(0);
    expect(mockBrainConceptSummary.competence.recognition.score).not.toBe(
      mockBrainConceptSummary.competence.recognition.confidence
    );

    // 4. BrainConceptDetail exposes mastery, confidence, and evidence
    const detail: BrainConceptDetailDto = mockBrainConceptResponse.data;
    expect(detail.mastery).toBe(0.62);
    expect(detail.confidence).toBe(0.72);
    expect(detail.evidence.exposureCount).toBe(14);
    expect(detail.evidence.reviewCount).toBe(5);

    // 5. BrainSummary supports memoryHealth = null
    const brainSummary: BrainSummaryDto = mockBrainSummaryResponse.data;
    expect(brainSummary.memoryHealth).toBeNull();
    expect(brainSummary.statusCounts.total).toBe(582);
    expect(brainSummary.recentConcepts.length).toBeGreaterThanOrEqual(2);
  });

  it('MockApiClient returns contract-valid Brain DTOs without frontend calculations', async () => {
    const client = new MockApiClient();
    const summary = await client.getBrainSummary();
    const concepts = await client.listBrainConcepts();
    const concept = await client.getBrainConcept(mockConceptDetail.id);

    expect(summary.data.memoryHealth).toBeNull();
    expect(concepts.data[0].mastery).toBe(0.62);
    expect(concepts.data[0].confidence).toBe(0.72);
    expect(concept.data.mastery).toBe(0.62);
    expect(concept.data.confidence).toBe(0.72);
  });
});


describe('TASK-005 transport, cursor, and algorithm boundaries', () => {
  it('implements the operation-shaped ApiClient with mock transport', () => {
    const client: ApiClient = new MockApiClient();
    expect(client.transportKind).toBe('mock');
    expect('getBrainGraph' in client).toBe(false);
    expect('updateSettings' in client).toBe(false);
  });

  it('implements all 31 authoritative OpenAPI operations at the mock boundary', () => {
    const client = new MockApiClient() as unknown as Record<string, unknown>;
    const methods = [
      'getMe', 'updateMe', 'listMyLanguageProfiles', 'createMyLanguageProfile',
      'updateMyLanguageProfile', 'getTodayPlan', 'completeTodayActivity',
      'listReviewQueue', 'answerReviewItem', 'getConcept', 'searchDictionary',
      'analyzeReaderText', 'saveReaderSentence', 'listRecommendedContent', 'getContent',
      'recordReaderExposure', 'updateReaderProgress',
      'listLibraryItems', 'saveConceptToLibrary', 'removeConceptFromLibrary',
      'saveContentToLibrary', 'removeContentFromLibrary', 'saveSentenceToLibrary',
      'removeSentenceFromLibrary', 'startStartingLevelAssessment',
      'getStartingLevelAssessment', 'submitStartingLevelResponse', 'getBrainSummary',
      'listBrainConcepts', 'getBrainConcept', 'getProgressOverview',
    ];
    expect(methods).toHaveLength(31);
    for (const method of methods) expect(client[method], method).toEqual(expect.any(Function));
  });

  it('returns opaque cursor metadata and no offset pagination fields', async () => {
    const response = await new MockApiClient().listReviewQueue({ limit: 2 });
    expect(response.meta.nextCursor).toEqual(expect.any(String));
    expect(response.meta.hasMore).toBe(true);
    expect(response.meta).not.toHaveProperty('page');
    expect(response.meta).not.toHaveProperty('offset');
  });

  it('uses one MemorySnapshot and separate competence signals', async () => {
    const item = (await new MockApiClient().listReviewQueue()).data[0];
    expect(Object.keys(item.memory).sort()).toEqual(['dueAt', 'isDue', 'lastReviewedAt', 'state']);
    expect(Object.keys(item.competence).sort()).toEqual(['listening', 'production', 'recognition']);
  });

  it('returns static review outcomes for different ratings', async () => {
    const client = new MockApiClient();
    const base = { reviewItemId: mockReviewQueueResponse.data[0].reviewItemId, headers: idempotencyHeaders };
    const beforeToday = await client.getTodayPlan();
    const outcomes = await Promise.all((['again', 'hard', 'good', 'easy'] as const).map((rating) =>
      client.answerReviewItem({
        ...base,
        body: { rating, correct: rating !== 'again', responseTimeMs: 900 },
      })
    ));
    for (const outcome of outcomes.slice(1)) {
      expect(outcome.data.memory).toEqual(outcomes[0].data.memory);
      expect(outcome.data.competence).toEqual(outcomes[0].data.competence);
    }
    expect(await client.getTodayPlan()).toEqual(beforeToday);
  });

  it('returns deterministic empty cursor pages', async () => {
    const response = await new MockApiClient().setReturnEmpty(true).listBrainConcepts();
    expect(response.data).toEqual([]);
    expect(response.meta).toMatchObject({ nextCursor: null, hasMore: false, pageSize: 0 });
  });

  it('returns authoritative empty cursor envelopes for all five growing collections', async () => {
    const client = new MockApiClient().setReturnEmpty(true);
    const responses = await Promise.all([
      client.listReviewQueue(),
      client.searchDictionary({ query: 'appointment' }),
      client.listRecommendedContent(),
      client.listLibraryItems(),
      client.listBrainConcepts(),
    ]);
    for (const response of responses) {
      expect(response.data).toEqual([]);
      expect(response.meta).toMatchObject({ nextCursor: null, hasMore: false, pageSize: 0 });
      expect(response.meta).not.toHaveProperty('offset');
      expect(response.meta).not.toHaveProperty('page');
    }
  });

  it('protects contract fixtures across resources and distinct mock clients', async () => {
    const firstClient = new MockApiClient();
    const secondClient = new MockApiClient();
    const profile = await firstClient.getMe();
    const today = await firstClient.getTodayPlan();
    const concept = await firstClient.getConcept(mockConceptDetail.id);
    (profile.data as { displayName: string }).displayName = 'mutated';
    (today.data as { targetMinutes: number }).targetMinutes = -1;
    (concept.data as { canonicalForm: string }).canonicalForm = 'mutated';
    expect(await firstClient.getMe()).toEqual(mockApiResponses.me);
    expect(await secondClient.getTodayPlan()).toEqual(mockApiResponses.today);
    expect(await secondClient.getConcept(mockConceptDetail.id)).toEqual(mockApiResponses.concept);
  });

  it('preserves server Today ordering and reason text without recommendation logic', () => {
    const activities = mockTodayPlanResponse.data.activities;
    const mapped = activities.map(mapTodayActivityToViewModel);
    expect(mapped.map(({ id }) => id)).toEqual(activities.map(({ id }) => id));
    expect(mapped.map(({ reasonText }) => reasonText)).toEqual(activities.map(({ reasonText }) => reasonText));
    const adapterSource = readFileSync(resolve('packages/types/src/adapters/index.ts'), 'utf8');
    const todayAdapterSource = adapterSource.slice(
      adapterSource.indexOf('export function mapTodayActivityToViewModel'),
      adapterSource.indexOf('export function mapReviewItemToViewModel')
    );
    expect(todayAdapterSource).not.toMatch(/\.sort\(|recommendationScore|priorityScore|todayFormula/i);
  });

  it('keeps placement answers and level calculations outside frontend source', () => {
    const source = [
      'apps/web/src/features/onboarding/OnboardingDiagnostic.tsx',
      'packages/types/src/client.ts',
    ].map((file) => readFileSync(resolve(file), 'utf8')).join('\n');
    expect(source).not.toMatch(/correctOptionIndex|correct_option_index|answerKey|correctCount|cefrWeight/i);
    expect(source).not.toMatch(/estimatedVocabularySize|placementScore|calculatePlacement/i);
  });

  it('returns the same static assessment projection for different answers', async () => {
    const session = mockApiResponses.assessment.data;
    const item = session.currentItem;
    expect(item).not.toBeNull();
    const first = await new MockApiClient().submitStartingLevelResponse({
      assessmentId: session.id,
      headers: idempotencyHeaders,
      body: {
        itemId: item!.id,
        selectedOptionId: item!.options[0].id,
        responseTimeMs: 800,
      },
    });
    const second = await new MockApiClient().submitStartingLevelResponse({
      assessmentId: session.id,
      headers: idempotencyHeaders,
      body: {
        itemId: item!.id,
        skipped: true,
        responseTimeMs: 1600,
      },
    });
    expect(first).toEqual(second);
    expect(first).toEqual(mockApiResponses.assessment);
  });

  it('satisfies TASK-016 Starting Level Estimate contract requirements (domains, methodVersion, 8/12/16 bounds, completedAt nullability, and no production)', () => {
    // 1. Assessment domains exclude production and include only the four approved domains
    expect(ASSESSMENT_DOMAINS).toEqual([
      'vocabulary_recognition',
      'grammar_in_context',
      'reading_comprehension',
      'listening_comprehension',
    ]);
    expect(ASSESSMENT_DOMAINS).not.toContain('production');
    expect(STARTING_LEVEL_BANDS).toEqual(['A0', 'A1', 'A2', 'B1']);

    // 2. StartingLevelEstimate policy version and assessed skills (no production)
    const estimate: StartingLevelEstimateDto = startingLevelEstimate;
    expect(estimate.methodVersion).toBe('starting-level-heuristic-v1');
    expect(estimate.assessedSkills).toEqual(['recognition', 'listening']);
    expect(estimate.assessedSkills).not.toContain('production');
    expect(estimate.confidence).toBeLessThanOrEqual(0.85);
    expect(estimate.level.frameworkCode).toBe('CEFR');
    expect(['A0', 'A1', 'A2', 'B1']).toContain(estimate.level.code);

    // 3. Question items contain authoritative domain and 4 public options with no isCorrect
    const vocabItem: AssessmentItemDto = mockAssessmentItemVocabulary;
    expect(vocabItem.domain).toBe('vocabulary_recognition');
    expect(vocabItem.options).toHaveLength(4);
    expect(vocabItem.options[0]).not.toHaveProperty('isCorrect');

    const grammarItem: AssessmentItemDto = mockAssessmentItemGrammar;
    expect(grammarItem.domain).toBe('grammar_in_context');
    expect(grammarItem.options).toHaveLength(4);

    const readingItem: AssessmentItemDto = mockAssessmentItemReading;
    expect(readingItem.domain).toBe('reading_comprehension');
    expect(readingItem.options).toHaveLength(4);

    const listeningItem: AssessmentItemDto = mockAssessmentItemListening;
    expect(listeningItem.domain).toBe('listening_comprehension');
    expect(listeningItem.audioUrl).toBeDefined();
    expect(listeningItem.options).toHaveLength(4);

    // 4. Assessment session progress bounds (8/16) and completedAt nullability
    const inProgress: AssessmentSessionDto = mockAssessmentSessionResponse.data;
    expect(inProgress.status).toBe('in_progress');
    expect(inProgress.methodVersion).toBe('starting-level-heuristic-v1');
    expect(inProgress.progress.minimumItemCount).toBe(8);
    expect(inProgress.progress.maximumItemCount).toBe(16);
    expect(inProgress.completedAt).toBeNull();
    expect(inProgress.result).toBeNull();
    expect(inProgress.currentItem).not.toBeNull();

    const completed: AssessmentSessionDto = mockCompletedAssessmentSessionResponse.data;
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe('2026-08-22T03:15:00Z');
    expect(completed.result).not.toBeNull();
    expect(completed.currentItem).toBeNull();
  });
});


describe('TASK-005 errors and persistence gaps', () => {
  it('ignores raw backend messages and maps the machine code locally', () => {
    const view = mapApiErrorToUi({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'postgres password leaked in raw error',
        requestId: '00000000-0000-4000-8000-000000000001',
      },
    });
    expect(view.message).toBe(ERROR_MESSAGE_VI_MAP.INTERNAL_ERROR);
    expect(view.message).not.toContain('postgres');
  });

  it('treats connectivity failures as frontend-only NETWORK_ERROR', () => {
    expect(mapApiErrorToUi(new TypeError('fetch failed'))).toEqual({
      code: 'NETWORK_ERROR',
      message: ERROR_MESSAGE_VI_MAP.NETWORK_ERROR,
      retryable: true,
    });
  });

  it('labels every unsupported persistence behavior explicitly', () => {
    expect(PERSISTENCE_GAPS).toEqual({
      theme: 'LOCAL_ONLY',
      reducedMotion: 'LOCAL_ONLY',
      audioAutoplay: 'LOCAL_ONLY',
      playbackSpeed: 'LOCAL_ONLY',
      savedSentenceNotes: 'NOT_YET_PERSISTED',
      reminderPreferences: 'DEFERRED',
      newConceptBudget: 'DEFERRED',
      dataExport: 'DEFERRED',
      accountDeletion: 'DEFERRED',
    });
  });

  it('contains no rejected transport/internal fields in production frontend source', () => {
    const files = [
      'packages/types/src/client.ts',
      'packages/types/src/api/mock-fixtures.ts',
      'packages/types/src/view-models.ts',
      'packages/types/src/adapters/index.ts',
    ];
    const source = files.map((file) => readFileSync(resolve(file), 'utf8')).join('\n');
    for (const forbidden of [
      'userId', 'qualityStatus', 'userNotes', 'masteryScore', 'retrievability',
      'scheduledDays', 'lapses', 'stability', 'getBrainGraph',
    ]) {
      expect(source).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it('does not pass raw DTO types into React component props', () => {
    const componentFiles = [
      'apps/web/src/features/today/TodayDashboard.tsx',
      'apps/web/src/features/review/ReviewSession.tsx',
      'apps/web/src/features/read/InteractiveReader.tsx',
      'apps/web/src/features/brain/LanguageBrainCanvas.tsx',
      'apps/web/src/features/progress/ProgressAnalytics.tsx',
      'apps/web/src/features/dictionary/DictionaryView.tsx',
      'apps/web/src/features/profile/ProfileView.tsx',
    ];
    const source = componentFiles.map((file) => readFileSync(resolve(file), 'utf8')).join('\n');
    expect(source).not.toMatch(/\b[A-Z][A-Za-z]+Dto\b/);
    expect(source).not.toMatch(/from ['"]@lingua\/types['"];?\s*\/\/ raw/i);
  });
});
