import { describe, it, expect } from 'vitest';
import { captureLearnerDigestFromPostgres } from './postgres_probe_client';

describe('Postgres Probe Client', () => {
  it('fails closed when DATABASE_URL is missing', async () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      await expect(
        captureLearnerDigestFromPostgres(
          '00000000-0000-4000-8000-000000000001',
          '7f110000-0000-4000-8000-000000000004',
          { databaseUrl: '' }
        )
      ).rejects.toThrow('DATABASE_URL is missing or empty');
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      }
    }
  });

  it('correctly parses canonical JSON output containing Decimal strings and ISO timestamps', () => {
    const rawJson = JSON.stringify({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      concept_id: '7f110000-0000-4000-8000-000000000004',
      user_exists: true,
      profile_time_zone: 'Asia/Ho_Chi_Minh',
      language_profile_ids: ['33333333-3333-4000-8000-000000000003'],
      is_concept_saved: true,
      save_intent_count: 1,
      save_intent_ids: ['44444444-4444-4000-8000-000000000004'],
      review_item_count: 1,
      review_item_ids: ['11111111-1111-4000-8000-000000000001'],
      fsrs_state_count: 1,
      fsrs_states: [
        {
          review_item_id: '11111111-1111-4000-8000-000000000001',
          state: 'learning',
          state_version: 2,
          last_review_at: '2026-09-06T10:00:00+00:00',
          due_at: '2026-09-06T14:30:00+00:00',
          stability: '4.12345678',
          difficulty: '2.5000',
          step: 1,
        },
      ],
      learning_event_count: 1,
      learning_events: [
        {
          learning_event_id: '22222222-2222-4000-8000-000000000002',
          id: '22222222-2222-4000-8000-000000000002',
          event_type: 'learning.concept.saved.v1',
          source_type: 'concept_save_intent',
          source_event_id: '22222222-2222-4000-8000-000000000002',
          ingestion_sequence: 1,
          created_at: '2026-09-06T09:00:00+00:00',
        },
      ],
      review_event_count: 0,
      review_events: [],
      concept_state: {
        status: 'learning',
        state_version: 2,
        has_learning_intent: true,
        has_projectable_evidence: false,
        mastery: '0.50000000',
        mastery_score: '0.50000000',
        confidence: '0.7500',
        recognition: '0.50000000',
        recognition_score: '0.50000000',
        listening: '0.50000000',
        listening_score: '0.50000000',
        production: '0.50000000',
        production_score: '0.50000000',
      },
      skill_states: [],
      today_plan_count: 1,
      today_plan_ids: ['66666666-6666-4000-8000-000000000006'],
      today_activity_review_item_ids: ['11111111-1111-4000-8000-000000000001'],
    });

    const parsed = JSON.parse(rawJson);
    expect(parsed.user_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(parsed.fsrs_states[0].difficulty).toBe('2.5000');
    expect(parsed.fsrs_states[0].stability).toBe('4.12345678');
    expect(parsed.concept_state.mastery).toBe('0.50000000');
  });
});
