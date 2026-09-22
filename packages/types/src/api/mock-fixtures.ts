/** Deterministic OpenAPI response fixtures. Values are static; no backend algorithm runs here. */
import type {
  AssessmentItemDto,
  AssessmentOptionDto,
  AssessmentProgressDto,
  AssessmentSessionDto,
  AssessmentSessionResponseDto,
  BrainConceptDetailDto,
  BrainConceptListResponseDto,
  BrainConceptResponseDto,
  BrainConceptSummaryDto,
  BrainSummaryDto,
  BrainSummaryResponseDto,
  CompetenceSignalsDto,
  ConceptDetailDto,
  ConceptSummaryDto,
  ConceptResponseDto,
  ContentRecommendationsResponseDto,
  ContentResponseDto,
  CursorResponseMetaDto,
  DictionarySearchResponseDto,
  LanguageProfileResponseDto,
  LanguageProfilesResponseDto,
  LibraryItemsResponseDto,
  LibraryMutationResponseDto,
  MeResponseDto,
  MemorySnapshotDto,
  ProgressOverviewResponseDto,
  ReaderAnalyzeResponseDto,
  ReaderExposureResponseDto,
  ReadingProgressResponseDto,
  ResponseMetaDto,
  ReviewAnswerResponseDto,
  ReviewQueueResponseDto,
  StartingLevelBandDto,
  StartingLevelEstimateDto,
  TodayCompletionResponseDto,
  TodayPlanResponseDto,
} from './dtos';

export const MOCK_IDS = Object.freeze({
  request: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  languageProfile: '00000000-0000-4000-8000-000000000003',
  plan: '00000000-0000-4000-8000-000000000004',
  activityReview: '00000000-0000-4000-8000-000000000005',
  activityRead: '00000000-0000-4000-8000-000000000006',
  activityListen: '00000000-0000-4000-8000-000000000017',
  activityLearn: '00000000-0000-4000-8000-000000000018',
  reviewItem: '00000000-0000-4000-8000-000000000007',
  reviewItemAvailable: '00000000-0000-4000-8000-000000000019',
  reviewItemConvenient: '00000000-0000-4000-8000-000000000020',
  conceptAppointment: '00000000-0000-4000-8000-000000000008',
  conceptAvailable: '00000000-0000-4000-8000-000000000009',
  conceptSchedule: '00000000-0000-4000-8000-000000000021',
  conceptConvenient: '00000000-0000-4000-8000-000000000022',
  conceptHesitate: '00000000-0000-4000-8000-000000000023',
  conceptCollaborate: '00000000-0000-4000-8000-000000000024',
  conceptPresentPerfect: '00000000-0000-4000-8000-000000000025',
  conceptListeningForGist: '00000000-0000-4000-8000-000000000026',
  sentence: '00000000-0000-4000-8000-000000000010',
  segment: '00000000-0000-4000-8000-000000000011',
  content: '00000000-0000-4000-8000-000000000012',
  analysis: '00000000-0000-4000-8000-000000000013',
  assessment: '00000000-0000-4000-8000-000000000014',
  assessmentItem: '00000000-0000-4000-8000-000000000015',
  option: '00000000-0000-4000-8000-000000000016',
});

export const mockResponseMeta = {
  requestId: MOCK_IDS.request,
  apiVersion: '1.0',
} as const satisfies ResponseMetaDto;

export const mockCursorMeta = {
  ...mockResponseMeta,
  nextCursor: 'eyJ2IjoxLCJhZnRlciI6IjAwMDAwMDAwIn0',
  hasMore: true,
  pageSize: 2,
} as const satisfies CursorResponseMetaDto;

export const mockFinalCursorMeta = {
  ...mockResponseMeta,
  nextCursor: null,
  hasMore: false,
  pageSize: 0,
} as const satisfies CursorResponseMetaDto;

export const mockCompetence = {
  recognition: { score: 0.78, confidence: 0.82, evidenceCount: 18, updatedAt: '2026-08-22T03:00:00Z' },
  listening: { score: 0.56, confidence: 0.64, evidenceCount: 9, updatedAt: '2026-08-22T03:00:00Z' },
  production: { score: 0.41, confidence: 0.5, evidenceCount: 5, updatedAt: '2026-08-22T03:00:00Z' },
} as const satisfies CompetenceSignalsDto;

