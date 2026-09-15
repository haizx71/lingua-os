/**
 * Authoritative API DTO aliases.
 *
 * Every alias in this module is derived from the generated OpenAPI surface. UI code must consume
 * adapter view models instead of these transport shapes.
 */
import type { components, operations, paths } from '../generated/openapi';

export type ApiComponents = components;
export type ApiOperations = operations;
export type ApiPaths = paths;
export type ApiSchema<Name extends keyof components['schemas']> = components['schemas'][Name];

export type ApiErrorCode = ApiSchema<'ErrorCode'>;
export type ApiErrorEnvelope = ApiSchema<'ErrorEnvelope'>;
export type ResponseMetaDto = ApiSchema<'ResponseMeta'>;
export type CursorResponseMetaDto = ApiSchema<'CursorResponseMeta'>;
export type ConceptStatus = ApiSchema<'ConceptStatus'>;
export type LearningActivityType = ApiSchema<'LearningActivityType'>;
export type ReviewRating = ApiSchema<'ReviewRating'>;
export type ReviewExerciseMode = ApiSchema<'ReviewExerciseMode'>;
export type MemoryState = ApiSchema<'MemoryState'>;
export type CompetenceDimension = ApiSchema<'CompetenceDimension'>;
export type LearningGoal = ApiSchema<'LearningGoal'>;
export type ConfidenceBand = ApiSchema<'ConfidenceBand'>;
export type TodayReasonCode = ApiSchema<'TodayReasonCode'>;
export type ContentType = ApiSchema<'ContentType'>;
export type LibraryItemType = ApiSchema<'LibraryItemType'>;
export type AssessmentDomain = ApiSchema<'AssessmentDomain'>;
export type StartingLevelBandCode = ApiSchema<'StartingLevelBandCode'>;
export type AssessmentStatus = ApiSchema<'AssessmentStatus'>;
export type AdminContentStatus = ApiSchema<'AdminContentStatus'>;

export type MeProfileDto = ApiSchema<'MeProfile'>;
export type LanguageProfileDto = ApiSchema<'LanguageProfile'>;
export type TodayPlanDto = ApiSchema<'TodayPlan'>;
export type TodayActivityDto = ApiSchema<'TodayActivity'>;
export type MemorySnapshotDto = ApiSchema<'MemorySnapshot'>;
export type CompetenceSignalsDto = ApiSchema<'CompetenceSignals'>;
export type ReviewQueueItemDto = ApiSchema<'ReviewQueueItem'>;
export type ConceptSummaryDto = ApiSchema<'ConceptSummary'>;
export type ConceptDetailDto = ApiSchema<'ConceptDetail'>;
export type ReaderAnalysisDto = ApiSchema<'ReaderAnalysis'>;
export type ReaderSentenceDto = ApiSchema<'ReaderSentence'>;
export type ReaderExposureResultDto = ApiSchema<'ReaderExposureResult'>;
export type ReadingProgressDto = ApiSchema<'ReadingProgress'>;
export type ContentSummaryDto = ApiSchema<'ContentSummary'>;
export type ContentDetailDto = ApiSchema<'ContentDetail'>;
export type LibraryItemDto = ApiSchema<'LibraryItem'>;
export type AssessmentItemDto = ApiSchema<'AssessmentItem'>;
export type AssessmentOptionDto = ApiSchema<'AssessmentOption'>;
export type AssessmentProgressDto = ApiSchema<'AssessmentProgress'>;
export type StartingLevelBandDto = ApiSchema<'StartingLevelBand'>;
export type StartingLevelEstimateDto = ApiSchema<'StartingLevelEstimate'>;
export type AssessmentSessionDto = ApiSchema<'AssessmentSession'>;
export type BrainSummaryDto = ApiSchema<'BrainSummary'>;
export type BrainConceptSummaryDto = ApiSchema<'BrainConceptSummary'>;
export type BrainConceptDetailDto = ApiSchema<'BrainConceptDetail'>;
export type ProgressOverviewDto = ApiSchema<'ProgressOverview'>;
export type AdminContentDto = ApiSchema<'AdminContent'>;
export type AdminContentValidationDto = ApiSchema<'AdminContentValidation'>;
export type AdminCatalogConceptDto = ApiSchema<'AdminCatalogConcept'>;
export type AdminSentenceConceptDto = ApiSchema<'AdminSentenceConcept'>;

