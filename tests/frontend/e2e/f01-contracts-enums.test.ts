import { describe, it, expect } from 'vitest';
import enumsContract from '../../../contracts/enums.json';
import errorsContract from '../../../contracts/errors.json';
import {
  mockConcepts,
  mockSemanticErrors,
} from '../harness/contract-fixtures';
import type {
  ConceptStatus,
  LearningActivityType,
  ReviewRating,
  ContentQualityStatus,
} from '../harness/types';

describe('Tier 1: Feature 01 - Contracts & Enums Conformity (Integration / Contract Tests)', () => {
  it('test_concept_status_enum_matches_shared_contract_strictly', () => {
    const contractStatuses = enumsContract.concept_status;
    const expectedContractStatuses: ConceptStatus[] = [
      'unseen',
      'discovered',
      'learning',
      'familiar',
      'active',
      'mastered',
      'weak',
      'forgotten',
    ];

    expect(contractStatuses).toEqual(expectedContractStatuses);
    expect(expectedContractStatuses).toHaveLength(8);
  });

  it('test_learning_activity_types_conform_to_contract', () => {
    const expectedActivities: LearningActivityType[] = ['review', 'read', 'listen', 'learn'];
    expect(enumsContract.learning_activity_type).toEqual(expectedActivities);
  });

  it('test_review_ratings_conform_to_fsrs_contract', () => {
    const expectedRatings: ReviewRating[] = ['again', 'hard', 'good', 'easy'];
    expect(enumsContract.review_rating).toEqual(expectedRatings);
  });

  it('test_content_quality_status_values_conform_to_contract', () => {
    const expectedStatuses: ContentQualityStatus[] = [
      'raw',
      'normalized',
      'review_pending',
      'approved',
      'rejected',
    ];
    expect(enumsContract.content_quality_status).toEqual(expectedStatuses);
  });

  it('test_semantic_error_codes_and_http_status_mappings', () => {
    const expectedErrors: Array<{ code: string; http_status: number }> = [
      { code: 'UNAUTHENTICATED', http_status: 401 },
      { code: 'FORBIDDEN', http_status: 403 },
      { code: 'NOT_FOUND', http_status: 404 },
      { code: 'PRECONDITION_FAILED', http_status: 412 },
      { code: 'CONFLICT', http_status: 409 },
      { code: 'INVALID_STATE_TRANSITION', http_status: 409 },
      { code: 'IDEMPOTENCY_KEY_REUSED', http_status: 409 },
      { code: 'VALIDATION_ERROR', http_status: 422 },
      { code: 'RATE_LIMITED', http_status: 429 },
      { code: 'SERVICE_UNAVAILABLE', http_status: 503 },
      { code: 'INTERNAL_ERROR', http_status: 500 },
    ];

    expect(errorsContract.errors).toEqual(expectedErrors);

    expectedErrors.forEach(({ code }) => {
      if (code in mockSemanticErrors) {
        const mockErr = mockSemanticErrors[code as keyof typeof mockSemanticErrors];
        expect(mockErr).toBeDefined();
        expect(mockErr.code).toBe(code);
        expect(mockErr.message).toBeTruthy();
        expect(mockErr.request_id).toBeTruthy();
      }
    });
  });

  it('test_concept_fixtures_satisfy_mandatory_contract_fields', () => {
    mockConcepts.forEach((concept) => {
      expect(concept.id).toBeTruthy();
      expect(concept.term).toBeTruthy();
      expect(concept.lemma).toBeTruthy();
      expect(concept.language).toBe('en');
      expect(concept.translation_vi).toBeTruthy();
      expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(concept.cefr_level);
    });
  });
});