export const mockMemorySnapshot = {
  state: 'review',
  dueAt: '2026-08-22T08:00:00Z',
  lastReviewedAt: '2026-08-17T08:00:00Z',
  isDue: true,
} as const satisfies MemorySnapshotDto;

const levelA2 = { frameworkCode: 'CEFR', code: 'A2', label: 'Elementary' } as const satisfies StartingLevelBandDto;
export const startingLevelEstimate = {
  level: levelA2,
  confidence: 0.79,
  confidenceBand: 'medium',
  assessedSkills: ['recognition', 'listening'],
  evidenceCount: 12,
  methodVersion: 'starting-level-heuristic-v1',
  estimatedAt: '2026-08-22T03:00:00Z',
} as const satisfies StartingLevelEstimateDto;


export const mockLanguageProfile = {
  id: MOCK_IDS.languageProfile,
  etag: '"mock-language-profile-token"',
  targetLanguageCode: 'en',
  nativeLanguageCode: 'vi',
  goal: 'communication',
  dailyMinutes: 25,
  targetLevel: { frameworkCode: 'CEFR', code: 'B1', label: 'Intermediate' },
  startingLevelEstimate,
  status: 'active',
  createdAt: '2026-08-01T03:00:00Z',
  updatedAt: '2026-08-22T03:00:00Z',
} as const;

export const mockMeResponse = {
  data: {
    id: MOCK_IDS.user,
    email: 'learner@lingua-os.dev',
    displayName: 'Learner Account',
    interfaceLanguageCode: 'vi',
    timeZone: 'Asia/Ho_Chi_Minh',
    languageProfiles: [mockLanguageProfile],
    createdAt: '2026-08-01T03:00:00Z',
    updatedAt: '2026-08-22T03:00:00Z',
  },
  meta: mockResponseMeta,
} as const satisfies MeResponseDto;

export const mockBootstrapMeResponse = {
  data: {
    id: MOCK_IDS.user,
    email: null,
    displayName: null,
    interfaceLanguageCode: 'vi',
    timeZone: null,
    languageProfiles: [],
    createdAt: '2026-09-01T03:00:00Z',
    updatedAt: '2026-09-01T03:00:00Z',
  },
  meta: mockResponseMeta,
} as const satisfies MeResponseDto;

export const mockLanguageProfilesResponse = {
  data: [mockLanguageProfile],
  meta: mockResponseMeta,
} as const satisfies LanguageProfilesResponseDto;

export const mockLanguageProfileResponse = {
  data: mockLanguageProfile,
  meta: mockResponseMeta,
} as const satisfies LanguageProfileResponseDto;

export const mockConceptSummary = {
  id: MOCK_IDS.conceptAppointment,
  canonicalForm: 'appointment',
  partOfSpeech: 'noun',
  ipa: '/əˈpɔɪnt.mənt/',
  level: levelA2,
  status: 'learning',
  isDue: true,
} as const satisfies ConceptSummaryDto;

export const mockGrammarConceptSummary = {
  id: MOCK_IDS.conceptPresentPerfect,
  canonicalForm: 'present-perfect',
  level: levelA2,
  status: 'learning',
  isDue: true,
} as const satisfies ConceptSummaryDto;

export const mockSkillConceptSummary = {
  id: MOCK_IDS.conceptListeningForGist,
  canonicalForm: 'listening-for-gist',
  status: 'discovered',
  isDue: false,
} as const satisfies ConceptSummaryDto;

export const mockConceptSummaryKinds = [
  mockConceptSummary,
  mockGrammarConceptSummary,
  mockSkillConceptSummary,
] as const satisfies readonly ConceptSummaryDto[];

export const mockSecondConceptSummary = {
  id: MOCK_IDS.conceptAvailable,
  canonicalForm: 'available',
  partOfSpeech: 'adjective',
  ipa: '/əˈveɪ.lə.bəl/',
  level: levelA2,
  status: 'weak',
  isDue: false,
} as const;

