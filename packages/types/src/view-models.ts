/** Presentation-only models. These are intentionally not API DTOs. */
import type { CEFRLevel } from './enums';
import type { ApiErrorCode, ConceptStatus, LearningActivityType, ReviewExerciseMode } from './api/dtos';

export interface TodayActivityViewModel {
  readonly id: string;
  readonly type: LearningActivityType;
  readonly title: string;
  readonly durationMinutes: number;
  readonly badgeLabel: string;
  readonly badgeVariant: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  readonly reasonText: string;
  readonly targetUrl: string;
  readonly completed: boolean;
}

export interface ReviewCardViewModel {
  readonly id: string;
  readonly conceptId: string;
  readonly term: string;
  readonly ipa: string;
  readonly pos?: string;
  readonly prompt: string;
  readonly meaningVi: string;
  readonly contextSentence: string;
  readonly contextTranslationVi: string;
  readonly status: ConceptStatus;
  readonly isDue: boolean;
  readonly dueText: string;
  readonly exerciseMode: ReviewExerciseMode;
}

export interface ReaderTokenViewModel {
  readonly raw: string;
  readonly isLookupable?: boolean;
  readonly lemma?: string;
  readonly isTarget?: boolean;
  readonly conceptId?: string;
  readonly segmentId?: string;
  readonly sentenceId?: string;
  readonly startOffset?: number;
  readonly endOffset?: number;
  readonly status?: ConceptStatus;
  readonly ipa?: string;
  readonly pos?: string;
  readonly translationVi?: string;
  readonly explanationEn?: string;
}

export interface ReaderLookupViewModel {
  readonly surface: string;
  readonly matchStatus: 'found' | 'not_found';
  readonly entries: readonly Readonly<{
    matchedSurface: string;
    partOfSpeech?: string;
    formOf?: string;
    senses: readonly Readonly<{ senseOrder: number; glossVi: string }>[];
    attributions: readonly Readonly<{
      sourceName: string;
      sourceUrl: string;
      licenseCode: string;
      licenseUrl: string;
      attributionText: string;
      changeNotice?: string;
    }>[];
  }>[];
}

export interface ReaderSentenceViewModel {
  readonly id: string;
  readonly order: number;
  readonly segmentId: string;
  readonly text: string;
  readonly tokens: readonly ReaderTokenViewModel[];
  readonly translationVi: string;
  readonly audioUrl?: string;
  readonly targetConcepts: readonly { term: string; status: ConceptStatus }[];
}

export interface ReaderSegmentViewModel {
  readonly id: string;
  readonly order: number;
  readonly text: string;
  readonly sentences: readonly ReaderSentenceViewModel[];
}

export interface ReaderProgressViewModel {
  readonly currentSegmentId: string;
  readonly furthestSegmentId: string;
  readonly progressPercent: number;
  readonly isCompleted: boolean;
}

export interface ReaderAttributionViewModel {
  readonly sourceName: string;
  readonly licenseCode: string;
  readonly attributionText: string;
  readonly sourceUrl?: string;
}

export interface ReaderPassageViewModel {
  readonly id: string;
  readonly title: string;
  readonly level: string;
  readonly wordCount: number;
  readonly familiarityRate: number;
  readonly isSaved: boolean;
  readonly audioUrl?: string;
  readonly segments: readonly ReaderSegmentViewModel[];
  readonly sentences: readonly ReaderSentenceViewModel[];
  readonly progress?: ReaderProgressViewModel;
  readonly attribution?: ReaderAttributionViewModel;
}

interface LibraryItemBaseViewModel {
  readonly id: string;
  readonly savedAt: string;
}

export interface LibraryConceptItemViewModel extends LibraryItemBaseViewModel {
  readonly itemType: 'concept';
  readonly canonicalForm: string;
  readonly partOfSpeech?: string;
  readonly ipa?: string;
  readonly level?: string;
  readonly status: ConceptStatus;
  readonly isDue: boolean;
}

