/** Pure DTO-to-presentation mappings. No scheduling, recommendation, placement, or mastery logic. */
import type {
  AssessmentSessionDto,
  BrainConceptSummaryDto,
  BrainConceptDetailDto,
  BrainSummaryDto,
  ConceptDetailDto,
  ContentDetailDto,
  MeProfileDto,
  LanguageProfileDto,
  StartingLevelEstimateDto,
  ProgressOverviewDto,
  ReviewQueueItemDto,
  TodayActivityDto,
  ConfidenceBand,
} from '../api/dtos';
import type { CEFRLevel } from '../enums';
import type {
  BrainConceptViewModel,
  BrainSummaryViewModel,
  DictionaryConceptViewModel,
  ProgressSummaryViewModel,
  ReaderPassageViewModel,
  ReaderTokenViewModel,
  ReviewCardViewModel,
  TodayActivityViewModel,
  UserProfileViewModel,
} from '../view-models';

const activityRoutes = {
  review: '/review',
  read: '/read',
  listen: '/read',
  learn: '/dictionary',
} as const;

function percent(value: number): number {
  return Math.round(value * 100);
}

export function mapTodayActivityToViewModel(activity: TodayActivityDto): TodayActivityViewModel {
  const isComplete = activity.status === 'completed';
  const badgeLabel = activity.activityType === 'review' && activity.targetCount
    ? `${activity.targetCount} từ đến hạn`
    : activity.activityType === 'learn' && activity.targetCount
      ? `${activity.targetCount} từ mới`
      : activity.reasonCodes.includes('WEAK_LISTENING')
        ? 'Củng cố nghe'
        : activity.reasonCodes.includes('CONTENT_FIT')
          ? 'Nội dung phù hợp'
          : 'Hoạt động hôm nay';

  return {
    id: activity.id,
    type: activity.activityType,
    title: activity.title,
    durationMinutes: activity.estimatedMinutes,
    badgeLabel,
    badgeVariant: isComplete ? 'success' : activity.reasonCodes.includes('FSRS_DUE') ? 'warning' : 'primary',
    reasonText: activity.reasonText,
    targetUrl: activityRoutes[activity.activityType],
    completed: isComplete,
  };
}

export function mapReviewItemToViewModel(item: ReviewQueueItemDto): ReviewCardViewModel {
  return {
    id: item.reviewItemId,
    conceptId: item.concept.id,
    term: item.concept.canonicalForm,
    ipa: item.concept.ipa ?? '',
    ...(item.concept.partOfSpeech ? { pos: item.concept.partOfSpeech } : {}),
    prompt: item.prompt.promptText,
    meaningVi: item.prompt.promptText,
    contextSentence: item.prompt.contextSentence ?? '',
    contextTranslationVi: item.prompt.translation ?? '',
    status: item.concept.status,
    isDue: item.memory.isDue,
    dueText: item.memory.isDue ? 'Đến hạn ôn' : 'Chưa đến hạn',
    exerciseMode: item.exerciseMode,
  };
}

export function mapConceptDetailToDictionaryViewModel(
  concept: ConceptDetailDto
): DictionaryConceptViewModel {
  const partOfSpeechLabels: Readonly<Record<string, string>> = {
    noun: 'Danh từ', verb: 'Động từ', adjective: 'Tính từ', adverb: 'Trạng từ',
  };
  const partOfSpeech = concept.partOfSpeech
    ? (partOfSpeechLabels[concept.partOfSpeech] ?? concept.partOfSpeech)
    : undefined;
  return {
    id: concept.id,
    term: concept.canonicalForm,
    lemma: concept.canonicalForm,
    ...(partOfSpeech ? { pos: partOfSpeech } : {}),
    ipa: concept.ipa ?? '',
    cefrLevel: concept.level?.code ?? '—',
    status: concept.learner.status,
    isDue: concept.learner.isDue,
    primaryTranslationVi: concept.definitions[0]?.translation ?? concept.definitions[0]?.definition ?? '',
    definitions: concept.definitions.map((definition) => ({
      meaningVi: definition.translation ?? definition.definition,
      explanationEn: definition.definition,
      examples: concept.examples.map((example) => ({
        source: example.text,
        target: example.translation ?? '',
      })),
    })),
  };
}