export const mockAdditionalConceptSummaries = [
  { id: MOCK_IDS.conceptSchedule, canonicalForm: 'schedule', partOfSpeech: 'noun', ipa: '/ˈskedʒ.uːl/', level: levelA2, status: 'learning', isDue: false },
  { id: MOCK_IDS.conceptConvenient, canonicalForm: 'convenient', partOfSpeech: 'adjective', ipa: '/kənˈviː.ni.ənt/', level: { frameworkCode: 'CEFR', code: 'B1', label: 'Intermediate' }, status: 'learning', isDue: true },
  { id: MOCK_IDS.conceptHesitate, canonicalForm: 'hesitate', partOfSpeech: 'verb', ipa: '/ˈhez.ɪ.teɪt/', level: { frameworkCode: 'CEFR', code: 'B1', label: 'Intermediate' }, status: 'familiar', isDue: false },
  { id: MOCK_IDS.conceptCollaborate, canonicalForm: 'collaborate', partOfSpeech: 'verb', ipa: '/kəˈlæb.ə.reɪt/', level: { frameworkCode: 'CEFR', code: 'B2', label: 'Upper intermediate' }, status: 'active', isDue: false },
] as const;

export const mockConceptDetail = {
  id: MOCK_IDS.conceptAppointment,
  languageCode: 'en',
  canonicalForm: 'appointment',
  partOfSpeech: 'noun',
  ipa: '/əˈpɔɪnt.mənt/',
  level: levelA2,
  definitions: [
    {
      definition: 'An arrangement to meet someone at a particular time and place.',
      translation: '1. Cuộc hẹn chính thức (với bác sĩ, đối tác, khách hàng).',
      languageCode: 'en',
      order: 0,
    },
  ],
  examples: [
    {
      sentenceId: MOCK_IDS.sentence,
      text: 'I made an appointment to see the dentist on Friday.',
      translation: 'Tôi đã đặt hẹn khám nha sĩ vào thứ Sáu.',
    },
  ],
  relations: [],
  learner: {
    status: 'learning',
    isDue: true,
    exposureCount: 14,
    lastSeenAt: '2026-08-21T03:00:00Z',
    memory: mockMemorySnapshot,
    competence: mockCompetence,
  },
} as const satisfies ConceptDetailDto;

export const mockGrammarConceptDetail = {
  id: MOCK_IDS.conceptPresentPerfect,
  languageCode: 'en',
  canonicalForm: 'present-perfect',
  level: levelA2,
  definitions: [
    {
      definition: 'A grammar concept for actions connected to the present.',
      translation: 'Thì hiện tại hoàn thành.',
      languageCode: 'en',
      order: 0,
    },
  ],
  examples: [],
  relations: [],
  grammar: {
    patternFormula: 'S + have/has + V3/ed',
    syntacticCategory: 'tense_aspect',
    pragmaticFunction: 'Connect a past action to the present.',
    vietnameseExplanation: 'Dùng have/has với quá khứ phân từ để nối hành động quá khứ với hiện tại.',
    vietnameseCommonTraps: 'Không dùng mốc thời gian quá khứ đã kết thúc.',
    structuralSlots: [
      { label: 'S', role: 'subject', required: true, examples: ['I', 'she'] },
      {
        label: 'have/has + V3',
        role: 'present_relevance',
        required: true,
        examples: ['have finished', 'has gone'],
      },
    ],
  },
  learner: {
    status: 'learning',
    isDue: true,
    exposureCount: 6,
    memory: mockMemorySnapshot,
    competence: mockCompetence,
  },
} as const satisfies ConceptDetailDto;

function conceptDetailFixture(
  summary: typeof mockSecondConceptSummary | (typeof mockAdditionalConceptSummaries)[number],
  translation: string,
  definition: string
): ConceptDetailDto {
  return {
    id: summary.id,
    languageCode: 'en',
    canonicalForm: summary.canonicalForm,
    partOfSpeech: summary.partOfSpeech,
    ipa: summary.ipa,
    level: summary.level,
    definitions: [{ definition, translation, languageCode: 'en', order: 0 }],
    examples: [],
    relations: [],
    learner: {
      status: summary.status,
      isDue: summary.isDue,
      exposureCount: 8,
      memory: { ...mockMemorySnapshot, isDue: summary.isDue },
      competence: mockCompetence,
    },
  };
}

export const mockAdditionalConceptDetails: readonly ConceptDetailDto[] = [
  conceptDetailFixture(mockSecondConceptSummary, 'Có sẵn, rảnh rỗi', 'Able to be used or free to meet.'),
  conceptDetailFixture(mockAdditionalConceptSummaries[0], 'Lịch trình', 'A plan of events and times.'),
  conceptDetailFixture(mockAdditionalConceptSummaries[1], 'Tiện lợi, thuận tiện', 'Suitable for your needs and causing little difficulty.'),
  conceptDetailFixture(mockAdditionalConceptSummaries[2], 'Ngập ngừng, do dự', 'To pause before doing or saying something.'),
  conceptDetailFixture(mockAdditionalConceptSummaries[3], 'Hợp tác, cộng tác', 'To work with someone for a shared purpose.'),
];

