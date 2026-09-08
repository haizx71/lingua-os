import { describe, it, expect } from 'vitest';
import {
  parseTodayPlanResponse,
  runPhaseCLearningLoop,
} from './phase_c_runner';

describe('Phase C Runner Static Invariants & Fail-Closed Behavior', () => {
  it('fails closed when external Supabase credentials are not present in process environment', async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalSecret = process.env.SUPABASE_SECRET_KEY;
    const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(runPhaseCLearningLoop()).rejects.toThrow('SUPABASE_URL is missing or empty');
    } finally {
      if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
      if (originalSecret !== undefined) process.env.SUPABASE_SECRET_KEY = originalSecret;
      if (originalServiceRole !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });

  describe('parseTodayPlanResponse', () => {
    it('correctly parses canonical FastAPI/OpenAPI TodayPlanResponse', () => {
      const canonicalResponse = {
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          languageProfileId: '22222222-2222-4222-8222-222222222222',
          planDate: '2026-09-06',
          timeZone: 'Asia/Ho_Chi_Minh',
          targetMinutes: 15,
          completedMinutes: 0,
          status: 'active',
          engineVersion: 'today-heuristic-v1',
          activities: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              position: 0,
              activityType: 'review',
              title: 'Spaced Repetition Review',
              description: 'Review 1 due concept',
              estimatedMinutes: 5,
              reasonCodes: ['FSRS_DUE'],
              reasonText: 'Scheduled for review by FSRS memory model',
              status: 'pending',
              targetCount: 1,
              completedCount: 0,
              conceptId: '7f110000-0000-4000-8000-000000000004',
              reviewItemId: '44444444-4444-4444-8444-444444444444',
              createdAt: '2026-09-06T08:00:00Z',
            },
          ],
          createdAt: '2026-09-06T08:00:00Z',
          updatedAt: '2026-09-06T08:00:00Z',
        },
        meta: { apiVersion: '1.0',
          requestId: '55555555-5555-4555-8555-555555555555',
        },
      };

      const plan = parseTodayPlanResponse(canonicalResponse);
      expect(plan.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(plan.languageProfileId).toBe('22222222-2222-4222-8222-222222222222');
      expect(plan.planDate).toBe('2026-09-06');
      expect(plan.timeZone).toBe('Asia/Ho_Chi_Minh');
      expect(plan.engineVersion).toBe('today-heuristic-v1');
      expect(plan.status).toBe('active');
      expect(plan.targetMinutes).toBe(15);
      expect(plan.activities).toHaveLength(1);

      const act = plan.activities[0];
      expect(act.id).toBe('33333333-3333-4333-8333-333333333333');
      expect(act.activityType).toBe('review');
      expect(act.reasonCodes).toEqual(['FSRS_DUE']);
      expect(act.conceptId).toBe('7f110000-0000-4000-8000-000000000004');
      expect(act.reviewItemId).toBe('44444444-4444-4444-8444-444444444444');
      expect(act.status).toBe('pending');
    });

    it('throws descriptive error if missing data envelope or required fields', () => {
      expect(() => parseTodayPlanResponse({})).toThrow('frozen OpenAPI validation failed');
      expect(() => parseTodayPlanResponse({ data: null })).toThrow('frozen OpenAPI validation failed');
      expect(() => parseTodayPlanResponse({ data: { id: '' } })).toThrow('frozen OpenAPI validation failed');
      expect(() =>
        parseTodayPlanResponse({
          data: {
            id: '11111111-1111-4111-8111-111111111111',
            languageProfileId: '',
          },
        })
      ).toThrow('frozen OpenAPI validation failed');
    });

    it('throws descriptive error if activities are invalid', () => {
      const invalidActivitiesResponse = {
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          languageProfileId: '22222222-2222-4222-8222-222222222222',
          planDate: '2026-09-06',
          timeZone: 'Asia/Ho_Chi_Minh',
          engineVersion: 'today-heuristic-v1',
          activities: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              // missing activityType
              reasonCodes: ['FSRS_DUE'],
            },
          ],
        },
      };

      expect(() => parseTodayPlanResponse(invalidActivitiesResponse)).toThrow(
        'frozen OpenAPI validation failed'
      );
    });
  });
});
