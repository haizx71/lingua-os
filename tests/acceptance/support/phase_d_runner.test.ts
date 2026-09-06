import { describe, it, expect } from 'vitest';
import {
  parseReviewQueueResponse,
  parseReviewAnswerResponse,
  runPhaseDLearningLoop,
} from './phase_d_runner';

describe('Phase D Runner Static Invariants & Fail-Closed Behavior', () => {
  it('fails closed when external Supabase credentials are not present in process environment', async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalSecret = process.env.SUPABASE_SECRET_KEY;
    const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(runPhaseDLearningLoop()).rejects.toThrow('SUPABASE_URL is missing or empty');
    } finally {
      if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
      if (originalSecret !== undefined) process.env.SUPABASE_SECRET_KEY = originalSecret;
      if (originalServiceRole !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });

  describe('parseReviewQueueResponse', () => {
    it('correctly parses canonical FastAPI/OpenAPI ReviewQueueResponse', () => {
      const canonicalResponse = {
        data: [
          {
            reviewItemId: '44444444-4444-4444-8444-444444444444',
            concept: {
              id: '7f110000-0000-4000-8000-000000000004',
              canonicalForm: 'xin chào',
              partOfSpeech: 'phrase',
              level: {
                frameworkCode: 'cefr',
                code: 'a1',
                label: 'A1',
              },
              status: 'discovered',
              isDue: true,
            },
            exerciseMode: 'self_recall',
            prompt: {
              promptText: 'xin chào',
              contextSentence: 'Xin chào, bạn khỏe không?',
              translation: 'Hello, how are you?',
            },
            memory: {
              state: 'new',
              dueAt: '2026-09-06T08:00:00Z',
              lastReviewedAt: null,
              isDue: true,
            },
            competence: {
              recognition: { score: 0.0, confidence: 0.0, evidenceCount: 0, updatedAt: null },
              listening: { score: 0.0, confidence: 0.0, evidenceCount: 0, updatedAt: null },
              production: { score: 0.0, confidence: 0.0, evidenceCount: 0, updatedAt: null },
            },
          },
        ],
        meta: {
          requestId: '55555555-5555-4555-8555-555555555555',
          nextCursor: null,
          hasMore: false,
          pageSize: 1,
        },
      };

      const queue = parseReviewQueueResponse(canonicalResponse);
      expect(queue).toHaveLength(1);
      const item = queue[0];
      expect(item.reviewItemId).toBe('44444444-4444-4444-8444-444444444444');
      expect(item.concept.id).toBe('7f110000-0000-4000-8000-000000000004');
      expect(item.concept.canonicalForm).toBe('xin chào');
      expect(item.exerciseMode).toBe('self_recall');
      expect(item.prompt.promptText).toBe('xin chào');
      expect(item.memory.state).toBe('new');
      expect(item.memory.isDue).toBe(true);
      expect(item.competence.production.evidenceCount).toBe(0);
    });

    it('throws descriptive error if missing data envelope or invalid items', () => {
      expect(() => parseReviewQueueResponse({})).toThrow('Invalid /v1/review/queue response: missing data envelope');
      expect(() => parseReviewQueueResponse({ data: null })).toThrow('Invalid /v1/review/queue response: data is not an array');
      expect(() => parseReviewQueueResponse({ data: [{}] })).toThrow('Invalid /v1/review/queue response: item at index 0 missing reviewItemId');
    });
  });

  describe('parseReviewAnswerResponse', () => {
    it('correctly parses canonical FastAPI/OpenAPI ReviewAnswerResponse', () => {
      const canonicalResponse = {
        data: {
          reviewItemId: '44444444-4444-4444-8444-444444444444',
          memory: {
            state: 'learning',
            dueAt: '2026-09-07T08:00:00Z',
            lastReviewedAt: '2026-09-06T08:00:00Z',
            isDue: false,
          },
          competence: {
            recognition: { score: 0.0, confidence: 0.0, evidenceCount: 0, updatedAt: null },
            listening: { score: 0.0, confidence: 0.0, evidenceCount: 0, updatedAt: null },
            production: { score: 0.85, confidence: 0.6, evidenceCount: 1, updatedAt: '2026-09-06T08:00:00Z' },
          },
          remainingDueCount: 0,
          feedback: 'Đã ghi nhận kết quả ôn tập.',
        },
        meta: {
          requestId: '55555555-5555-4555-8555-555555555555',
        },
      };

      const result = parseReviewAnswerResponse(canonicalResponse);
      expect(result.reviewItemId).toBe('44444444-4444-4444-8444-444444444444');
      expect(result.memory.state).toBe('learning');
      expect(result.memory.isDue).toBe(false);
      expect(result.memory.lastReviewedAt).toBe('2026-09-06T08:00:00Z');
      expect(result.competence.production.evidenceCount).toBe(1);
      expect(result.competence.production.score).toBe(0.85);
      expect(result.remainingDueCount).toBe(0);
      expect(result.feedback).toBe('Đã ghi nhận kết quả ôn tập.');
    });

    it('throws descriptive error if missing data envelope or invalid fields', () => {
      expect(() => parseReviewAnswerResponse({})).toThrow('Invalid /v1/review/{reviewItemId}/answer response: missing data envelope');
      expect(() => parseReviewAnswerResponse({ data: null })).toThrow('Invalid /v1/review/{reviewItemId}/answer response: data is not an object');
      expect(() => parseReviewAnswerResponse({ data: { reviewItemId: '' } })).toThrow('Invalid /v1/review/{reviewItemId}/answer response: missing or invalid data.reviewItemId');
    });
  });
});