export const mockConceptResponse = {
  data: mockConceptDetail,
  meta: mockResponseMeta,
} as const satisfies ConceptResponseDto;

export const mockDictionarySearchResponse = {
  data: [mockConceptSummary, mockSecondConceptSummary, ...mockAdditionalConceptSummaries],
  meta: { ...mockCursorMeta, pageSize: 6 },
} as const satisfies DictionarySearchResponseDto;

const reviewPrompt = {
  promptText: 'Một cuộc hẹn chính thức với bác sĩ hoặc đối tác.',
  contextSentence: 'I would like to make an appointment for tomorrow morning.',
  translation: 'Tôi muốn đặt một cuộc hẹn vào sáng mai.',
} as const;

export const mockReviewQueueResponse = {
  data: [
    {
      reviewItemId: MOCK_IDS.reviewItem,
      concept: mockConceptSummary,
      exerciseMode: 'self_recall',
      prompt: reviewPrompt,
      memory: mockMemorySnapshot,
      competence: mockCompetence,
    },
    {
      reviewItemId: MOCK_IDS.reviewItemAvailable,
      concept: mockSecondConceptSummary,
      exerciseMode: 'self_recall',
      prompt: {
        promptText: 'Có sẵn để sử dụng hoặc đang rảnh rỗi.',
        contextSentence: 'Are you available this afternoon?',
        translation: 'Chiều nay bạn có rảnh không?',
      },
      memory: mockMemorySnapshot,
      competence: mockCompetence,
    },
    {
      reviewItemId: MOCK_IDS.reviewItemConvenient,
      concept: mockAdditionalConceptSummaries[1],
      exerciseMode: 'self_recall',
      prompt: {
        promptText: 'Thuận tiện về thời gian hoặc địa điểm.',
        contextSentence: 'Is Monday morning convenient for you?',
        translation: 'Sáng thứ Hai có thuận tiện cho bạn không?',
      },
      memory: mockMemorySnapshot,
      competence: mockCompetence,
    },
  ],
  meta: { ...mockCursorMeta, pageSize: 3 },
} as const satisfies ReviewQueueResponseDto;

export const mockReviewAnswerResponse = {
  data: {
    reviewItemId: MOCK_IDS.reviewItem,
    memory: {
      state: 'review',
      dueAt: '2026-08-29T08:00:00Z',
      lastReviewedAt: '2026-08-22T08:00:00Z',
      isDue: false,
    },
    competence: mockCompetence,
    remainingDueCount: 0,
    feedback: 'Đã ghi nhận kết quả ôn tập.',
  },
  meta: mockResponseMeta,
} as const satisfies ReviewAnswerResponseDto;

export const mockTodayPlan = {
  id: MOCK_IDS.plan,
  languageProfileId: MOCK_IDS.languageProfile,
  planDate: '2026-08-22',
  timeZone: 'Asia/Ho_Chi_Minh',
  targetMinutes: 25,
  completedMinutes: 0,
  status: 'active',
  engineVersion: 'today-v1',
  activities: [
    {
      id: MOCK_IDS.activityReview,
      position: 0,
      activityType: 'review',
      title: '1. Ôn tập thông minh (FSRS)',
      description: 'Ôn các khái niệm đang đến hạn.',
      estimatedMinutes: 8,
      reasonCodes: ['FSRS_DUE'],
      reasonText: 'Lý do: Thuật toán FSRS phát hiện 23 từ sắp rơi khỏi vùng ghi nhớ dài hạn.',
      status: 'pending',
      targetCount: 23,
      completedCount: 0,
      reviewItemId: MOCK_IDS.reviewItem,
      createdAt: '2026-08-22T00:00:00Z',
    },
    {
      id: MOCK_IDS.activityRead,
      position: 1,
      activityType: 'read',
      title: '2. Đọc bài: An Unexpected Morning',
      description: 'Bài đọc phù hợp với vốn từ hiện tại.',
      estimatedMinutes: 10,
      reasonCodes: ['CONTENT_FIT', 'NEW_CONCEPT_BUDGET'],
      reasonText: 'Lý do: 96% từ vựng quen thuộc; nội dung phù hợp với bằng chứng học hiện tại.',
      status: 'pending',
      contentId: MOCK_IDS.content,
      completedCount: 0,
      createdAt: '2026-08-22T00:00:00Z',
    },
    {
      id: MOCK_IDS.activityListen,
      position: 2,
      activityType: 'listen',
      title: '3. Luyện phản xạ nghe câu',
      description: 'Củng cố bằng chứng nghe còn yếu.',
      estimatedMinutes: 4,
      reasonCodes: ['WEAK_LISTENING'],
      reasonText: 'Lý do: Tín hiệu nghe hiện còn yếu hơn nhận diện khi đọc.',
      status: 'pending',
      targetCount: 6,
      completedCount: 0,
      createdAt: '2026-08-22T00:00:00Z',
    },
    {
      id: MOCK_IDS.activityLearn,
      position: 3,
      activityType: 'learn',
      title: '4. Khám phá 4 từ mới',
      description: 'Khám phá khái niệm mới trong ngân sách của kế hoạch.',
      estimatedMinutes: 3,
      reasonCodes: ['NEW_CONCEPT_BUDGET'],
      reasonText: 'Lý do: Có chỗ cho khái niệm mới trong ngân sách của kế hoạch.',
      status: 'pending',
      targetCount: 4,
      completedCount: 0,
      createdAt: '2026-08-22T00:00:00Z',
    },
  ],
  createdAt: '2026-08-22T00:00:00Z',
  updatedAt: '2026-08-22T00:00:00Z',
} as const;