export interface LibrarySentenceItemViewModel extends LibraryItemBaseViewModel {
  readonly itemType: 'sentence';
  readonly text: string;
  readonly translation?: string;
  readonly audioUrl?: string;
}

export interface LibraryContentItemViewModel extends LibraryItemBaseViewModel {
  readonly itemType: 'content';
  readonly title: string;
  readonly excerpt?: string;
  readonly level?: string;
  readonly estimatedMinutes: number;
  readonly knownConceptPercent: number;
  readonly attribution?: ReaderAttributionViewModel;
  readonly progressPercent?: number;
}

export type LibraryItemViewModel =
  | LibraryConceptItemViewModel
  | LibrarySentenceItemViewModel
  | LibraryContentItemViewModel;

export interface DictionaryConceptViewModel {
  readonly id: string;
  readonly term: string;
  readonly lemma: string;
  readonly pos?: string;
  readonly ipa: string;
  readonly cefrLevel: string;
  readonly status: ConceptStatus;
  readonly isDue: boolean;
  readonly primaryTranslationVi: string;
  readonly definitions: readonly {
    meaningVi: string;
    explanationEn?: string;
    examples?: readonly { source: string; target: string }[];
  }[];
}

export interface BrainConceptViewModel {
  readonly id: string;
  readonly label: string;
  readonly lemma: string;
  readonly pos?: string;
  readonly ipa: string;
  readonly translationVi: string;
  /** Optional because non-lexical concepts may not have a proficiency level. */
  readonly cefr?: string;
  readonly status: ConceptStatus;
  readonly isDue: boolean;
  readonly groupLabel: string;
  /** Authoritative nullable aggregate; null means the server has no eligible evidence yet. */
  readonly mastery: number | null;
  /** Authoritative confidence aggregate, kept distinct from mastery and dimension confidence. */
  readonly confidence: number;
  readonly exposureCount: number;
  readonly recognitionScore: number;
  readonly recognitionConfidence: number;
  readonly recognitionEvidenceCount: number;
  readonly listeningScore: number;
  readonly listeningConfidence: number;
  readonly listeningEvidenceCount: number;
  readonly productionScore: number;
  readonly productionConfidence: number;
  readonly productionEvidenceCount: number;
  readonly grammar?: Readonly<{
    patternFormula: string;
    syntacticCategory: string;
    pragmaticFunction: string;
    vietnameseExplanation: string;
    vietnameseCommonTraps?: string;
    structuralSlots: readonly Readonly<{
      label: string;
      role: string;
      required: boolean;
      examples: readonly string[];
    }>[];
  }>;
}

export interface BrainCompetenceViewModel {
  readonly score: number;
  readonly confidence: number;
  readonly evidenceCount: number;
}

export interface BrainSummaryViewModel {
  readonly languageProfileId: string;
  readonly statusCounts: Readonly<Record<ConceptStatus, number>>;
  readonly dueCount: number;
  readonly memoryHealth: number | null;
  readonly competence: Readonly<{
    recognition: BrainCompetenceViewModel;
    listening: BrainCompetenceViewModel;
    production: BrainCompetenceViewModel;
  }>;
}

export interface ProgressSummaryViewModel {
  readonly retentionScore: number;
  readonly activeDaysCount: number;
  readonly weeklyTargetDays: number;
  readonly totalStudyMinutes: number;
  readonly newWordsAcquired: number;
  readonly wordsSolidified: number;
  readonly history7d: readonly { dayLabel: string; retentionPercent: number; minutesSpent: number }[];
}

export interface UserProfileViewModel {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly timeZone: string | null;
  readonly startingLevelEstimate: string;
  readonly startingLevelConfidence: string;
  readonly targetGoal: string;
  readonly totalConceptsEncountered: number;
  readonly totalConceptsMastered: number;
  readonly streakDays: number;
  readonly memberSince: string;
}

export interface ErrorViewModel {
  readonly code: ApiErrorCode | 'NETWORK_ERROR';
  readonly message: string;
  readonly retryable: boolean;
}
