import { describe, it, expect } from 'vitest';
import { runPhaseBLearningLoop } from './support/phase_b_runner';

const hasRealSupabaseEnv = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.DATABASE_URL
);

describe('FRLL Phase B: Real Auth + Profile + Save/Learn + First Memory Lineage', () => {
  it.skipIf(!hasRealSupabaseEnv)(
    'FRLL-01..06: executes real disposable learner auth, profile creation, and explicit Save/Learn proof',
    async () => {
      const report = await runPhaseBLearningLoop();

      // FRLL-01 & FRLL-02: Identity parity & chain
      expect(report.success).toBe(true);
      expect(report.userId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.languageProfileId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.postSaveDigest.user_id).toBe(report.userId);
      expect(report.postSaveDigest.profile_time_zone).toBe('Asia/Ho_Chi_Minh');
      expect(report.postSaveDigest.language_profile_ids).toContain(report.languageProfileId);

      // FRLL-03: Zero evidence from passive dictionary discovery
      expect(report.preSaveDigest.is_concept_saved).toBe(false);
      expect(report.preSaveDigest.save_intent_count).toBe(0);
      expect(report.preSaveDigest.review_item_count).toBe(0);
      expect(report.preSaveDigest.fsrs_state_count).toBe(0);
      expect(report.preSaveDigest.learning_event_count).toBe(0);
      expect(report.preSaveDigest.review_event_count).toBe(0);
      expect(report.preSaveDigest.concept_state).toBeNull();

      // FRLL-04: Deterministic anchor concept
      expect(report.conceptId).toBe('7f110000-0000-4000-8000-000000000004');

      // FRLL-05: Explicit Save/Learn activation
      expect(report.postSaveDigest.is_concept_saved).toBe(true);
      expect(report.postSaveDigest.save_intent_count).toBe(1);
      expect(report.postSaveDigest.learning_event_count).toBe(1);
      expect(report.postSaveDigest.concept_state).not.toBeNull();
      expect(report.postSaveDigest.concept_state?.status).toBe('learning');
      expect(report.postSaveDigest.concept_state?.has_learning_intent).toBe(true);
      expect(report.postSaveDigest.concept_state?.has_projectable_evidence).toBe(false);

      // FRLL-06: Exactly one Memory lineage & idempotent repeat
      expect(report.postSaveDigest.review_item_count).toBe(1);
      expect(report.postSaveDigest.fsrs_state_count).toBe(1);
      const fsrsPostSave = report.postSaveDigest.fsrs_states[0];
      expect(fsrsPostSave.state).toBe('new');
      expect(fsrsPostSave.state_version).toBe(1);
      expect(fsrsPostSave.last_review_at).toBeNull();
      expect(fsrsPostSave.due_at).not.toBeNull();

      // Repeated Save idempotence: zero duplicate rows, zero state reset
      expect(report.postResaveDigest.save_intent_count).toBe(1);
      expect(report.postResaveDigest.save_intent_ids[0]).toBe(report.postSaveDigest.save_intent_ids[0]);
      expect(report.postResaveDigest.review_item_count).toBe(1);
      expect(report.postResaveDigest.review_item_ids[0]).toBe(report.postSaveDigest.review_item_ids[0]);
      expect(report.postResaveDigest.fsrs_state_count).toBe(1);
      const fsrsPostResave = report.postResaveDigest.fsrs_states[0];
      expect(fsrsPostResave.state_version).toBe(1);
      expect(fsrsPostResave.state).toBe('new');
      expect(fsrsPostResave.due_at).toBe(fsrsPostSave.due_at);
      expect(report.postResaveDigest.learning_event_count).toBe(1);
      expect(report.postResaveDigest.review_event_count).toBe(0);

      // Cleanup & isolation verification: prove disposable actor & derived state removed completely
      expect(report.cleanupVerified).toBe(true);
      expect(report.cleanupReport?.authDeleted).toBe(true);
      expect(report.cleanupReport?.postgresClean).toBe(true);
      expect(report.cleanupReport?.postgresDetails.counts.users).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.learner_profiles).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.user_languages).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.review_items).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.fsrs_states).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.learning_events).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.concept_save_intents).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.profile_mutation_results).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.user_concept_states).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.user_saved_concepts).toBe(0);
      expect(report.cleanupReport?.postgresDetails.anchor_concept_intact).toBe(true);
    },
    120000
  );
});