export const mockTodayPlanResponse = {
  data: mockTodayPlan,
  meta: mockResponseMeta,
} as const satisfies TodayPlanResponseDto;

const mockCompletedActivity = {
  ...mockTodayPlan.activities[0],
  status: 'completed',
  completedCount: 23,
  completedAt: '2026-08-22T08:10:00Z',
} as const;

const mockCompletedPlan = {
  ...mockTodayPlan,
  completedMinutes: 8,
  activities: [mockCompletedActivity, ...mockTodayPlan.activities.slice(1)],
  updatedAt: '2026-08-22T08:10:00Z',
} as const;

export const mockTodayCompletionResponse = {
  data: { plan: mockCompletedPlan, activity: mockCompletedActivity },
  meta: mockResponseMeta,
} as const satisfies TodayCompletionResponseDto;

export const mockReaderSentence = {
  id: MOCK_IDS.sentence,
  text: 'I would like to make an appointment tomorrow if he is available.',
  translation: 'Tôi muốn đặt một cuộc hẹn vào ngày mai nếu ông ấy rảnh.',
  order: 0,
  concepts: [
    {
      conceptId: MOCK_IDS.conceptAppointment,
      canonicalForm: 'appointment',
      startOffset: 24,
      endOffset: 35,
      status: 'learning',
    },
    {
      conceptId: MOCK_IDS.conceptAvailable,
      canonicalForm: 'available',
      startOffset: 54,
      endOffset: 63,
      status: 'weak',
    },
  ],
} as const;

export const mockReaderAnalyzeResponse = {
  data: {
    analysisId: MOCK_IDS.analysis,
    targetLanguageCode: 'en',
    translationLanguageCode: 'vi',
    segments: [
      {
        id: MOCK_IDS.segment,
        order: 0,
        text: mockReaderSentence.text,
        sentences: [mockReaderSentence],
      },
    ],
    analyzedAt: '2026-08-22T03:00:00Z',
  },
  meta: mockResponseMeta,
} as const satisfies ReaderAnalyzeResponseDto;

export const mockReaderExposureResponse = {
  data: {
    exposureId: MOCK_IDS.analysis,
    contentId: MOCK_IDS.content,
    segmentId: MOCK_IDS.segment,
    exposureType: 'read',
    acceptedConceptCount: 2,
    occurredAt: '2026-08-22T03:00:00Z',
    recordedAt: '2026-08-22T03:00:01Z',
  },
  meta: mockResponseMeta,
} as const satisfies ReaderExposureResponseDto;

export const mockReadingProgressResponse = {
  data: {
    contentId: MOCK_IDS.content,
    currentSegmentId: MOCK_IDS.segment,
    furthestSegmentId: MOCK_IDS.segment,
    progressPercent: 0,
    isCompleted: false,
    startedAt: '2026-08-22T03:00:00Z',
    lastOpenedAt: '2026-08-22T03:00:00Z',
  },
  meta: mockResponseMeta,
} as const satisfies ReadingProgressResponseDto;

