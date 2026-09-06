import { describe, it, expect } from 'vitest';
import { runPhaseELearningLoop } from './support/phase_e_runner';

const hasRealSupabaseEnv = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.DATABASE_URL
);

describe('FRLL Phase E: Real Review Competence -> Brain Read-Only Projection (FRLL-12)', () => {
  it.skipIf(!hasRealSupabaseEnv)(
    'FRLL-12: proves Brain projects authoritative PostgreSQL competence and performs zero writes',
    async () => {
      const report = await runPhaseELearningLoop();

      // 1. Overall scenario success
      expect(report.success).toBe(true);

      // 2. Identity chain preservation
      expect(report.userId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.languageProfileId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.conceptId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.reviewItemId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.reviewEventId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.reviewLearningEventId).toMatch(/^[0-9a-f-]{36}$/);

      // 3. Pre-Brain PostgreSQL State Invariant Verification
      expect(report.preBrainDigest.review_item_count).toBe(1);
      expect(report.preBrainDigest.fsrs_state_count).toBe(1);
      expect(report.preBrainDigest.fsrs_states[0].state_version).toBe(2);
      expect(report.preBrainDigest.fsrs_states[0].state).not.toBe('new');
      expect(report.preBrainDigest.fsrs_states[0].last_review_at).not.toBeNull();
      expect(report.preBrainDigest.review_event_count).toBe(1);
      expect(report.preBrainDigest.learning_event_count).toBe(2);

      const dbConcept = report.preBrainDigest.concept_state;
      expect(dbConcept).toBeDefined();
      expect(dbConcept?.has_projectable_evidence).toBe(true);
      expect(dbConcept?.production_evidence_count).toBe(1);
      expect(dbConcept?.recognition_evidence_count ?? 0).toBe(0);
      expect(dbConcept?.listening_evidence_count ?? 0).toBe(0);

      // 4. Brain Concept Detail Projection Verification (FRLL-12)
      const detail = report.brainConceptDetail;
      expect(detail.concept.id).toBe(report.conceptId);
      expect(detail.concept.canonicalForm).toBe('frll-anchor');

      // Synthetic-zero distinction: MUST be backed by real learner state
      expect(detail.status).not.toBe('unseen');
      expect(detail.status).toBe(dbConcept?.status);
      expect(detail.mastery).toBe(dbConcept?.mastery);
      expect(detail.confidence).toBe(dbConcept?.confidence);
      expect(detail.memory).not.toBeNull();

      // Memory snapshot matches PostgreSQL FSRS state
      const dbFsrs = report.preBrainDigest.fsrs_states[0];
      expect(detail.memory?.state).toBe(dbFsrs.state);
      expect(new Date(detail.memory!.dueAt).getTime()).toBe(new Date(dbFsrs.due_at).getTime());
      expect(new Date(detail.memory!.lastReviewedAt!).getTime()).toBe(new Date(dbFsrs.last_review_at!).getTime());
      expect(detail.memory?.isDue).toBe(false);

      // Competence projection matches PostgreSQL authority
      expect(detail.competence.production.evidenceCount).toBe(1);
      expect(detail.competence.production.score).toBeCloseTo(Number(dbConcept?.production), 3);
      expect(detail.competence.recognition.score).toBe(0.5);
      expect(detail.competence.recognition.confidence).toBe(0);
      expect(detail.competence.recognition.evidenceCount).toBe(0);
      expect(detail.competence.listening.score).toBe(0.5);
      expect(detail.competence.listening.confidence).toBe(0);
      expect(detail.competence.listening.evidenceCount).toBe(0);

      // Evidence counts
      expect(detail.evidence.reviewCount).toBe(1);
      expect(detail.evidence.exposureCount).toBe(0);

      // 5. Brain Summary & List Cross-Checks
      if (report.brainSummary) {
        expect(report.brainSummary.languageProfileId).toBe(report.languageProfileId);
        expect(report.brainSummary.statusCounts.learning).toBeGreaterThanOrEqual(1);
      }
      if (report.brainConceptList) {
        const found = report.brainConceptList.items.find((item) => item.concept.id === report.conceptId);
        expect(found).toBeDefined();
        expect(found?.concept.status).toBe('learning');
        expect(found?.competence.production.evidenceCount).toBe(1);
      }

      // 6. Read-Only Invariant Proof: Zero writes during Brain GET calls
      expect(report.postBrainDigest.review_item_count).toBe(report.preBrainDigest.review_item_count);
      expect(report.postBrainDigest.fsrs_state_count).toBe(report.preBrainDigest.fsrs_state_count);
      expect(report.postBrainDigest.fsrs_states[0].state_version).toBe(report.preBrainDigest.fsrs_states[0].state_version);
      expect(report.postBrainDigest.review_event_count).toBe(report.preBrainDigest.review_event_count);
      expect(report.postBrainDigest.learning_event_count).toBe(report.preBrainDigest.learning_event_count);
      expect(JSON.stringify(report.postBrainDigest.concept_state)).toBe(JSON.stringify(report.preBrainDigest.concept_state));
      expect(JSON.stringify(report.postBrainDigest.skill_states)).toBe(JSON.stringify(report.preBrainDigest.skill_states));
      expect(JSON.stringify(report.postBrainDigest.today_plans)).toBe(JSON.stringify(report.preBrainDigest.today_plans));

      // 7. Canonical Cleanup Verification
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
