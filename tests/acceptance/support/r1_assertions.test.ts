import { describe, expect, it } from 'vitest';
import { assertNoLearningMutation, assertCleanupEvidence, assertSameReceipt } from './r1_assertions';
import { validateBrowserResponse } from './contract_validation';

describe('R1 adversarial evidence gates', () => {
  it('does not allow a passive Today GET to fabricate completion receipts', () => {
    const before = { users: [], today_plans: [], today_activity_completion_results: [] };
    const after = { ...before, today_activity_completion_results: [{ id: 'fabricated' }] };
    expect(() => assertNoLearningMutation(before, after, true)).toThrow();
  });
  it.each([401, 403, 404, 500])('rejects HTTP %s before DTO interpretation', status => {
    expect(() => validateBrowserResponse('GET', '/v1/me', status, {})).toThrow('HTTP');
  });
  it('rejects malformed successful wire DTO and invented route', () => {
    expect(() => validateBrowserResponse('GET', '/v1/brain/summary', 200, { data: {} })).toThrow();
    expect(() => validateBrowserResponse('GET', '/v1/invented', 200, { data: {} })).toThrow();
  });
  const before = { users: [{ id: 'actor' }], user_concept_states: [{ production: '0.5', production_positive_mass: '0' }], learning_events: [], today_plans: [] };
  it('allows only Today coordination persistence when explicitly requested', () => {
    expect(() => assertNoLearningMutation(before, { ...before, today_plans: [{ id: 'plan' }] }, true)).not.toThrow();
    expect(() => assertNoLearningMutation(before, { ...before, today_plans: [{ id: 'plan' }] })).toThrow();
  });
  it.each(['production', 'production_positive_mass', 'confidence', 'evidence_count', 'state_version'])(
    'rejects passive %s mutation even with unchanged row counts', field => {
      expect(() => assertNoLearningMutation(before, { ...before, user_concept_states: [{ ...before.user_concept_states[0], [field]: 'wrong' }] }, true)).toThrow();
    },
  );
  it('rejects an event for another concept and a previously unobserved table', () => {
    expect(() => assertNoLearningMutation(before, { ...before, learning_events: [{ concept_id: 'foreign-concept' }] }, true)).toThrow();
    expect(() => assertNoLearningMutation(before, { ...before, user_saved_sentences: [{ id: 'unexpected' }] }, true)).toThrow();
  });
  it('rejects absent observations', () => {
    expect(() => assertNoLearningMutation(undefined, undefined)).toThrow();
  });
  const receipt = { reviewItemId: 'item', idempotencyKey: 'key', rating: 'good', responseTimeMs: 123 };
  it.each(['reviewItemId', 'idempotencyKey', 'rating', 'responseTimeMs'])(
    'rejects changed retry %s', field => {
      expect(() => assertSameReceipt(receipt, { ...receipt, [field]: 'changed' })).toThrow();
    },
  );
  it('rejects omitted or added retry fields', () => {
    expect(() => assertSameReceipt(receipt, { idempotencyKey: 'key' })).toThrow();
    expect(() => assertSameReceipt(receipt, { ...receipt, correct: true })).toThrow();
  });
  it('accepts exact retry and complete cleanup', () => {
    expect(() => assertSameReceipt(receipt, { ...receipt })).not.toThrow();
    expect(() => assertCleanupEvidence(true, { clean: true, counts: { users: 0, learning_events: 0 }, anchor_concept_intact: true })).not.toThrow();
  });
  it.each([
    { clean: true, counts: { users: 0, learning_events: 1 }, anchor_concept_intact: true },
    { clean: true, counts: {}, anchor_concept_intact: true },
    { clean: true, counts: { users: 0 }, anchor_concept_intact: false },
    { clean: false, counts: { users: 0 }, anchor_concept_intact: true },
    {},
  ])('rejects misleading cleanup flags or residual rows %#', evidence => {
    expect(() => assertCleanupEvidence(true, evidence)).toThrow();
  });
  it('rejects unverified auth deletion', () => {
    expect(() => assertCleanupEvidence(false, { clean: true, counts: { users: 0 }, anchor_concept_intact: true })).toThrow();
  });
});
