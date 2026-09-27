import { beforeEach, describe, expect, it } from 'vitest';
import { readPendingAnswer } from '../../apps/web/src/features/review/pendingAnswer';

const receiptKey = 'lingua.review.pending.v1:actor:default';
const operation = {
  reviewItemId: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  rating: 'good',
  exerciseMode: 'typing',
  responseText: 'appointment',
  responseTimeMs: 420,
};

describe('Review pending answer receipt', () => {
  beforeEach(() => sessionStorage.clear());

  it('preserves the selected modality and response for exact retry', () => {
    sessionStorage.setItem(receiptKey, JSON.stringify(operation));

    expect(readPendingAnswer(receiptKey)).toEqual(operation);
  });

  it('defaults legacy receipts to self-recall for backward-compatible replay', () => {
    const { exerciseMode: _exerciseMode, responseText: _responseText, ...legacy } = operation;
    sessionStorage.setItem(receiptKey, JSON.stringify(legacy));

    expect(readPendingAnswer(receiptKey)).toEqual({
      ...legacy,
      exerciseMode: 'self_recall',
    });
  });
});