export function mapBrainConceptToViewModel(
  item: BrainConceptSummaryDto,
  translationVi = ''
): BrainConceptViewModel {
  return {
    id: item.concept.id,
    label: item.concept.canonicalForm,
    lemma: item.concept.canonicalForm,
    ...(item.concept.partOfSpeech ? { pos: item.concept.partOfSpeech } : {}),
    ipa: item.concept.ipa ?? '',
    translationVi,
    ...(item.concept.level ? { cefr: item.concept.level.code } : {}),
    status: item.concept.status,
    isDue: item.concept.isDue,
    groupLabel: 'Khái niệm gần đây',
    mastery: item.mastery,
    confidence: item.confidence,
    exposureCount: item.exposureCount,
    recognitionScore: percent(item.competence.recognition.score),
    recognitionConfidence: percent(item.competence.recognition.confidence),
    recognitionEvidenceCount: item.competence.recognition.evidenceCount,
    listeningScore: percent(item.competence.listening.score),
    listeningConfidence: percent(item.competence.listening.confidence),
    listeningEvidenceCount: item.competence.listening.evidenceCount,
    productionScore: percent(item.competence.production.score),
    productionConfidence: percent(item.competence.production.confidence),
    productionEvidenceCount: item.competence.production.evidenceCount,
  };
}

export function mapBrainSummaryToViewModel(summary: BrainSummaryDto): BrainSummaryViewModel {
  return {
    languageProfileId: summary.languageProfileId,
    statusCounts: { ...summary.statusCounts },
    dueCount: summary.dueCount,
    memoryHealth: summary.memoryHealth,
    competence: {
      recognition: {
        score: summary.competence.recognition.score,
        confidence: summary.competence.recognition.confidence,
        evidenceCount: summary.competence.recognition.evidenceCount,
      },
      listening: {
        score: summary.competence.listening.score,
        confidence: summary.competence.listening.confidence,
        evidenceCount: summary.competence.listening.evidenceCount,
      },
      production: {
        score: summary.competence.production.score,
        confidence: summary.competence.production.confidence,
        evidenceCount: summary.competence.production.evidenceCount,
      },
    },
  };
}

export function mapBrainConceptDetailToViewModel(
  item: BrainConceptDetailDto,
  translationVi = ''
): BrainConceptViewModel {
  const { concept } = item;
  return {
    id: concept.id,
    label: concept.canonicalForm,
    lemma: concept.canonicalForm,
    ...(concept.partOfSpeech ? { pos: concept.partOfSpeech } : {}),
    ipa: concept.ipa ?? '',
    translationVi: translationVi || (concept.definitions[0]?.translation ?? concept.definitions[0]?.definition ?? ''),
    ...(concept.level ? { cefr: concept.level.code } : {}),
    status: item.status,
    isDue: concept.learner.isDue,
    groupLabel: 'Chi tiết khái niệm',
    mastery: item.mastery,
    confidence: item.confidence,
    exposureCount: item.evidence.exposureCount,
    recognitionScore: percent(item.competence.recognition.score),
    recognitionConfidence: percent(item.competence.recognition.confidence),
    recognitionEvidenceCount: item.competence.recognition.evidenceCount,
    listeningScore: percent(item.competence.listening.score),
    listeningConfidence: percent(item.competence.listening.confidence),
    listeningEvidenceCount: item.competence.listening.evidenceCount,
    productionScore: percent(item.competence.production.score),
    productionConfidence: percent(item.competence.production.confidence),
    productionEvidenceCount: item.competence.production.evidenceCount,
  };
}

function tokensForSentence(
  sentence: ContentDetailDto['segments'][number]['sentences'][number],
  segmentId: string,
  conceptDetails: ReadonlyMap<string, ConceptDetailDto>
): readonly ReaderTokenViewModel[] {
  const annotations = [...sentence.concepts].sort((left, right) => left.startOffset - right.startOffset);
  const tokens: ReaderTokenViewModel[] = [];
  let cursor = 0;

  for (const annotation of annotations) {
    if (annotation.startOffset > cursor) tokens.push({ raw: sentence.text.slice(cursor, annotation.startOffset) });
    const detail = conceptDetails.get(annotation.conceptId);
    tokens.push({
      raw: sentence.text.slice(annotation.startOffset, annotation.endOffset),
      lemma: annotation.canonicalForm,
      isTarget: true,
      conceptId: annotation.conceptId,
      segmentId,
      sentenceId: sentence.id,
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
      status: annotation.status,
      ...(detail?.ipa ? { ipa: detail.ipa } : {}),
      ...(detail?.partOfSpeech ? { pos: detail.partOfSpeech } : {}),
      translationVi: detail?.definitions[0]?.translation,
      explanationEn: detail?.definitions[0]?.definition,
    });
    cursor = annotation.endOffset;
  }
  if (cursor < sentence.text.length) tokens.push({ raw: sentence.text.slice(cursor) });
  return tokens;
}