export type MeResponseDto = ApiSchema<'MeResponse'>;
export type LanguageProfilesResponseDto = ApiSchema<'LanguageProfilesResponse'>;
export type LanguageProfileResponseDto = ApiSchema<'LanguageProfileResponse'>;
export type TodayPlanResponseDto = ApiSchema<'TodayPlanResponse'>;
export type TodayCompletionResponseDto = ApiSchema<'TodayCompletionResponse'>;
export type ReviewQueueResponseDto = ApiSchema<'ReviewQueueResponse'>;
export type ReviewAnswerResponseDto = ApiSchema<'ReviewAnswerResponse'>;
export type ConceptResponseDto = ApiSchema<'ConceptResponse'>;
export type DictionarySearchResponseDto = ApiSchema<'DictionarySearchResponse'>;
export type ReaderAnalyzeResponseDto = ApiSchema<'ReaderAnalyzeResponse'>;
export type ReaderExposureResponseDto = ApiSchema<'ReaderExposureResponse'>;
export type ReadingProgressResponseDto = ApiSchema<'ReadingProgressResponse'>;
export type ContentRecommendationsResponseDto = ApiSchema<'ContentRecommendationsResponse'>;
export type ContentResponseDto = ApiSchema<'ContentResponse'>;
export type LibraryItemsResponseDto = ApiSchema<'LibraryItemsResponse'>;
export type LibraryMutationResponseDto = ApiSchema<'LibraryMutationResponse'>;
export type AssessmentSessionResponseDto = ApiSchema<'AssessmentSessionResponse'>;
export type BrainSummaryResponseDto = ApiSchema<'BrainSummaryResponse'>;
export type BrainConceptListResponseDto = ApiSchema<'BrainConceptListResponse'>;
export type BrainConceptResponseDto = ApiSchema<'BrainConceptResponse'>;
export type ProgressOverviewResponseDto = ApiSchema<'ProgressOverviewResponse'>;
export type AdminContentListResponseDto = ApiSchema<'AdminContentListResponse'>;
export type AdminContentResponseDto = ApiSchema<'AdminContentResponse'>;
export type AdminContentValidationResponseDto = ApiSchema<'AdminContentValidationResponse'>;
export type AdminConceptSearchResponseDto = ApiSchema<'AdminConceptSearchResponse'>;

export type UpdateMeRequestDto = ApiSchema<'UpdateMeRequest'>;
export type CreateLanguageProfileRequestDto = ApiSchema<'CreateLanguageProfileRequest'>;
export type UpdateLanguageProfileRequestDto = ApiSchema<'UpdateLanguageProfileRequest'>;
export type CompleteTodayActivityRequestDto = ApiSchema<'CompleteTodayActivityRequest'>;
export type ReviewAnswerRequestDto = ApiSchema<'ReviewAnswerRequest'>;
export type ReaderAnalyzeRequestDto = ApiSchema<'ReaderAnalyzeRequest'>;
export type ReaderExposureRequestDto = ApiSchema<'ReaderExposureRequest'>;
export type UpdateReaderProgressRequestDto = ApiSchema<'UpdateReaderProgressRequest'>;
export type SaveSentenceRequestDto = ApiSchema<'SaveSentenceRequest'>;
export type StartAssessmentRequestDto = ApiSchema<'StartAssessmentRequest'>;
export type SubmitAssessmentResponseRequestDto = ApiSchema<'SubmitAssessmentResponseRequest'>;
export type CreateAdminContentRequestDto = ApiSchema<'CreateAdminContentRequest'>;
export type UpdateAdminContentRequestDto = ApiSchema<'UpdateAdminContentRequest'>;
export type PutAdminSentenceConceptRequestDto = ApiSchema<'PutAdminSentenceConceptRequest'>;

export type OperationQuery<Name extends keyof operations> = operations[Name] extends {
  parameters: { query?: infer Query };
}
  ? Query
  : never;

export type OperationPath<Name extends keyof operations> = operations[Name] extends {
  parameters: { path?: infer Path };
}
  ? Path
  : never;

export type OperationHeaders<Name extends keyof operations> = operations[Name] extends {
  parameters: { header?: infer Headers };
}
  ? Headers
  : never;
