// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { runPhaseDLearningLoop } from './support/phase_d_runner';

const hasRealSupabaseEnv = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.DATABASE_URL
);

describe('FRLL Phase D: Real Today Target -> Real Review Answer -> Atomic Learner State Transition (FRLL-08, FRLL-09, FRLL-10)', () => {
  it.skipIf(!hasRealSupabaseEnv)(
    'FRLL-08, FRLL-09, FRLL-10: proves atomic Review transition, competence projection, and idempotent replay',
    async () => {
      const report = await runPhaseDLearningLoop();

      // Overall success
      expect(report.success).toBe(true);

      // Identity & Prerequisites
      expect(report.userId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.languageProfileId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.reviewItemId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.conceptId).toMatch(/^[0-9a-f-]{36}$/);

      // Pre-Answer verification
      expect(report.preAnswerDigest.review_item_count).toBe(1);
      expect(report.preAnswerDigest.fsrs_state_count).toBe(1);
      expect(report.preAnswerDigest.fsrs_states[0].state_version).toBe(1);
      expect(report.preAnswerDigest.fsrs_states[0].state).toBe('new');
      expect(report.preAnswerDigest.fsrs_states[0].last_review_at).toBeNull();
      expect(report.preAnswerDigest.review_event_count).toBe(0);
      expect(report.preAnswerDigest.learning_event_count).toBe(1);
      expect(report.preAnswerDigest.concept_state?.has_projectable_evidence).toBe(false);

      // Review Queue verification
      expect(report.queueItem.reviewItemId).toBe(report.reviewItemId);
      expect(report.queueItem.concept.id).toBe(report.conceptId);
      expect(report.queueItem.memory.isDue).toBe(true);

      // API Answer Response
      expect(report.firstAnswerResponse.reviewItemId).toBe(report.reviewItemId);
      expect(report.firstAnswerResponse.memory.state).not.toBe('new');
      expect(report.firstAnswerResponse.memory.lastReviewedAt).not.toBeNull();
      expect(report.firstAnswerResponse.memory.isDue).toBe(false);
      expect(report.firstAnswerResponse.competence.production.evidenceCount).toBe(1);

      // FRLL-08: FSRS memory transition & review_event creation
      expect(report.postAnswerDigest.review_item_count).toBe(1);
      expect(report.postAnswerDigest.fsrs_state_count).toBe(1);
      const postFsrs = report.postAnswerDigest.fsrs_states[0];
      expect(postFsrs.review_item_id).toBe(report.reviewItemId);
      expect(postFsrs.state_version).toBe(2);
      expect(postFsrs.state).not.toBe('new');
      expect(postFsrs.last_review_at).not.toBeNull();
      expect(postFsrs.due_at).not.toBe(report.preAnswerDigest.fsrs_states[0].due_at);

      expect(report.postAnswerDigest.review_event_count).toBe(1);
      const revEvent = report.postAnswerDigest.review_events[0];
      expect(revEvent.review_item_id).toBe(report.reviewItemId);
      expect(revEvent.idempotency_key).toBe(report.idempotencyKey);
      expect(revEvent.rating).toBe('good');
      expect(revEvent.has_memory_snapshot).toBe(true);
      expect(revEvent.has_competence_snapshot).toBe(true);
      expect(revEvent.result_memory_snapshot).toBeDefined();
      expect(revEvent.result_competence_snapshot).toBeDefined();

      // FRLL-09: Canonical learning event derivation & competence projection
      expect(report.postAnswerDigest.learning_event_count).toBe(2);
      const reviewLearningEvent = report.postAnswerDigest.learning_events.find(
        (ev) => ev.source_type === 'review_event'
      );
      expect(reviewLearningEvent).toBeDefined();
      expect(reviewLearningEvent?.event_type).toBe('learning.review.completed.v1');
      expect(reviewLearningEvent?.source_event_id).toBe(revEvent.id);
      expect(reviewLearningEvent?.ingestion_sequence).toBe(2);

      const conceptState = report.postAnswerDigest.concept_state;
      expect(conceptState).toBeDefined();
      expect(conceptState?.has_projectable_evidence).toBe(true);
      expect(conceptState?.production_evidence_count).toBe(1);
      expect(conceptState?.recognition_evidence_count ?? 0).toBe(0);
      expect(conceptState?.listening_evidence_count ?? 0).toBe(0);

      // FRLL-10: Idempotent replay
      expect(report.replayedAnswerResponse.reviewItemId).toBe(report.firstAnswerResponse.reviewItemId);
      expect(report.replayedAnswerResponse.memory.state).toBe(report.firstAnswerResponse.memory.state);
      expect(report.replayedAnswerResponse.memory.dueAt).toBe(report.firstAnswerResponse.memory.dueAt);
      expect(report.replayedAnswerResponse.memory.lastReviewedAt).toBe(report.firstAnswerResponse.memory.lastReviewedAt);
      expect(report.replayedAnswerResponse.competence.production.evidenceCount).toBe(1);

      expect(report.postReplayDigest.review_item_count).toBe(1);
      expect(report.postReplayDigest.fsrs_state_count).toBe(1);
      expect(report.postReplayDigest.fsrs_states[0]?.state_version).toBe(2);
      expect(report.postReplayDigest.review_event_count).toBe(1);
      expect(report.postReplayDigest.learning_event_count).toBe(2);
      expect(report.postReplayDigest.concept_state?.production_evidence_count).toBe(1);

      // Conflict guard validation
      expect(report.postConflictDigest.fsrs_states[0]?.state_version).toBe(2);
      expect(report.postConflictDigest.review_event_count).toBe(1);
      expect(report.postConflictDigest.learning_event_count).toBe(2);

      // Cleanup & isolation verification
      expect(report.cleanupVerified).toBe(true);
      expect(report.cleanupReport?.authDeleted).toBe(true);
      expect(report.cleanupReport?.postgresClean).toBe(true);
      expect(report.cleanupReport?.postgresDetails.counts.users).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.learner_profiles).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.user_languages).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.review_items).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.fsrs_states).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.review_events).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.learning_events).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.concept_save_intents).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.profile_mutation_results).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.user_concept_states).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.user_saved_concepts).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.today_plans).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.today_plan_activities).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.today_activity_review_items).toBe(0);
      expect(report.cleanupReport?.postgresDetails.anchor_concept_intact).toBe(true);
    },
    120000
  );
});
