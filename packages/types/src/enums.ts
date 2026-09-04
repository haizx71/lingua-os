/** Runtime registries paired with OpenAPI-generated string unions. */
import enumRegistry from '../../../contracts/enums.json';
import type {
  ApiSchema,
  AssessmentDomain,
  CompetenceDimension,
  ConceptStatus,
  ConfidenceBand,
  ContentType,
  LearningActivityType,
  LearningGoal,
  LibraryItemType,
  MemoryState,
  ReviewExerciseMode,
  ReviewRating,
  StartingLevelBandCode,
  TodayReasonCode,
} from './api/dtos';

export type {
  AssessmentDomain,
  CompetenceDimension,
  ConceptStatus,
  ConfidenceBand,
  ContentType,
  LearningActivityType,
  LearningGoal,
  LibraryItemType,
  MemoryState,
  ReviewExerciseMode,
  ReviewRating,
  StartingLevelBandCode,
  TodayReasonCode,
} from './api/dtos';

function registryValues<T extends string>(values: readonly string[]): readonly T[] {
  return Object.freeze([...values]) as readonly T[];
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

export const CONCEPT_STATUSES = registryValues<ConceptStatus>(enumRegistry.concept_status);
export const LEARNING_ACTIVITY_TYPES = registryValues<LearningActivityType>(enumRegistry.learning_activity_type);
export const REVIEW_RATINGS = registryValues<ReviewRating>(enumRegistry.review_rating);
export const REVIEW_EXERCISE_MODES = registryValues<ReviewExerciseMode>(enumRegistry.review_exercise_mode);
export const MEMORY_STATES = registryValues<MemoryState>(enumRegistry.memory_state);
export const COMPETENCE_DIMENSIONS = registryValues<CompetenceDimension>(enumRegistry.competence_dimension);
export const LEARNING_GOALS = registryValues<LearningGoal>(enumRegistry.learning_goal);
export const CONFIDENCE_BANDS = registryValues<ConfidenceBand>(enumRegistry.confidence_band);
export const TODAY_REASON_CODES = registryValues<TodayReasonCode>(enumRegistry.today_reason_code);
export const CONTENT_TYPES = registryValues<ContentType>(enumRegistry.content_type);
export const LIBRARY_ITEM_TYPES = registryValues<LibraryItemType>(enumRegistry.library_item_type);
export const ASSESSMENT_DOMAINS = registryValues<AssessmentDomain>(enumRegistry.assessment_domain);
export const STARTING_LEVEL_BANDS = registryValues<StartingLevelBandCode>(enumRegistry.starting_level_band);

export const isConceptStatus = (value: unknown): value is ConceptStatus => includes(CONCEPT_STATUSES, value);
export const isLearningActivityType = (value: unknown): value is LearningActivityType => includes(LEARNING_ACTIVITY_TYPES, value);
export const isReviewRating = (value: unknown): value is ReviewRating => includes(REVIEW_RATINGS, value);
export const isReviewExerciseMode = (value: unknown): value is ReviewExerciseMode => includes(REVIEW_EXERCISE_MODES, value);
export const isMemoryState = (value: unknown): value is MemoryState => includes(MEMORY_STATES, value);
export const isTodayReasonCode = (value: unknown): value is TodayReasonCode => includes(TODAY_REASON_CODES, value);
export const isConfidenceBand = (value: unknown): value is ConfidenceBand => includes(CONFIDENCE_BANDS, value);
export const isAssessmentDomain = (value: unknown): value is AssessmentDomain => includes(ASSESSMENT_DOMAINS, value);
export const isStartingLevelBand = (value: unknown): value is StartingLevelBandCode => includes(STARTING_LEVEL_BANDS, value);
export const isLearningGoal = (value: unknown): value is LearningGoal => includes(LEARNING_GOALS, value);


// Presentation aliases retained for component terminology; values still come from OpenAPI.
export type ExerciseMode = ReviewExerciseMode;
export const EXERCISE_MODES = REVIEW_EXERCISE_MODES;
export const isExerciseMode = isReviewExerciseMode;
export type ReasonCode = TodayReasonCode;
export const REASON_CODES = TODAY_REASON_CODES;
export const isReasonCode = isTodayReasonCode;
export type ConfidenceLevel = ConfidenceBand;
export const CONFIDENCE_LEVELS = CONFIDENCE_BANDS;
export const isConfidenceLevel = isConfidenceBand;
export type FSRSStateEnum = MemoryState;
export const FSRS_STATE_ENUMS = MEMORY_STATES;
export type AssessmentSkill = CompetenceDimension;
export const ASSESSMENT_SKILLS = COMPETENCE_DIMENSIONS;
export type ActivityStatus = ApiSchema<'TodayActivityStatus'>;

// OpenAPI deliberately keeps these domain vocabularies extensible strings.
export type CEFRLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const CEFR_LEVELS: readonly CEFRLevel[] = Object.freeze(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const isCEFRLevel = (value: unknown): value is CEFRLevel => includes(CEFR_LEVELS, value);
export type PartOfSpeech = string;

export const CONCEPT_STATUS_LABELS_VI: Record<ConceptStatus, string> = {
  unseen: 'Chưa gặp', discovered: 'Mới phát hiện', learning: 'Đang học', familiar: 'Quen thuộc',
  active: 'Đang luyện', mastered: 'Đã nắm vững', weak: 'Cần củng cố', forgotten: 'Đã quên',
};

export const REASON_CODE_LABELS_VI: Record<TodayReasonCode, string> = {
  FSRS_DUE: 'Ôn tập vì sắp đến ngưỡng quên',
  WEAK_RECOGNITION: 'Củng cố khả năng nhận diện từ vựng',
  WEAK_LISTENING: 'Luyện nghe phản xạ vì điểm nghe còn yếu',
  LOW_PRODUCTION_EVIDENCE: 'Tập sử dụng từ trong câu thực tế',
  CONTENT_FIT: 'Nội dung phù hợp với vốn từ hiện tại',
  RECENT_EXPOSURE: 'Vừa bắt gặp từ mới trong bài đọc',
  NEW_CONCEPT_BUDGET: 'Mở rộng vốn từ theo mục tiêu ngày',
};

export const REVIEW_RATING_LABELS_VI: Record<ReviewRating, string> = {
  again: 'Quên (Lặp lại)', hard: 'Khó', good: 'Nhớ tốt', easy: 'Rất dễ',
};