export function mapContentToReaderPassage(
  content: ContentDetailDto,
  concepts: readonly ConceptDetailDto[] = []
): ReaderPassageViewModel {
  const details = new Map(concepts.map((concept) => [concept.id, concept]));
  const segments = content.segments.map((segment) => ({
    id: segment.id,
    order: segment.order,
    text: segment.text,
    sentences: segment.sentences.map((sentence) => ({
      id: sentence.id,
      order: sentence.order,
      segmentId: segment.id,
      text: sentence.text,
      tokens: tokensForSentence(sentence, segment.id, details),
      translationVi: sentence.translation ?? '',
      ...(sentence.audioUrl ? { audioUrl: sentence.audioUrl } : {}),
      targetConcepts: sentence.concepts.map((concept) => ({
        term: concept.canonicalForm,
        status: concept.status,
      })),
    })),
  }));
  const sentences = segments.flatMap((segment) => segment.sentences);
  return {
    id: content.summary.id,
    title: content.summary.title,
    level: content.summary.difficultyLabel ?? 'Phù hợp',
    wordCount: content.totalWords,
    familiarityRate: percent(content.summary.knownConceptRatio),
    isSaved: content.summary.isSaved,
    ...(content.audioUrl ? { audioUrl: content.audioUrl } : {}),
    segments,
    sentences,
    ...(content.summary.readingProgress ? {
      progress: {
        currentSegmentId: content.summary.readingProgress.currentSegmentId,
        furthestSegmentId: content.summary.readingProgress.furthestSegmentId,
        progressPercent: content.summary.readingProgress.progressPercent,
        isCompleted: content.summary.readingProgress.isCompleted,
      },
    } : {}),
    ...(content.summary.attribution ? { attribution: content.summary.attribution } : {}),
  };
}

const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export function mapProgressToViewModel(progress: ProgressOverviewDto): ProgressSummaryViewModel {
  return {
    retentionScore: percent(progress.memoryHealth),
    activeDaysCount: progress.successfulLearningDays,
    weeklyTargetDays: progress.targetLearningDays,
    totalStudyMinutes: progress.totalMinutes,
    newWordsAcquired: progress.conceptsExposed,
    wordsSolidified: progress.conceptsStrengthened,
    history7d: progress.dailyActivity.map((day, index) => ({
      dayLabel: weekdayLabels[new Date(`${day.date}T00:00:00Z`).getUTCDay()] ?? `N${index + 1}`,
      retentionPercent: percent(progress.retentionTrend[index]?.successfulReviewRatio ?? progress.memoryHealth),
      minutesSpent: day.minutes,
    })),
  };
}

const goalLabels = {
  communication: 'Giao tiếp', work: 'Công việc', travel: 'Du lịch', basics: 'Nền tảng', academic: 'Học thuật',
} as const;
const confidenceLabels = { low: 'Thấp', medium: 'Vừa', high: 'Cao' } as const;

export function mapProfileToViewModel(
  profile: MeProfileDto,
  brain: BrainSummaryDto,
  progress: ProgressOverviewDto
): UserProfileViewModel {
  const language = profile.languageProfiles.find((item) => item.status === 'active') ?? profile.languageProfiles[0];
  const estimate = language?.startingLevelEstimate;
  return {
    id: profile.id,
    name: profile.displayName,
    email: profile.email,
    timeZone: profile.timeZone,
    startingLevelEstimate: estimate ? `${estimate.level.code} ${estimate.level.label}` : 'Chưa ước lượng',
    startingLevelConfidence: estimate ? confidenceLabels[estimate.confidenceBand] : 'Thấp',
    targetGoal: language ? goalLabels[language.goal] : 'Chưa chọn',
    totalConceptsEncountered: brain.statusCounts.total - brain.statusCounts.unseen,
    totalConceptsMastered: brain.statusCounts.mastered,
    streakDays: progress.successfulLearningDays,
    memberSince: profile.createdAt.slice(0, 10),
  };
}