export const mockContentSummary = {
  id: MOCK_IDS.content,
  contentType: 'article',
  title: 'Making an Appointment',
  subtitle: 'A practical A2 conversation',
  excerpt: 'Learn how to arrange a convenient meeting time.',
  targetLanguageCode: 'en',
  difficultyScore: 0.38,
  difficultyLabel: 'A2',
  knownConceptRatio: 0.96,
  estimatedMinutes: 10,
  fitReason: 'Phù hợp với vốn từ hiện tại.',
  isSaved: true,
  attribution: {
    sourceName: 'LINGUA OS curated content',
    licenseCode: 'LicenseRef-LINGUA-Private',
    attributionText: 'Curated development fixture.',
  },
} as const;

export const mockContentRecommendationsResponse = {
  data: [mockContentSummary],
  meta: { ...mockCursorMeta, pageSize: 1 },
} as const satisfies ContentRecommendationsResponseDto;

export const mockContentResponse = {
  data: {
    summary: mockContentSummary,
    totalWords: 180,
    segments: [
      {
        id: MOCK_IDS.segment,
        order: 0,
        segmentType: 'paragraph',
        text: mockReaderSentence.text,
        sentences: [mockReaderSentence],
      },
    ],
  },
  meta: mockResponseMeta,
} as const satisfies ContentResponseDto;

export const mockLibraryItemsResponse = {
  data: [
    { itemType: 'content', savedAt: '2026-08-22T03:00:00Z', content: mockContentSummary },
    { itemType: 'concept', savedAt: '2026-08-22T03:00:00Z', concept: mockConceptSummary },
    { itemType: 'sentence', savedAt: '2026-08-22T03:00:00Z', sentence: mockReaderSentence },
  ],
  meta: { ...mockCursorMeta, pageSize: 3 },
} as const satisfies LibraryItemsResponseDto;

export const mockLibraryMutationResponse = {
  data: { id: MOCK_IDS.conceptAppointment, itemType: 'concept', isSaved: true, savedAt: '2026-08-22T03:00:00Z' },
  meta: mockResponseMeta,
} as const satisfies LibraryMutationResponseDto;

export const mockAssessmentItemVocabulary = {
  id: MOCK_IDS.assessmentItem,
  skill: 'recognition',
  domain: 'vocabulary_recognition',
  prompt: 'Chọn nghĩa phù hợp nhất của “appointment”.',
  options: [
    { id: '00000000-0000-4000-8000-000000000015', text: 'Cuộc hẹn' },
    { id: '00000000-0000-4000-8000-000000000016', text: 'Lịch trình' },
    { id: '00000000-0000-4000-8000-000000000027', text: 'Tiện lợi' },
    { id: '00000000-0000-4000-8000-000000000028', text: 'Do dự' },
  ],
  allowSkip: true,
} as const satisfies AssessmentItemDto;

export const mockAssessmentItemGrammar = {
  id: '00000000-0000-4000-8000-000000000029',
  skill: 'recognition',
  domain: 'grammar_in_context',
  prompt: 'Chọn dạng đúng của động từ: “She has _______ in Hanoi for three years.”',
  textSnippet: 'She has _______ in Hanoi for three years.',
  options: [
    { id: '00000000-0000-4000-8000-000000000030', text: 'lived' },
    { id: '00000000-0000-4000-8000-000000000031', text: 'live' },
    { id: '00000000-0000-4000-8000-000000000032', text: 'living' },
    { id: '00000000-0000-4000-8000-000000000033', text: 'was live' },
  ],
  allowSkip: true,
} as const satisfies AssessmentItemDto;

export const mockAssessmentItemReading = {
  id: '00000000-0000-4000-8000-000000000034',
  skill: 'recognition',
  domain: 'reading_comprehension',
  prompt: 'Theo đoạn văn, tại sao người nói cần dời lịch hẹn?',
  textSnippet: 'I would like to reschedule my dentist appointment because of an urgent flight tomorrow morning.',
  options: [
    { id: '00000000-0000-4000-8000-000000000035', text: 'Vì có chuyến bay đột xuất vào sáng mai' },
    { id: '00000000-0000-4000-8000-000000000036', text: 'Vì phòng khám nha khoa đóng cửa' },
    { id: '00000000-0000-4000-8000-000000000037', text: 'Vì đã khỏi bệnh đau răng' },
    { id: '00000000-0000-4000-8000-000000000038', text: 'Vì quên ngày hẹn ban đầu' },
  ],
  allowSkip: true,
} as const satisfies AssessmentItemDto;

