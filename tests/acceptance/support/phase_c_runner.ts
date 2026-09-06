/**
 * First Real Learning Loop (FRLL) - Phase C Acceptance Runner.
 *
 * Implements the deterministic sequence for:
 * C1. Run Phase B prerequisite setup (real auth, profile, timezone Asia/Ho_Chi_Minh, explicit Save/Learn)
 * C2. Confirm pre-Today database state (1 review item, 1 FSRS state in 'new', 0 review events, 0 plans)
 * C3. Call FastAPI GET /v1/today?languageProfileId=<profileId> (server authority, NO timezone param)
 * C4. Assert C-01..C-05 on Today plan response:
 *     - C-01: Plan belongs to same authenticated actor
 *     - C-02: Plan belongs to same active language profile
 *     - C-03: Plan timeZone equals 'Asia/Ho_Chi_Minh'
 *     - C-04: At least 1 activity with activityType === 'review'
 *     - C-05: Review activity maps to exact review_item_id, concept_id, and contains 'FSRS_DUE'
 * C5. Observational PostgreSQL probe proving C-06..C-08:
 *     - C-06: State isolation (review_items count is 1, fsrs_states count is 1)
 *     - C-07: FSRS memory lineage integrity (state='new', state_version=1, due_at unchanged, last_review_at=null)
 *     - C-08: Zero fake review evidence (0 review events, 1 save learning event, today_plans=1)
 * C6. Today plan generation idempotence (C-09): Re-request GET /v1/today returns identical plan ID and 0 duplicate rows
 * C7. Server authority verification (C-10): engineVersion is 'today-heuristic-v1', zero client heuristics
 * C8. Capture ReviewTargetHandoff for Phase D
 * Cleanup: Complete teardown of disposable actor and post-cleanup observational verification
 */

import {
  FRLL_ANCHOR_CONCEPT_ID,
  setupRealLearnerThroughSaveLearn,
  teardownRealLearner,
  type PhaseBCleanupReport,
} from './phase_b_runner';
import {
  captureLearnerDigestFromPostgres,
  type LearnerStateDigest,
} from './postgres_probe_client';

export interface TodayActivityDto {
  readonly id: string;
  readonly position: number;
  readonly activityType: 'review' | 'read' | 'explore' | string;
  readonly title: string;
  readonly description: string;
  readonly estimatedMinutes: number;
  readonly reasonCodes: string[];
  readonly reasonText: string;
  readonly status: string;
  readonly targetCount?: number | null;
  readonly completedCount: number;
  readonly contentId?: string | null;
  readonly conceptId?: string | null;
  readonly reviewItemId?: string | null;
  readonly completedAt?: string | null;
  readonly createdAt: string;
}

