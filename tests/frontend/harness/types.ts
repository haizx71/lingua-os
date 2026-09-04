/**
 * LINGUA OS Test Harness Types
 * Re-exports shared production types from @lingua/types to maintain single source of truth.
 * Contains only test-specific fixture helpers where applicable.
 */

export type {
  ConceptStatus,
  ConceptPresentationState,
  LearningActivityType,
  ReviewRating,
  ContentQualityStatus,
  ExerciseMode,
  ReasonCode,
  ConfidenceLevel,
  CEFRLevel,
  PartOfSpeech,
  ConceptRelationType,
  ActivityStatus,
  ContentType,
  FSRSStateEnum,
  AssessmentSkill,
  AssessmentSessionStatus,
  LearningGoal,
} from '@lingua/types';

export type {
  UUID,
  ISODateString,
  UserProfile,
  UserSettings,
  UserLanguageProfile,
  TodayPlan,
  TodayActivity,
  ConceptDetail,
  ConceptSense,
  ConceptExample,
  ConceptRelation,
  ConceptBrainState,
  ReviewItem,
  FSRSState,
  ContentItem,
  ContentItemSummary,
  ContentSegment,
  ReaderSentence,
  ReaderConceptAnnotation,
  SavedSentenceItem,
  BrainSummary,
  BrainSignalBreakdown,
  BrainRecentExposure,
  BrainGraphNode,
  BrainGraphEdge,
  BrainGraphResponse,
  BrainConceptItem,
  ProgressOverview,
  WeeklyEvidenceSummary,
  ProgressHistoryItem,
  AssessmentItem,
  AssessmentQuestionOption,
  AssessmentSession,
  AssessmentResult,
  AssessedSkillScore,
} from '@lingua/types';

export type { ApiErrorCode as ErrorCode, ApiErrorResponse } from '@lingua/types';

// Fixture-specific presentation aliases used in test scenarios
export interface ExampleSentence {
  source: string;
  target: string;
  audio_url?: string;
}

export interface Concept {
  id: string;
  term: string;
  lemma: string;
  language: string;
  pos?: string;
  ipa?: string;
  translation_vi: string;
  definition?: string;
  cefr_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  status: import('@lingua/types').ConceptStatus;
  examples?: ExampleSentence[];
  evidence?: {
    recognition_score: number;
    listening_score: number;
    production_score: number;
  };
}

export interface ReaderToken {
  raw: string;
  lemma: string;
  concept_id?: string;
  status?: import('@lingua/types').ConceptStatus;
  ipa?: string;
  translation_vi?: string;
}

export interface ReaderSentenceFixture {
  id: string;
  text: string;
  translation_vi?: string;
  audio_url?: string;
  tokens: ReaderToken[];
}

export interface ReaderContent {
  id: string;
  title: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  word_count: number;
  familiarity_rate: number;
  target_new_concepts_count: number;
  sentences: ReaderSentenceFixture[];
}

export interface BrainGraphData {
  nodes: Array<{
    id: string;
    label: string;
    cefr: string;
    status: import('@lingua/types').ConceptStatus;
    groupLabel?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationship: string;
  }>;
  summary: {
    total_tracked: number;
    mastered: number;
    learning: number;
    weak: number;
    memory_health_score: number;
  };
}

export interface TodayRecommendedActivity {
  id: string;
  type: import('@lingua/types').LearningActivityType;
  title: string;
  estimated_minutes: number;
  item_count: number;
  reason: string;
  badge_label?: string;
  badge_variant?: 'primary' | 'warning' | 'info' | 'success' | 'neutral';
  target_url: string;
}

export interface ProgressSummary {
  current_level_estimate: string;
  level_estimate_label: string;
  confidence: 'low' | 'medium' | 'high';
  confidence_label_vi: string;
  retention_rate: number;
  total_mastered: number;
  total_learning: number;
  total_weak: number;
  time_spent_by_activity: Record<string, number>;
  weekly_evidence: {
    new_concepts_acquired: number;
    concepts_solidified: number;
    active_days: number;
    total_days: number;
  };
  skill_dimensions: {
    recognition_evidence: number;
    listening_evidence: number;
    production_evidence: number;
  };
}

export interface DictionaryEntry {
  term: string;
  lemma: string;
  pos: string;
  ipa: string;
  definitions: Array<{
    meaning_vi: string;
    explanation_en?: string;
    examples: ExampleSentence[];
  }>;
  status: import('@lingua/types').ConceptStatus;
  cefr_level: string;
}

export interface OnboardingDiagnosticQuestion {
  id: string;
  type: string;
  prompt: string;
  options: string[];
}

export interface OnboardingDiagnosticResult {
  estimated_level: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
  assessed_skills: string[];
  method_version: string;
}