export const mockAssessmentItemListening = {
  id: '00000000-0000-4000-8000-000000000039',
  skill: 'listening',
  domain: 'listening_comprehension',
  prompt: 'Nghe đoạn audio và chọn câu trả lời đúng cho câu hỏi: “Thời gian cuộc họp bắt đầu khi nào?”',
  audioUrl: 'https://assets.lingua-os.dev/audio/assessment/diag-listening-01.mp3',
  options: [
    { id: '00000000-0000-4000-8000-000000000040', text: '9:30 sáng' },
    { id: '00000000-0000-4000-8000-000000000041', text: '10:00 sáng' },
    { id: '00000000-0000-4000-8000-000000000042', text: '2:00 chiều' },
    { id: '00000000-0000-4000-8000-000000000043', text: '4:15 chiều' },
  ],
  allowSkip: true,
} as const satisfies AssessmentItemDto;

export const mockAssessmentSessionResponse = {
  data: {
    id: MOCK_IDS.assessment,
    languageProfileId: MOCK_IDS.languageProfile,
    status: 'in_progress',
    methodVersion: 'starting-level-heuristic-v1',
    progress: { answeredCount: 0, minimumItemCount: 8, maximumItemCount: 16 },
    currentItem: mockAssessmentItemVocabulary,
    result: null,
    startedAt: '2026-08-22T03:00:00Z',
    updatedAt: '2026-08-22T03:00:00Z',
    completedAt: null,
  },
  meta: mockResponseMeta,
} as const satisfies AssessmentSessionResponseDto;

export const mockCompletedAssessmentSessionResponse = {
  data: {
    id: MOCK_IDS.assessment,
    languageProfileId: MOCK_IDS.languageProfile,
    status: 'completed',
    methodVersion: 'starting-level-heuristic-v1',
    progress: { answeredCount: 12, minimumItemCount: 8, maximumItemCount: 16 },
    currentItem: null,
    result: startingLevelEstimate,
    startedAt: '2026-08-22T03:00:00Z',
    updatedAt: '2026-08-22T03:15:00Z',
    completedAt: '2026-08-22T03:15:00Z',
  },
  meta: mockResponseMeta,
} as const satisfies AssessmentSessionResponseDto;


export const mockZeroEvidenceCompetence = {
  recognition: { score: 0.5, confidence: 0, evidenceCount: 0, updatedAt: '2026-08-22T03:00:00Z' },
  listening: { score: 0.5, confidence: 0, evidenceCount: 0, updatedAt: '2026-08-22T03:00:00Z' },
  production: { score: 0.5, confidence: 0, evidenceCount: 0, updatedAt: '2026-08-22T03:00:00Z' },
} as const satisfies CompetenceSignalsDto;

export const mockBrainConceptSummary = {
  concept: mockConceptSummary,
  competence: mockCompetence,
  mastery: 0.62,
  confidence: 0.72,
  memory: mockMemorySnapshot,
  exposureCount: 14,
  lastSeenAt: '2026-08-21T03:00:00Z',
} as const satisfies BrainConceptSummaryDto;

export const mockZeroEvidenceBrainConceptSummary = {
  concept: mockSkillConceptSummary,
  competence: mockZeroEvidenceCompetence,
  mastery: null,
  confidence: 0,
  exposureCount: 0,
} as const satisfies BrainConceptSummaryDto;

const additionalBrainMasteryValues = [
  { mastery: 0.35, confidence: 0.65 },
  { mastery: 0.58, confidence: 0.70 },
  { mastery: 0.60, confidence: 0.75 },
  { mastery: 0.75, confidence: 0.80 },
  { mastery: 0.82, confidence: 0.85 },
] as const;

export const mockAdditionalBrainConceptSummaries = [
  ...[mockSecondConceptSummary, ...mockAdditionalConceptSummaries].map((concept, index) => ({
    concept,
    competence: mockCompetence,
    mastery: additionalBrainMasteryValues[index]?.mastery ?? 0.5,
    confidence: additionalBrainMasteryValues[index]?.confidence ?? 0.6,
    memory: { ...mockMemorySnapshot, isDue: concept.isDue },
    exposureCount: 8 + index,
    lastSeenAt: '2026-08-21T03:00:00Z',
  })),
] as const satisfies readonly BrainConceptSummaryDto[];