export interface TodayPlanDto {
  readonly id: string;
  readonly languageProfileId: string;
  readonly planDate: string;
  readonly timeZone: string;
  readonly targetMinutes: number;
  readonly completedMinutes: number;
  readonly status: string;
  readonly engineVersion: string;
  readonly activities: readonly TodayActivityDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function parseTodayPlanResponse(json: unknown): TodayPlanDto {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('Invalid /v1/today response: missing data envelope');
  }
  const data = (json as { data: unknown }).data;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid /v1/today response: data is not an object');
  }
  const d = data as Record<string, unknown>;

  if (typeof d.id !== 'string' || !d.id) {
    throw new Error('Invalid /v1/today response: missing or invalid data.id');
  }
  if (typeof d.languageProfileId !== 'string' || !d.languageProfileId) {
    throw new Error('Invalid /v1/today response: missing or invalid data.languageProfileId');
  }
  if (typeof d.planDate !== 'string' || !d.planDate) {
    throw new Error('Invalid /v1/today response: missing or invalid data.planDate');
  }
  if (typeof d.timeZone !== 'string' || !d.timeZone) {
    throw new Error('Invalid /v1/today response: missing or invalid data.timeZone');
  }
  if (typeof d.engineVersion !== 'string' || !d.engineVersion) {
    throw new Error('Invalid /v1/today response: missing or invalid data.engineVersion');
  }
  if (!Array.isArray(d.activities)) {
    throw new Error('Invalid /v1/today response: data.activities is not an array');
  }

  const activities: TodayActivityDto[] = d.activities.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid /v1/today response: activity at index ${index} is not an object`);
    }
    const act = item as Record<string, unknown>;
    if (typeof act.id !== 'string' || !act.id) {
      throw new Error(`Invalid /v1/today response: activity at index ${index} missing id`);
    }
    if (typeof act.activityType !== 'string' || !act.activityType) {
      throw new Error(`Invalid /v1/today response: activity at index ${index} missing activityType`);
    }
    if (!Array.isArray(act.reasonCodes)) {
      throw new Error(`Invalid /v1/today response: activity at index ${index} reasonCodes is not an array`);
    }

    return {
      id: act.id,
      position: typeof act.position === 'number' ? act.position : index,
      activityType: act.activityType,
      title: typeof act.title === 'string' ? act.title : '',
      description: typeof act.description === 'string' ? act.description : '',
      estimatedMinutes: typeof act.estimatedMinutes === 'number' ? act.estimatedMinutes : 0,
      reasonCodes: act.reasonCodes.map((r) => String(r)),
      reasonText: typeof act.reasonText === 'string' ? act.reasonText : '',
      status: typeof act.status === 'string' ? act.status : 'pending',
      targetCount: typeof act.targetCount === 'number' ? act.targetCount : null,
      completedCount: typeof act.completedCount === 'number' ? act.completedCount : 0,
      contentId: typeof act.contentId === 'string' ? act.contentId : null,
      conceptId: typeof act.conceptId === 'string' ? act.conceptId : null,
      reviewItemId: typeof act.reviewItemId === 'string' ? act.reviewItemId : null,
      completedAt: typeof act.completedAt === 'string' ? act.completedAt : null,
      createdAt: typeof act.createdAt === 'string' ? act.createdAt : '',
    };
  });

  return {
    id: d.id,
    languageProfileId: d.languageProfileId,
    planDate: d.planDate,
    timeZone: d.timeZone,
    targetMinutes: typeof d.targetMinutes === 'number' ? d.targetMinutes : 15,
    completedMinutes: typeof d.completedMinutes === 'number' ? d.completedMinutes : 0,
    status: typeof d.status === 'string' ? d.status : 'active',
    engineVersion: d.engineVersion,
    activities,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : '',
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
  };
}

export interface ReviewTargetHandoff {
  readonly actorId: string;
  readonly languageProfileId: string;
  readonly conceptId: string;
  readonly reviewItemId: string;
  readonly todayPlanId: string;
  readonly todayActivityId: string;
}

export interface PhaseCOptions {
  readonly apiBaseUrl?: string;
  readonly conceptId?: string;
  readonly targetLanguageCode?: string;
  readonly nativeLanguageCode?: string;
  readonly timeZone?: string;
  readonly goal?: string;
  readonly dailyMinutes?: number;
}

export interface PhaseCReport {
  readonly success: boolean;
  readonly userId: string;
  readonly languageProfileId: string;
  readonly conceptId: string;
  readonly reviewItemId: string;
  readonly todayPlan: TodayPlanDto;
  readonly reviewActivity: TodayActivityDto;
  readonly handoff: ReviewTargetHandoff;
  readonly preTodayDigest: LearnerStateDigest;
  readonly postTodayDigest: LearnerStateDigest;
  readonly postRequeryDigest: LearnerStateDigest;
  readonly durationMs: number;
  readonly cleanupVerified: boolean;
  readonly cleanupReport?: PhaseBCleanupReport;
}

export async function runPhaseCLearningLoop(
  options: PhaseCOptions = {}
): Promise<PhaseCReport> {
  const startTime = Date.now();
  const conceptId = options.conceptId ?? FRLL_ANCHOR_CONCEPT_ID;
  const expectedTimeZone = options.timeZone ?? 'Asia/Ho_Chi_Minh';

  let provisionedUserId: string | null = null;
  let resultReport: PhaseCReport | null = null;

  try {
    // -------------------------------------------------------------------------
    // C1. Setup real learner through Save/Learn (Phase B flow)
    // -------------------------------------------------------------------------
    console.log('[Phase C][1/6] Running Phase B setup: real auth, profile, and explicit Save/Learn...');
    const context = await setupRealLearnerThroughSaveLearn({
      ...options,
      tag: 'phase-c',
      onUserCreated: (uid) => {
        provisionedUserId = uid;
      },
    });

    const reviewItemId = context.reviewItemId;
    const preTodayDigest = context.postSaveDigest;

    // Confirm pre-Today database invariants
    if (preTodayDigest.review_item_count !== 1) {
      throw new Error(`FRLL-06 failure: pre-Today review_item_count is ${preTodayDigest.review_item_count} (expected 1).`);
    }
    if (preTodayDigest.fsrs_state_count !== 1) {
      throw new Error(`FRLL-06 failure: pre-Today fsrs_state_count is ${preTodayDigest.fsrs_state_count} (expected 1).`);
    }
    const preFsrs = preTodayDigest.fsrs_states[0];
    if (preFsrs.state !== 'new') {
      throw new Error(`FRLL-06 failure: pre-Today FSRS state is '${preFsrs.state}' (expected 'new').`);
    }
    if (preFsrs.state_version !== 1) {
      throw new Error(`FRLL-06 failure: pre-Today FSRS state_version is ${preFsrs.state_version} (expected 1).`);
    }
    if (!preFsrs.due_at) {
      throw new Error('FRLL-06 failure: pre-Today FSRS due_at is null.');
    }
    if (preFsrs.last_review_at !== null) {
      throw new Error('FRLL-06 failure: pre-Today FSRS last_review_at must be null.');
    }
    if (preTodayDigest.review_event_count !== 0) {
      throw new Error(`FRLL-06 failure: pre-Today review_event_count is ${preTodayDigest.review_event_count} (expected 0).`);
    }
    if (preTodayDigest.today_plan_count !== 0) {
      throw new Error(`FRLL-07 failure: pre-Today today_plan_count is ${preTodayDigest.today_plan_count} (expected 0).`);
    }

    console.log(`  [OK] Pre-Today invariants verified: review_item_id=${reviewItemId}, FSRS state=new, due_at=${preFsrs.due_at}`);

    // -------------------------------------------------------------------------
    // C2. Call FastAPI GET /v1/today (server authority, NO timezone param)
    // -------------------------------------------------------------------------
    console.log('[Phase C][2/6] Calling GET /v1/today (server-side authority, no timezone query parameter)...');
    const todayUrl = `${context.apiBaseUrl}/v1/today?languageProfileId=${encodeURIComponent(context.languageProfileId)}`;
    const todayRes = await fetch(todayUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (todayRes.status !== 200) {
      const errBody = await todayRes.text();
      throw new Error(`FRLL-07 failure: GET /v1/today returned HTTP ${todayRes.status}: ${errBody}`);
    }

    const todayPlan = parseTodayPlanResponse(await todayRes.json());
    console.log(`  [OK] Today plan generated: planId=${todayPlan.id}, planDate=${todayPlan.planDate}, timeZone=${todayPlan.timeZone}`);

    // -------------------------------------------------------------------------
    // C3. Validate TodayPlan response (C-01..C-05, C-10)
    // -------------------------------------------------------------------------
    console.log('[Phase C][3/6] Validating Today plan contract & scheduling assertions (C-01..C-05, C-10)...');

    // C-02: Profile parity
    if (todayPlan.languageProfileId !== context.languageProfileId) {
      throw new Error(
        `FRLL-07 C-02 failure: todayPlan.languageProfileId (${todayPlan.languageProfileId}) != active profile (${context.languageProfileId}).`
      );
    }

    // C-03: Persisted timezone authority
    if (todayPlan.timeZone !== expectedTimeZone) {
      throw new Error(
        `FRLL-07 C-03 failure: todayPlan.timeZone (${todayPlan.timeZone}) != expected profile timezone (${expectedTimeZone}).`
      );
    }

    // C-10: Engine version
    if (todayPlan.engineVersion !== 'today-heuristic-v1') {
      throw new Error(
        `FRLL-07 C-10 failure: todayPlan.engineVersion is '${todayPlan.engineVersion}' (expected 'today-heuristic-v1').`
      );
    }

    // C-04: At least one review activity
    const reviewActivities = todayPlan.activities.filter((a) => a.activityType === 'review');
    if (reviewActivities.length === 0) {
      throw new Error(
        `FRLL-07 C-04 failure: Today plan contains 0 review activities (total activities: ${todayPlan.activities.length}).`
      );
    }

    // C-05: Exact review target mapping & FSRS_DUE reason
    const targetActivity = reviewActivities.find(
      (a) => a.reviewItemId === reviewItemId || a.conceptId === conceptId
    );
    if (!targetActivity) {
      throw new Error(
        `FRLL-07 C-05 failure: No review activity found mapping to reviewItemId=${reviewItemId} or conceptId=${conceptId}.`
      );
    }
    if (targetActivity.reviewItemId !== reviewItemId) {
      throw new Error(
        `FRLL-07 C-05 failure: Review activity reviewItemId (${targetActivity.reviewItemId}) != ${reviewItemId}.`
      );
    }
    if (targetActivity.conceptId !== conceptId) {
      throw new Error(
        `FRLL-07 C-05 failure: Review activity conceptId (${targetActivity.conceptId}) != ${conceptId}.`
      );
    }
    if (!targetActivity.reasonCodes.includes('FSRS_DUE')) {
      throw new Error(
        `FRLL-07 C-05 failure: Review activity reasonCodes (${JSON.stringify(targetActivity.reasonCodes)}) does not include 'FSRS_DUE'.`
      );
    }

    console.log(`  [OK] C-01..C-05 & C-10 passed: Target activity ${targetActivity.id} maps review_item_id=${reviewItemId} with FSRS_DUE.`);

    // -------------------------------------------------------------------------
    // C4. Observational PostgreSQL probe proving C-06..C-08
    // -------------------------------------------------------------------------
    console.log('[Phase C][4/6] Observational PostgreSQL proof: verifying C-06..C-08...');
    const postTodayDigest = await captureLearnerDigestFromPostgres(context.user.id, conceptId);

    // C-01 (DB actor parity): Today plan row belongs to user
    if (postTodayDigest.today_plan_count !== 1) {
      throw new Error(
        `FRLL-07 failure: DB today_plan_count is ${postTodayDigest.today_plan_count} (expected exactly 1).`
      );
    }
    if (!postTodayDigest.today_plan_ids.includes(todayPlan.id)) {
      throw new Error(
        `FRLL-07 failure: DB today_plan_ids does not contain API plan ID ${todayPlan.id}.`
      );
    }
    if (!postTodayDigest.today_activity_review_item_ids.includes(reviewItemId)) {
      throw new Error(
        `FRLL-07 failure: DB today_activity_review_item_ids does not contain ${reviewItemId}.`
      );
    }

    // C-06: State isolation (zero new review items created)
    if (postTodayDigest.review_item_count !== 1) {
      throw new Error(
        `FRLL-07 C-06 failure: review_item_count after Today is ${postTodayDigest.review_item_count} (expected 1).`
      );
    }
    if (postTodayDigest.review_item_ids[0] !== reviewItemId) {
      throw new Error('FRLL-07 C-06 failure: review_item_id mutated after Today generation.');
    }
    if (postTodayDigest.fsrs_state_count !== 1) {
      throw new Error(
        `FRLL-07 C-06 failure: fsrs_state_count after Today is ${postTodayDigest.fsrs_state_count} (expected 1).`
      );
    }

    // C-07: FSRS memory lineage integrity
    const postFsrs = postTodayDigest.fsrs_states[0];
    if (postFsrs.review_item_id !== reviewItemId) {
      throw new Error('FRLL-07 C-07 failure: FSRS state review_item_id mismatch.');
    }
    if (postFsrs.state !== 'new') {
      throw new Error(`FRLL-07 C-07 failure: FSRS state mutated to '${postFsrs.state}' (expected 'new').`);
    }
    if (postFsrs.state_version !== 1) {
      throw new Error(`FRLL-07 C-07 failure: FSRS state_version mutated to ${postFsrs.state_version} (expected 1).`);
    }
    if (postFsrs.due_at !== preFsrs.due_at) {
      throw new Error(`FRLL-07 C-07 failure: FSRS due_at mutated: ${postFsrs.due_at} != ${preFsrs.due_at}`);
    }
    if (postFsrs.last_review_at !== null) {
      throw new Error('FRLL-07 C-07 failure: FSRS last_review_at mutated to non-null before review.');
    }

    // C-08: Zero fake review evidence
    if (postTodayDigest.review_event_count !== 0) {
      throw new Error(
        `FRLL-07 C-08 failure: review_event_count is ${postTodayDigest.review_event_count} (expected 0 before Review).`
      );
    }
    if (postTodayDigest.learning_event_count !== 1) {
      throw new Error(
        `FRLL-07 C-08 failure: learning_event_count is ${postTodayDigest.learning_event_count} (expected 1 save event).`
      );
    }
    if (postTodayDigest.concept_state?.has_projectable_evidence !== false) {
      throw new Error('FRLL-07 C-08 failure: concept_state has_projectable_evidence became true from Today.');
    }

    console.log('  [OK] C-06..C-08 verified: Memory lineage unchanged, 0 fake review evidence, exact DB plan mapping.');

    // -------------------------------------------------------------------------
    // C5. Today plan generation idempotence (C-09)
    // -------------------------------------------------------------------------
    console.log('[Phase C][5/6] Re-requesting GET /v1/today to verify plan generation idempotence (C-09)...');
    const requeryRes = await fetch(todayUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${context.session.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (requeryRes.status !== 200) {
      const errBody = await requeryRes.text();
      throw new Error(`FRLL-07 C-09 failure: Re-query GET /v1/today returned HTTP ${requeryRes.status}: ${errBody}`);
    }

    const requeryPlan = parseTodayPlanResponse(await requeryRes.json());
    if (requeryPlan.id !== todayPlan.id) {
      throw new Error(
        `FRLL-07 C-09 failure: Re-requested plan ID (${requeryPlan.id}) != first plan ID (${todayPlan.id}).`
      );
    }

    const postRequeryDigest = await captureLearnerDigestFromPostgres(context.user.id, conceptId);
    if (postRequeryDigest.today_plan_count !== 1) {
      throw new Error(
        `FRLL-07 C-09 failure: today_plan_count duplicated on re-query: ${postRequeryDigest.today_plan_count}`
      );
    }
    if (postRequeryDigest.review_item_count !== 1) {
      throw new Error(
        `FRLL-07 C-09 failure: review_item_count changed on re-query: ${postRequeryDigest.review_item_count}`
      );
    }

    console.log('  [OK] C-09 verified: Re-request returns identical plan ID and creates 0 duplicate rows.');

    // -------------------------------------------------------------------------
    // C6. Construct Review Target Handoff
    // -------------------------------------------------------------------------
    const handoff: ReviewTargetHandoff = {
      actorId: context.user.id,
      languageProfileId: context.languageProfileId,
      conceptId,
      reviewItemId,
      todayPlanId: todayPlan.id,
      todayActivityId: targetActivity.id,
    };

    console.log(`  [OK] Review Target Handoff ready: actorId=${handoff.actorId}, reviewItemId=${handoff.reviewItemId}, activityId=${handoff.todayActivityId}`);

    const durationMs = Date.now() - startTime;
    resultReport = {
      success: true,
      userId: context.user.id,
      languageProfileId: context.languageProfileId,
      conceptId,
      reviewItemId,
      todayPlan,
      reviewActivity: targetActivity,
      handoff,
      preTodayDigest,
      postTodayDigest,
      postRequeryDigest,
      durationMs,
      cleanupVerified: false,
    };
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: Scoped teardown of disposable actor state & verification
    // -------------------------------------------------------------------------
    if (provisionedUserId) {
      try {
        console.log(`[Phase C][6/6] Tearing down application state for disposable user ${provisionedUserId}...`);
        const cleanupReport = await teardownRealLearner(provisionedUserId, conceptId);
        if (resultReport) {
          resultReport = {
            ...resultReport,
            cleanupVerified: true,
            cleanupReport,
          };
        }
      } catch (cleanupErr) {
        console.error('[Phase C][Cleanup] Teardown encountered error:', cleanupErr);
        throw cleanupErr;
      }
    }
  }

  return resultReport!;
}
