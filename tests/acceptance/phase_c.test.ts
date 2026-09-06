import { describe, it, expect } from 'vitest';
import { runPhaseCLearningLoop } from './support/phase_c_runner';

const hasRealSupabaseEnv = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.DATABASE_URL
);

describe('FRLL Phase C: Real Memory Lineage -> Real Today Review Target (FRLL-07)', () => {
  it.skipIf(!hasRealSupabaseEnv)(
    'FRLL-07: proves server Today Engine selects Save/Learn Memory lineage as Review target',
    async () => {
      const report = await runPhaseCLearningLoop();

      // Overall success
      expect(report.success).toBe(true);

      // C-01 & C-02: Identity parity & active language profile authority
      expect(report.userId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.languageProfileId).toMatch(/^[0-9a-f-]{36}$/);
      expect(report.todayPlan.languageProfileId).toBe(report.languageProfileId);

      // C-03: Persisted timezone authority
      expect(report.todayPlan.timeZone).toBe('Asia/Ho_Chi_Minh');

      // C-04: At least one review activity selected
      expect(report.todayPlan.activities.some((a) => a.activityType === 'review')).toBe(true);

      // C-05: Authoritative Review target mapping
      expect(report.reviewActivity.activityType).toBe('review');
      expect(report.reviewActivity.reviewItemId).toBe(report.reviewItemId);
      expect(report.reviewActivity.conceptId).toBe(report.conceptId);
      expect(report.reviewActivity.reasonCodes).toContain('FSRS_DUE');

      // C-06: State isolation (zero new review items created)
      expect(report.postTodayDigest.review_item_count).toBe(1);
      expect(report.postTodayDigest.review_item_ids[0]).toBe(report.reviewItemId);
      expect(report.postTodayDigest.fsrs_state_count).toBe(1);

      // C-07: FSRS memory lineage integrity
      const postFsrs = report.postTodayDigest.fsrs_states[0];
      expect(postFsrs.review_item_id).toBe(report.reviewItemId);
      expect(postFsrs.state).toBe('new');
      expect(postFsrs.state_version).toBe(1);
      expect(postFsrs.due_at).toBe(report.preTodayDigest.fsrs_states[0].due_at);
      expect(postFsrs.last_review_at).toBeNull();

      // C-08: Zero fake review evidence & database plan mapping
      expect(report.postTodayDigest.review_event_count).toBe(0);
      expect(report.postTodayDigest.learning_event_count).toBe(1);
      expect(report.postTodayDigest.today_plan_count).toBe(1);
      expect(report.postTodayDigest.today_plan_ids).toContain(report.todayPlan.id);
      expect(report.postTodayDigest.today_activity_review_item_ids).toContain(report.reviewItemId);

      // C-09: Today plan generation idempotence
      expect(report.postRequeryDigest.today_plan_count).toBe(1);
      expect(report.postRequeryDigest.review_item_count).toBe(1);

      // C-10: Server-side engine version
      expect(report.todayPlan.engineVersion).toBe('today-heuristic-v1');

      // Review Target Handoff for Phase D
      expect(report.handoff).toBeDefined();
      expect(report.handoff.actorId).toBe(report.userId);
      expect(report.handoff.languageProfileId).toBe(report.languageProfileId);
      expect(report.handoff.conceptId).toBe(report.conceptId);
      expect(report.handoff.reviewItemId).toBe(report.reviewItemId);
      expect(report.handoff.todayPlanId).toBe(report.todayPlan.id);
      expect(report.handoff.todayActivityId).toBe(report.reviewActivity.id);

      // Cleanup & isolation verification
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
      expect(report.cleanupReport?.postgresDetails.counts.today_plans).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.today_plan_activities).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.today_activity_review_items).toBe(0);
      expect(report.cleanupReport?.postgresDetails.anchor_concept_intact).toBe(true);
    },
    120000
  );
});