export const mockBrainSummaryResponse = {
  data: {
    languageProfileId: MOCK_IDS.languageProfile,
    statusCounts: {
      total: 582, unseen: 0, discovered: 0, learning: 43, familiar: 18,
      active: 10, mastered: 483, weak: 28, forgotten: 0,
    },
    dueCount: 23,
    memoryHealth: null,
    competence: mockCompetence,
    startingLevelEstimate,
    recentConcepts: [mockBrainConceptSummary, ...mockAdditionalBrainConceptSummaries],
    calculatedAt: '2026-08-22T03:00:00Z',
  },
  meta: mockResponseMeta,
} as const satisfies BrainSummaryResponseDto;

export const mockBrainConceptListResponse = {
  data: [mockBrainConceptSummary, ...mockAdditionalBrainConceptSummaries],
  meta: { ...mockCursorMeta, pageSize: 6 },
} as const satisfies BrainConceptListResponseDto;

export const mockBrainConceptResponse = {
  data: {
    concept: mockConceptDetail,
    status: 'learning',
    competence: mockCompetence,
    mastery: 0.62,
    confidence: 0.72,
    memory: mockMemorySnapshot,
    evidence: {
      exposureCount: 14,
      reviewCount: 5,
      lastSeenAt: '2026-08-21T03:00:00Z',
      lastReviewedAt: '2026-08-17T08:00:00Z',
    },
  },
  meta: mockResponseMeta,
} as const satisfies BrainConceptResponseDto;

export const mockZeroEvidenceBrainConceptResponse = {
  data: {
    concept: {
      ...mockConceptDetail,
      id: MOCK_IDS.conceptListeningForGist,
      canonicalForm: 'listening-for-gist',
      learner: {
        status: 'discovered',
        isDue: false,
        exposureCount: 0,
        memory: mockMemorySnapshot,
        competence: mockZeroEvidenceCompetence,
      },
    },
    status: 'discovered',
    competence: mockZeroEvidenceCompetence,
    mastery: null,
    confidence: 0,
    memory: null,
    evidence: {
      exposureCount: 0,
      reviewCount: 0,
    },
  },
  meta: mockResponseMeta,
} as const satisfies BrainConceptResponseDto;


export const mockProgressOverviewResponse = {
  data: {
    languageProfileId: MOCK_IDS.languageProfile,
    windowStart: '2026-08-16',
    windowEnd: '2026-08-22',
    startingLevelEstimate,
    memoryHealth: 0.87,
    competence: mockCompetence,
    successfulLearningDays: 5,
    targetLearningDays: 7,
    conceptsExposed: 14,
    conceptsStrengthened: 26,
    totalMinutes: 115,
    dailyActivity: [
      { date: '2026-08-16', minutes: 25, activitiesCompleted: 4, goalMet: true, conceptsExposed: 3, conceptsStrengthened: 5 },
      { date: '2026-08-17', minutes: 20, activitiesCompleted: 3, goalMet: true, conceptsExposed: 2, conceptsStrengthened: 4 },
    ],
    retentionTrend: [
      { date: '2026-08-16', successfulReviewRatio: 0.84, reviewedCount: 18 },
      { date: '2026-08-17', successfulReviewRatio: 0.87, reviewedCount: 20 },
    ],
    calculatedAt: '2026-08-22T03:00:00Z',
  },
  meta: mockResponseMeta,
} as const satisfies ProgressOverviewResponseDto;

export const mockApiResponses = Object.freeze({
  me: mockMeResponse,
  languageProfiles: mockLanguageProfilesResponse,
  languageProfile: mockLanguageProfileResponse,
  today: mockTodayPlanResponse,
  todayCompletion: mockTodayCompletionResponse,
  reviewQueue: mockReviewQueueResponse,
  reviewAnswer: mockReviewAnswerResponse,
  concept: mockConceptResponse,
  dictionary: mockDictionarySearchResponse,
  readerAnalysis: mockReaderAnalyzeResponse,
  readerExposure: mockReaderExposureResponse,
  readingProgress: mockReadingProgressResponse,
  recommendations: mockContentRecommendationsResponse,
  content: mockContentResponse,
  library: mockLibraryItemsResponse,
  libraryMutation: mockLibraryMutationResponse,
  assessment: mockAssessmentSessionResponse,
  brainSummary: mockBrainSummaryResponse,
  brainConcepts: mockBrainConceptListResponse,
  brainConcept: mockBrainConceptResponse,
  progress: mockProgressOverviewResponse,
});