export interface AssessmentViewModel {
  readonly id: string;
  readonly status: AssessmentSessionDto['status'];
  readonly answeredCount: number;
  readonly currentPrompt?: string;
  readonly estimatedLevel?: string;
  readonly confidence?: ConfidenceBand;
}

/** Onboarding-only presentation models keep transport fields out of React components. */
export interface OnboardingProfileViewModel {
  readonly displayName: string | null;
  readonly timeZone: string | null;
}

export interface OnboardingLanguageProfileViewModel {
  readonly id: string;
  /** Opaque child concurrency token; pass unchanged to If-Match. */
  readonly etag: LanguageProfileDto['etag'];
  readonly nativeLanguageCode: LanguageProfileDto['nativeLanguageCode'];
  readonly targetLanguageCode: LanguageProfileDto['targetLanguageCode'];
  readonly goal: LanguageProfileDto['goal'];
  readonly dailyMinutes: LanguageProfileDto['dailyMinutes'];
  readonly status: LanguageProfileDto['status'];
  readonly startingLevelEstimate: OnboardingEstimateViewModel | null;
}

export type OnboardingEstimateViewModel = Pick<StartingLevelEstimateDto, 'confidenceBand' | 'evidenceCount'> & {
  readonly level: Pick<StartingLevelEstimateDto['level'], 'code' | 'label'>;
};

export interface OnboardingAssessmentOptionViewModel {
  readonly id: string;
  readonly text: string;
}

export interface OnboardingAssessmentItemViewModel {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly OnboardingAssessmentOptionViewModel[];
  readonly allowSkip: boolean;
  readonly textSnippet?: string;
  readonly audioUrl?: string;
}

export interface OnboardingAssessmentViewModel {
  readonly id: AssessmentSessionDto['id'];
  readonly languageProfileId: AssessmentSessionDto['languageProfileId'];
  readonly status: AssessmentSessionDto['status'];
  readonly currentItem: OnboardingAssessmentItemViewModel | null;
  readonly result: OnboardingEstimateViewModel | null;
  readonly answeredCount: AssessmentSessionDto['progress']['answeredCount'];
}

export function mapOnboardingProfileToViewModel(profile: MeProfileDto): OnboardingProfileViewModel {
  return { displayName: profile.displayName, timeZone: profile.timeZone };
}

export function mapOnboardingLanguageProfileToViewModel(profile: LanguageProfileDto): OnboardingLanguageProfileViewModel {
  return {
    id: profile.id,
    etag: profile.etag,
    nativeLanguageCode: profile.nativeLanguageCode,
    targetLanguageCode: profile.targetLanguageCode,
    goal: profile.goal,
    dailyMinutes: profile.dailyMinutes,
    status: profile.status,
    startingLevelEstimate: profile.startingLevelEstimate
      ? {
          level: { code: profile.startingLevelEstimate.level.code, label: profile.startingLevelEstimate.level.label },
          confidenceBand: profile.startingLevelEstimate.confidenceBand,
          evidenceCount: profile.startingLevelEstimate.evidenceCount,
        }
      : null,
  };
}

export function mapOnboardingAssessmentToViewModel(session: AssessmentSessionDto): OnboardingAssessmentViewModel {
  return {
    id: session.id,
    languageProfileId: session.languageProfileId,
    status: session.status,
    currentItem: session.currentItem
      ? {
          id: session.currentItem.id,
          prompt: session.currentItem.prompt,
          options: session.currentItem.options.map((option) => ({ id: option.id, text: option.text })),
          allowSkip: session.currentItem.allowSkip,
          ...(session.currentItem.textSnippet ? { textSnippet: session.currentItem.textSnippet } : {}),
          ...(session.currentItem.audioUrl ? { audioUrl: session.currentItem.audioUrl } : {}),
        }
      : null,
    result: session.result
      ? {
          level: { code: session.result.level.code, label: session.result.level.label },
          confidenceBand: session.result.confidenceBand,
          evidenceCount: session.result.evidenceCount,
        }
      : null,
    answeredCount: session.progress.answeredCount,
  };
}

export function mapAssessmentToViewModel(session: AssessmentSessionDto): AssessmentViewModel {
  return {
    id: session.id,
    status: session.status,
    answeredCount: session.progress.answeredCount,
    currentPrompt: session.currentItem?.prompt,
    estimatedLevel: session.result?.level.code,
    confidence: session.result?.confidenceBand,
  };
}
