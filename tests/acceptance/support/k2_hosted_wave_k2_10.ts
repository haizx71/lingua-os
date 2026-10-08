import { randomUUID } from 'node:crypto';
import type { components } from '../../../packages/types/src/generated/openapi';
import {
  assertExact,
  assertPersistedCompetence,
  assertProjectionNumber,
  assertTimestamp,
} from './persisted_assertions';
import { assertNoLearningMutation } from './r1_assertions';
import { validateContract } from './contract_validation';
import {
  type K2HostedWaveContext,
  type K2HostedWavePlugin,
} from './k2_hosted_runner';
import type { K2HostedFrllSemanticProof, K2RetainedSnapshot } from './k2_hosted_probe_client';

const FRLL_ANCHOR_ID = '7f110000-0000-4000-8000-000000000004';
const TODAY_COORDINATION_TABLES = new Set([
  'today_plans', 'today_plan_activities', 'today_activity_review_items',
]);
const REVIEW_TRANSITION_TABLES = new Set([
  'fsrs_states', 'review_items', 'review_events', 'learning_events',
  'user_concept_states', 'user_language_projection_heads', 'user_skill_states',
]);

function fail(message: string): never { throw new Error(message); }

function contractData<T>(name: keyof components['schemas'], payload: unknown): T {
  try { return (validateContract(name, payload) as { readonly data: unknown }).data as T; }
  catch { return fail(`K2 hosted acceptance FRLL ${name} contract was invalid.`); }
}

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) fail(message);
}

export function assertTodayCoordinationOnly(before: K2RetainedSnapshot, after: K2RetainedSnapshot): void {
  const learnerTables = (snapshot: K2RetainedSnapshot) => Object.fromEntries(
    Object.entries(snapshot.tables).filter(([table]) => !TODAY_COORDINATION_TABLES.has(table)),
  );
  assertNoLearningMutation(learnerTables(before), learnerTables(after));
}

function frllTableCounts(proof: K2HostedFrllSemanticProof): Readonly<Record<string, number>> {
  return {
    fsrs_states: proof.save.fsrsStateRows,
    review_items: proof.save.reviewItemRows,
    review_events: proof.review.eventRows,
    learning_events: proof.save.saveLearningEventRows + proof.review.reviewLearningEventRows,
    user_concept_states: proof.concept.rowCount,
    user_language_projection_heads: proof.projection.headRows,
    user_skill_states: proof.projection.skillRows,
  };
}

function skillProof(
  proof: K2HostedFrllSemanticProof,
  skill: 'recognition' | 'listening' | 'production',
): K2HostedFrllSemanticProof['projection']['skills'][number] {
  const result = proof.projection.skills.find(item => item.skill === skill);
  if (!result) fail('K2 hosted acceptance FRLL Review projection omitted a fixed competence dimension.');
  return result;
}

/** Proves one expected persisted Review transition and rejects every other learner-table delta. */
export function assertReviewTransition(
  before: K2RetainedSnapshot,
  after: K2RetainedSnapshot,
  beforeProof: K2HostedFrllSemanticProof,
  afterProof: K2HostedFrllSemanticProof,
  requireKeyMatch = false,
): void {
  assertSavedState(beforeProof);
  assertReviewedState(afterProof, requireKeyMatch);
  assertExact(afterProof.identity, beforeProof.identity, 'FRLL Review actor identity');
  assertExact(afterProof.save, beforeProof.save, 'FRLL Review Save lineage');
  assertExact(beforeProof.review.eventRows, 0, 'FRLL pre-answer review event count');
  assertExact(beforeProof.review.reviewLearningEventRows, 0, 'FRLL pre-answer review learning event count');
  assertExact(afterProof.review.exerciseMode, 'self_recall', 'FRLL persisted Review exercise mode');
  assertExact(afterProof.review.evidenceMode, 'production', 'FRLL self-recall evidence mode');
  requireCondition(
    afterProof.review.correct === null || afterProof.review.correct === true,
    'K2 hosted acceptance FRLL self-recall correctness did not match the accepted Good answer.',
  );

  const expectedBefore = frllTableCounts(beforeProof);
  const expectedAfter = frllTableCounts(afterProof);
  for (const table of REVIEW_TRANSITION_TABLES) {
    const beforeTable = before.tables[table as keyof K2RetainedSnapshot['tables']];
    const afterTable = after.tables[table as keyof K2RetainedSnapshot['tables']];
    assertExact(beforeTable.rows, expectedBefore[table], `FRLL pre-answer ${table} rows`);
    assertExact(afterTable.rows, expectedAfter[table], `FRLL post-answer ${table} rows`);
    requireCondition(
      beforeTable.sha256 !== afterTable.sha256,
      `K2 hosted acceptance FRLL Review expected a persisted ${table} transition.`,
    );
  }
  assertExact(afterProof.review.eventRows, beforeProof.review.eventRows + 1, 'FRLL Review event delta');
  assertExact(
    afterProof.review.reviewLearningEventRows,
    beforeProof.review.reviewLearningEventRows + 1,
    'FRLL Review learning event delta',
  );
  assertExact(afterProof.memory.stateVersion, (beforeProof.memory.stateVersion ?? 0) + 1, 'FRLL Memory version delta');
  assertExact(afterProof.concept.stateVersion, (beforeProof.concept.stateVersion ?? 0) + 1, 'FRLL concept projection version delta');

  requireCondition(
    beforeProof.projection.headRows === 1 && beforeProof.projection.skillRows === 3 &&
    afterProof.projection.headRows === beforeProof.projection.headRows &&
    afterProof.projection.skillRows === beforeProof.projection.skillRows,
    'K2 hosted acceptance FRLL Review changed projection row cardinality.',
  );
  assertExact(
    afterProof.projection.nextIngestionSequence,
    (beforeProof.projection.nextIngestionSequence ?? 0) + 1,
    'FRLL projection ingestion sequence delta',
  );
  assertExact(
    afterProof.projection.stateVersion,
    (beforeProof.projection.stateVersion ?? 0) + 1,
    'FRLL projection head version delta',
  );
  for (const dimension of ['recognition', 'listening'] as const) {
    assertExact(afterProof.concept[dimension], beforeProof.concept[dimension], `FRLL ${dimension} concept isolation`);
    assertExact(skillProof(afterProof, dimension), skillProof(beforeProof, dimension), `FRLL ${dimension} skill isolation`);
  }
  const beforeProduction = beforeProof.concept.production;
  const afterProduction = afterProof.concept.production;
  assertExact(afterProduction.evidenceCount, (beforeProduction.evidenceCount ?? 0) + 1, 'FRLL production concept evidence delta');
  requireCondition(afterProduction.lastEvidenceAt !== null, 'K2 hosted acceptance FRLL production evidence timestamp was not persisted.');
  const beforeProductionSkill = skillProof(beforeProof, 'production');
  const afterProductionSkill = skillProof(afterProof, 'production');
  assertExact(afterProductionSkill.evidenceCount, beforeProductionSkill.evidenceCount + 1, 'FRLL production skill evidence delta');
  assertExact(afterProductionSkill.stateVersion, beforeProductionSkill.stateVersion + 1, 'FRLL production skill version delta');
  requireCondition(afterProductionSkill.lastEvidenceAt !== null, 'K2 hosted acceptance FRLL production skill timestamp was not persisted.');

  for (const table of Object.keys(before.tables) as Array<keyof K2RetainedSnapshot['tables']>) {
    if (TODAY_COORDINATION_TABLES.has(table) || REVIEW_TRANSITION_TABLES.has(table)) continue;
    assertExact(before.tables[table], after.tables[table], `FRLL unrelated learner table ${table}`);
  }
}

export function assertFreshProfile(profile: components['schemas']['LanguageProfile']): void {
  requireCondition(
    profile.targetLanguageCode === 'en' && profile.nativeLanguageCode === 'vi' &&
    profile.goal === 'communication' && profile.dailyMinutes === 15 &&
    profile.targetLevel === null && profile.startingLevelEstimate === null && profile.status === 'active',
    'K2 hosted acceptance FRLL fresh profile DTO did not match the fixed bootstrap contract.',
  );
}

export function assertSavedState(proof: K2HostedFrllSemanticProof): void {
  requireCondition(
    proof.identity.userRows === 1 && proof.identity.learnerProfileRows === 1 &&
    proof.identity.languageProfileRows === 1 && proof.identity.profileBound &&
    proof.save.savedMembershipRows === 1 && proof.save.saveIntentRows === 1 &&
    proof.save.saveLearningEventRows === 1 && proof.save.reviewItemRows === 1 &&
    proof.save.fsrsStateRows === 1 && proof.concept.rowCount === 1 &&
    proof.concept.hasLearningIntent === true && proof.concept.hasProjectableEvidence === false &&
    proof.concept.mastery === null && proof.concept.confidence !== null &&
    proof.concept.exposureCount === 0 && proof.concept.lastSeenAt === null &&
    proof.memory.rowCount === 1 && proof.memory.stateVersion === 1 &&
    proof.memory.state === 'new' && proof.memory.dueAt !== null &&
    proof.memory.lastReviewedAt === null && proof.memory.difficulty === null &&
    proof.memory.stability === null && proof.memory.step === null &&
    proof.review.eventRows === 0,
    'K2 hosted acceptance FRLL Save did not create exactly one intent and primary Memory lineage.',
  );
  assertProjectionNumber(proof.concept.confidence, 0, 'FRLL fresh Save concept confidence');
}

// Review receipts retain the FSRS float; fsrs_states stores it at the column's fixed scale.
function fsrsColumnValue(value: unknown, label: string, columnType: string): bigint {
  if (typeof value !== 'string' || value.length > 64) {
    throw new Error(`${label}: differs from persisted ${columnType} authority.`);
  }
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[Ee]([+-]?\d+))?$/.exec(value);
  if (!match) throw new Error(`${label}: differs from persisted ${columnType} authority.`);
  const exponent = match[4] === undefined ? 0 : Number(match[4]);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 64) {
    throw new Error(`${label}: differs from persisted ${columnType} authority.`);
  }
  const fraction = match[3] ?? '';
  const digits = BigInt(`${match[2]}${fraction}`);
  const shift = 4 - fraction.length + exponent;
  let scaled: bigint;
  if (shift >= 0) {
    if (shift > 64) throw new Error(`${label}: differs from persisted ${columnType} authority.`);
    scaled = digits * 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    const whole = digits / divisor;
    const remainder = digits % divisor;
    scaled = whole + (remainder * 2n >= divisor ? 1n : 0n);
  }
  return match[1] === '-' ? -scaled : scaled;
}

function assertFsrsNumericStorage(
  receipt: unknown,
  persisted: unknown,
  label: string,
  columnType: string,
  minimum: bigint,
  maximum: bigint,
): void {
  const receiptValue = fsrsColumnValue(receipt, label, columnType);
  const persistedValue = fsrsColumnValue(persisted, label, columnType);
  if (receiptValue < minimum || receiptValue > maximum ||
      persistedValue < minimum || persistedValue > maximum || receiptValue !== persistedValue) {
    throw new Error(`${label}: differs from persisted ${columnType} authority.`);
  }
}

export function assertReviewedState(
  proof: K2HostedFrllSemanticProof,
  requireKeyMatch = false,
): void {
  const validPostReviewStep = proof.memory.state === 'review'
    ? proof.memory.step === null
    : (proof.memory.state === 'learning' || proof.memory.state === 'relearning') &&
      proof.memory.step !== null && Number.isSafeInteger(proof.memory.step) && proof.memory.step >= 0;
  requireCondition(
    proof.identity.userRows === 1 && proof.identity.learnerProfileRows === 1 &&
    proof.identity.languageProfileRows === 1 && proof.identity.profileBound &&
    proof.save.savedMembershipRows === 1 && proof.save.saveIntentRows === 1 &&
    proof.save.saveLearningEventRows === 1 && proof.save.reviewItemRows === 1 &&
    proof.save.fsrsStateRows === 1 && proof.concept.rowCount === 1 &&
    proof.concept.hasLearningIntent === true && proof.concept.hasProjectableEvidence === true &&
    proof.concept.production.evidenceCount === 1 && proof.memory.rowCount === 1 &&
    proof.memory.stateVersion === 2 && validPostReviewStep &&
    proof.memory.dueAt !== null && proof.memory.lastReviewedAt !== null &&
    proof.memory.difficulty !== null && proof.memory.stability !== null && proof.memory.paramsVersion !== null &&
    proof.review.eventRows === 1 && proof.review.reviewLearningEventRows === 1 &&
    (!requireKeyMatch || proof.review.idempotencyKeyMatched) &&
    proof.review.resultMemory !== null && proof.review.resultCompetence !== null &&
    proof.projection.headRows === 1 && proof.projection.skillRows > 0 &&
    proof.projection.skills.some(skill => skill.skill === 'production'),
    'K2 hosted acceptance FRLL Review did not persist one atomic Memory and competence transition.',
  );

  const resultMemory = proof.review.resultMemory;
  if (!resultMemory) fail('K2 hosted acceptance FRLL Review memory receipt was missing.');
  assertExact(resultMemory.state, proof.memory.state, 'FRLL persisted memory state');
  assertExact(resultMemory.stateVersion, proof.memory.stateVersion, 'FRLL persisted memory version');
  assertTimestamp(resultMemory.dueAt, proof.memory.dueAt, 'FRLL persisted memory dueAt');
  assertTimestamp(resultMemory.lastReviewedAt, proof.memory.lastReviewedAt, 'FRLL persisted memory lastReviewedAt');
  assertFsrsNumericStorage(
    resultMemory.difficulty, proof.memory.difficulty, 'FRLL persisted memory difficulty', 'numeric(7,4)',
    10_000n, 100_000n,
  );
  assertFsrsNumericStorage(
    resultMemory.stability, proof.memory.stability, 'FRLL persisted memory stability', 'numeric(12,4)',
    1n, 999_999_999_999n,
  );
  assertExact(resultMemory.step, proof.memory.step, 'FRLL persisted memory step');
  assertExact(resultMemory.paramsVersion, proof.memory.paramsVersion, 'FRLL persisted memory parameters');

  const resultCompetence = proof.review.resultCompetence;
  if (!resultCompetence) fail('K2 hosted acceptance FRLL Review competence receipt was missing.');
  for (const dimension of ['recognition', 'listening', 'production'] as const) {
    const receipt = resultCompetence[dimension];
    const current = proof.concept[dimension];
    assertProjectionNumber(receipt.score, current.score, `FRLL persisted ${dimension} score`);
    assertProjectionNumber(receipt.confidence, current.confidence, `FRLL persisted ${dimension} confidence`);
    assertExact(receipt.evidenceCount, current.evidenceCount, `FRLL persisted ${dimension} evidenceCount`);
    if (receipt.updatedAt === null || current.lastEvidenceAt === null) {
      assertExact(receipt.updatedAt, current.lastEvidenceAt, `FRLL persisted ${dimension} timestamp`);
    } else {
      assertTimestamp(receipt.updatedAt, current.lastEvidenceAt, `FRLL persisted ${dimension} timestamp`);
    }
  }
}

function persistedConceptState(proof: K2HostedFrllSemanticProof): Record<string, unknown> {
  return {
    mastery: proof.concept.mastery,
    confidence: proof.concept.confidence,
    ...Object.fromEntries((['recognition', 'listening', 'production'] as const).flatMap(dimension => {
      const value = proof.concept[dimension];
      return [
        [dimension, value.score],
        [`${dimension}_confidence`, value.confidence],
        [`${dimension}_evidence_count`, value.evidenceCount],
        [`${dimension}_last_evidence_at`, value.lastEvidenceAt],
      ];
    })),
  };
}

function assertBrainParity(
  proof: K2HostedFrllSemanticProof,
  detail: components['schemas']['BrainConceptDetail'],
  summary: components['schemas']['BrainSummary'],
  listItem: components['schemas']['BrainConceptSummary'],
): void {
  requireCondition(
    proof.concept.rowCount === 1 && proof.concept.hasProjectableEvidence === true &&
    proof.concept.hasLearningIntent === true && proof.memory.rowCount === 1 &&
    proof.review.eventRows === 1 && detail.concept.id === FRLL_ANCHOR_ID &&
    detail.evidence.reviewCount === 1 && detail.memory !== null &&
    listItem.concept.id === detail.concept.id && detail.status !== 'unseen',
    'K2 hosted acceptance FRLL Brain did not return persisted learning evidence.',
  );
  assertExact(detail.status, proof.concept.status, 'FRLL Brain persisted status');
  assertExact(detail.evidence.exposureCount, proof.concept.exposureCount, 'FRLL Brain exposure count');
  assertProjectionNumber(detail.mastery, proof.concept.mastery, 'FRLL Brain mastery');
  assertProjectionNumber(detail.confidence, proof.concept.confidence, 'FRLL Brain confidence');
  assertPersistedCompetence(detail.competence, persistedConceptState(proof), 'FRLL Brain persisted competence');
  assertExact(detail.memory.state, proof.memory.state, 'FRLL Brain memory state');
  assertTimestamp(detail.memory.dueAt, proof.memory.dueAt, 'FRLL Brain memory dueAt');
  if (proof.memory.lastReviewedAt !== null) {
    assertTimestamp(detail.memory.lastReviewedAt, proof.memory.lastReviewedAt, 'FRLL Brain memory lastReviewedAt');
  }
  assertExact(listItem.competence, detail.competence, 'FRLL Brain list/detail competence');
  assertExact(listItem.memory, detail.memory, 'FRLL Brain list/detail memory');
  assertProjectionNumber(listItem.mastery, detail.mastery, 'FRLL Brain list/detail mastery');
  assertProjectionNumber(listItem.confidence, detail.confidence, 'FRLL Brain list/detail confidence');
  for (const dimension of ['recognition', 'listening', 'production'] as const) {
    const skill = proof.projection.skills.find(item => item.skill === dimension);
    if (!skill) fail('K2 hosted acceptance FRLL projection skill row was missing.');
    assertProjectionNumber(summary.competence[dimension].score, skill.score, `FRLL Brain summary ${dimension} score`);
    assertProjectionNumber(summary.competence[dimension].confidence, skill.confidence, `FRLL Brain summary ${dimension} confidence`);
    assertExact(summary.competence[dimension].evidenceCount, skill.evidenceCount, `FRLL Brain summary ${dimension} evidenceCount`);
  }
}

export const k2HostedWaveK210: K2HostedWavePlugin = {
  waveId: 'K2-10',
  actorCount: 4,
  async run(context: K2HostedWaveContext) {
    const frll = context.frll;
    if (!frll || !context.actors.scenarioC || !context.actors.scenarioD || !context.api.primary) {
      fail('K2 hosted acceptance K2-10 FRLL runner bindings were incomplete.');
    }
    const pageA = frll.page;

    context.checkpoint('fixture_frll_anchor_readback', 'start');
    const material = await context.anchorMaterial();
    requireCondition(material.hasTranslatedDefinition && !material.hasHttpsAudio &&
      !material.hasPublishedClozeTarget,
    'K2 hosted acceptance FRLL fixed-anchor material inventory changed.');
    const anchor = contractData<components['schemas']['ConceptDetail']>(
      'ConceptResponse', (await frll.request('primary', `/v1/concepts/${FRLL_ANCHOR_ID}`)).payload,
    );
    requireCondition(anchor.id === FRLL_ANCHOR_ID,
      'K2 hosted acceptance FRLL canonical concept readback did not match the fixed anchor.');
    context.checkpoint('fixture_frll_anchor_readback', 'pass');

    context.checkpoint('fixture_frll_onboarding_readback', 'start');
    const me = contractData<components['schemas']['MeProfile']>(
      'MeResponse', (await frll.request('primary', '/v1/me')).payload,
    );
    const profileList = contractData<readonly components['schemas']['LanguageProfile'][]>(
      'LanguageProfilesResponse', (await frll.request('primary', '/v1/me/languages')).payload,
    );
    requireCondition(
      me.timeZone === 'Asia/Ho_Chi_Minh' && Array.isArray(me.languageProfiles) &&
      me.languageProfiles.length === 1 && profileList.length === 1,
      'K2 hosted acceptance K2-10 fresh onboarding readback was incomplete.',
    );
    assertFreshProfile(profileList[0]);
    assertExact(me.languageProfiles, profileList, 'K2-10 full language profile DTO readback');
    context.checkpoint('fixture_frll_onboarding_readback', 'pass');

    context.checkpoint('fixture_frll_passive_zero_write', 'start');
    const primaryBeforeDictionary = await context.actorSnapshot('primary');
    await frll.ui.searchAnchor(pageA);
    const primaryAfterDictionary = await context.actorSnapshot('primary');
    assertExact(primaryAfterDictionary, primaryBeforeDictionary, 'FRLL passive Dictionary zero-write');
    context.checkpoint('fixture_frll_passive_zero_write', 'pass');

    context.checkpoint('fixture_frll_save_learn', 'start');
    await frll.ui.saveAnchor(pageA);
    const reviewQueuePayload = (await frll.request('primary', '/v1/review/queue')).payload;
    const reviewQueue = contractData<readonly components['schemas']['ReviewQueueItem'][]>(
      'ReviewQueueResponse', reviewQueuePayload,
    );
    requireCondition(
      reviewQueue.length === 1 && reviewQueue[0]?.concept.id === FRLL_ANCHOR_ID,
      'K2 hosted acceptance FRLL Save did not create the anchor Review target.',
    );
    const reviewItemId = reviewQueue[0].reviewItemId;
    const afterSaveSnapshot = await context.actorSnapshot('primary');
    const savedProof = await frll.semanticProof('primary');
    assertSavedState(savedProof);
    const repeatSave = await frll.request('primary', `/v1/library/concepts/${FRLL_ANCHOR_ID}`, {
      method: 'PUT',
    });
    const repeatedSaveDto = contractData<components['schemas']['LibraryMutationResult']>(
      'LibraryMutationResponse', repeatSave.payload,
    );
    requireCondition(repeatedSaveDto.itemType === 'concept' && repeatedSaveDto.isSaved,
      'K2 hosted acceptance FRLL repeated Save was not confirmed.');
    assertExact(await context.actorSnapshot('primary'), afterSaveSnapshot, 'FRLL idempotent repeat Save');
    context.checkpoint('fixture_frll_save_learn', 'pass');

    context.checkpoint('fixture_frll_today_projection', 'start');
    await frll.ui.openToday(pageA);
    const afterTodayUi = await context.actorSnapshot('primary');
    assertTodayCoordinationOnly(afterSaveSnapshot, afterTodayUi);
    const todayPayload = (await frll.request('primary', '/v1/today')).payload;
    const today = contractData<components['schemas']['TodayPlan']>('TodayPlanResponse', todayPayload);
    requireCondition(
      today.languageProfileId === profileList[0].id && today.timeZone === 'Asia/Ho_Chi_Minh' &&
      today.activities.some(activity => activity.activityType === 'review' &&
        activity.reviewItemId === reviewItemId && activity.reasonCodes.includes('FSRS_DUE') &&
        activity.targetCount === 1),
      'K2 hosted acceptance Today plan did not map the saved anchor Review target.',
    );
    requireCondition(
      await context.actorTodayReviewTargets('primary').then(targets =>
        targets.targetCount === 1 && targets.reviewActivityCount === 1) &&
      await frll.todayTargetMatches('primary', reviewItemId),
      'K2 hosted acceptance Today persisted target mapping did not match the saved Review item.',
    );
    const repeatedTodayPayload = (await frll.request('primary', '/v1/today')).payload;
    const repeatedToday = contractData<components['schemas']['TodayPlan']>(
      'TodayPlanResponse', repeatedTodayPayload,
    );
    assertExact(repeatedToday, today, 'FRLL same-day Today plan replay');
    assertExact(await context.actorSnapshot('primary'), afterTodayUi, 'FRLL repeated Today read zero-write');
    context.checkpoint('fixture_frll_today_projection', 'pass');

    context.checkpoint('fixture_frll_review_answer', 'start');
    await frll.ui.openReview(pageA);
    const beforeAnswerSnapshot = await context.actorSnapshot('primary');
    const beforeAnswerProof = await frll.semanticProof('primary');
    const answerResponse = await frll.ui.submitGood(pageA);
    requireCondition(answerResponse.status() === 200, 'K2 hosted acceptance FRLL Review answer did not return HTTP 200.');
    const answer = contractData<components['schemas']['ReviewAnswerResult']>(
      'ReviewAnswerResponse', await answerResponse.json(),
    );
    requireCondition(answer.reviewItemId === reviewItemId, 'K2 hosted acceptance FRLL Review answer receipt was not bound to the saved item.');
    await frll.ui.waitForReviewComplete(pageA);
    requireCondition(!(await frll.pendingReviewReceipt(pageA)), 'K2 hosted acceptance FRLL successful answer retained a pending receipt.');
    const primaryAfterAnswer = await context.actorSnapshot('primary');
    const reviewedProof = await frll.semanticProof('primary');
    assertReviewedState(reviewedProof);
    requireCondition(
      answer.memory.state === reviewedProof.memory.state,
      'K2 hosted acceptance FRLL answer receipt state differed from persisted Memory.',
    );
    assertTimestamp(answer.memory.dueAt, reviewedProof.memory.dueAt, 'FRLL answer receipt dueAt');
    assertTimestamp(answer.memory.lastReviewedAt, reviewedProof.memory.lastReviewedAt, 'FRLL answer receipt lastReviewedAt');
    assertReviewTransition(beforeAnswerSnapshot, primaryAfterAnswer, beforeAnswerProof, reviewedProof);
    context.checkpoint('fixture_frll_review_answer', 'pass');

    context.checkpoint('fixture_frll_brain_persisted_parity', 'start');
    await frll.ui.openBrain(pageA);
    const brainWire = await frll.ui.selectAnchorInBrain(pageA);
    const brainDetail = contractData<components['schemas']['BrainConceptDetail']>(
      'BrainConceptResponse', await brainWire.json(),
    );
    const brainSummary = contractData<components['schemas']['BrainSummary']>(
      'BrainSummaryResponse', (await frll.request('primary', '/v1/brain/summary')).payload,
    );
    const brainList = contractData<readonly components['schemas']['BrainConceptSummary'][]>(
      'BrainConceptListResponse', (await frll.request('primary', '/v1/brain/concepts')).payload,
    );
    const anchorListItem = brainList.find(item => item.concept.id === FRLL_ANCHOR_ID);
    if (!anchorListItem) fail('K2 hosted acceptance FRLL Brain list omitted persisted anchor evidence.');
    assertBrainParity(reviewedProof, brainDetail, brainSummary, anchorListItem);
    assertExact(await context.actorSnapshot('primary'), primaryAfterAnswer, 'FRLL Brain GET zero-write');
    context.checkpoint('fixture_frll_brain_persisted_parity', 'pass');

    context.checkpoint('fixture_frll_response_loss', 'start');
    const actorC = context.actors.scenarioC;
    const pageC = await frll.createPage();
    await frll.switchToActor(actorC, pageC);
    const scenarioCStart = await context.actorSnapshot(actorC);
    await frll.ui.searchAnchor(pageC);
    assertExact(await context.actorSnapshot(actorC), scenarioCStart, 'FRLL C passive Dictionary zero-write');
    await frll.ui.saveAnchor(pageC);
    const reviewQueueC = contractData<readonly components['schemas']['ReviewQueueItem'][]>(
      'ReviewQueueResponse', (await frll.request(actorC, '/v1/review/queue')).payload,
    );
    requireCondition(reviewQueueC.length === 1 && reviewQueueC[0]?.concept.id === FRLL_ANCHOR_ID,
      'K2 hosted acceptance FRLL response-loss actor did not receive one fresh Review target.');
    const reviewItemIdC = reviewQueueC[0].reviewItemId;
    const savedProofC = await frll.semanticProof(actorC);
    assertSavedState(savedProofC);
    await frll.ui.openToday(pageC);
    const todaySnapshotC = await context.actorSnapshot(actorC);
    const todayC = contractData<components['schemas']['TodayPlan']>(
      'TodayPlanResponse', (await frll.request(actorC, '/v1/today')).payload,
    );
    requireCondition(todayC.activities.some(activity => activity.activityType === 'review' &&
      activity.reviewItemId === reviewItemIdC && activity.reasonCodes.includes('FSRS_DUE')),
    'K2 hosted acceptance FRLL response-loss Today target did not match the saved item.');
    requireCondition(await frll.todayTargetMatches(actorC, reviewItemIdC),
      'K2 hosted acceptance FRLL response-loss Today persisted target mapping was missing.');
    await frll.ui.openReview(pageC);
    const preLossSnapshotC = await context.actorSnapshot(actorC);
    const preLossProofC = await frll.semanticProof(actorC);
    frll.dropNextAnswerResponse();
    await frll.ui.submitGoodAndWaitForRetry(pageC);
    const committedLossProof = frll.replayProof();
    requireCondition(
      committedLossProof.responseLossCommitted && committedLossProof.idempotencyKeySha256 !== null &&
      !committedLossProof.exactRequestReplay && !committedLossProof.exactResultReplay,
      'K2 hosted acceptance FRLL response-loss seam did not observe the committed first response.',
    );
    requireCondition(await frll.pendingReviewReceipt(pageC),
      'K2 hosted acceptance FRLL response-loss receipt was not retained in session storage.');
    const committedSnapshotC = await context.actorSnapshot(actorC);
    const committedProofC = await frll.semanticProof(actorC, committedLossProof.idempotencyKeySha256);
    assertReviewedState(committedProofC, true);
    requireCondition(
      committedProofC.save.reviewItemRows === 1 && committedProofC.review.eventRows === 1 &&
      committedProofC.review.reviewLearningEventRows === 1,
      'K2 hosted acceptance FRLL lost-response commit did not persist exactly one durable receipt.',
    );
    assertReviewTransition(preLossSnapshotC, committedSnapshotC, preLossProofC, committedProofC, true);
    context.checkpoint('fixture_frll_response_loss', 'pass');

    context.checkpoint('fixture_frll_exact_replay', 'start');
    await frll.ui.reloadForRetry(pageC);
    requireCondition(await frll.pendingReviewReceipt(pageC),
      'K2 hosted acceptance FRLL response-loss receipt did not survive reload.');
    const replayResponse = await frll.ui.retryAnswer(pageC);
    requireCondition(replayResponse.status() === 200, 'K2 hosted acceptance FRLL exact replay did not return HTTP 200.');
    contractData<components['schemas']['ReviewAnswerResult']>(
      'ReviewAnswerResponse', await replayResponse.json(),
    );
    await frll.ui.waitForReviewComplete(pageC);
    requireCondition(!(await frll.pendingReviewReceipt(pageC)),
      'K2 hosted acceptance FRLL exact replay did not clear the reconciled receipt.');
    const exactReplayProof = frll.replayProof();
    requireCondition(exactReplayProof.responseLossCommitted && exactReplayProof.exactRequestReplay &&
      exactReplayProof.exactResultReplay && exactReplayProof.idempotencyKeySha256 === committedLossProof.idempotencyKeySha256,
    'K2 hosted acceptance FRLL retry did not exactly replay the durable server result.');
    assertExact(await context.actorSnapshot(actorC), committedSnapshotC, 'FRLL exact replay zero duplicate mutation');
    assertExact(await frll.semanticProof(actorC, exactReplayProof.idempotencyKeySha256 ?? undefined),
      committedProofC, 'FRLL exact replay persisted proof');
    context.checkpoint('fixture_frll_exact_replay', 'pass');

    context.checkpoint('fixture_frll_changed_payload_conflict', 'start');
    const conflict = await frll.conflictingReviewReplay();
    requireCondition(conflict.status === 409 && conflict.errorCode === 'IDEMPOTENCY_KEY_REUSED',
      'K2 hosted acceptance FRLL changed-payload request did not return the frozen conflict response.');
    assertExact(await context.actorSnapshot(actorC), committedSnapshotC, 'FRLL changed-payload conflict zero mutation');
    assertExact(await frll.semanticProof(actorC, exactReplayProof.idempotencyKeySha256 ?? undefined),
      committedProofC, 'FRLL changed-payload conflict persisted proof');
    context.checkpoint('fixture_frll_changed_payload_conflict', 'pass');

    context.checkpoint('fixture_frll_actor_b_isolation', 'start');
    const actorB = context.actors.observer;
    const beforeB = await context.actorSnapshot(actorB);
    const beforeA = await context.actorSnapshot('primary');
    const bBrain = contractData<components['schemas']['BrainConceptDetail']>(
      'BrainConceptResponse', (await frll.request(actorB, `/v1/brain/concepts/${FRLL_ANCHOR_ID}`)).payload,
    );
    requireCondition(bBrain.concept.id === FRLL_ANCHOR_ID && bBrain.memory === null &&
      bBrain.evidence.reviewCount === 0,
    'K2 hosted acceptance Actor B observed another actor’s Brain learning evidence.');
    const bForbidden = await frll.request(actorB, `/v1/review/${reviewItemId}/answer`, {
      method: 'POST', idempotencyKey: randomUUID(),
      body: { rating: 'good', exerciseMode: 'self_recall', correct: true, responseTimeMs: 1000 },
    }, [404]);
    let forbiddenError: components['schemas']['ErrorEnvelope']['error'];
    try { forbiddenError = validateContract('ErrorEnvelope', bForbidden.payload).error; }
    catch { fail('K2 hosted acceptance Actor B non-owned Review response was invalid.'); }
    requireCondition(forbiddenError.code === 'NOT_FOUND',
      'K2 hosted acceptance Actor B did not receive the frozen non-owned Review response.');
    assertExact(await context.actorSnapshot(actorB), beforeB, 'FRLL Actor B cross-owner zero-write');
    assertExact(await context.actorSnapshot('primary'), beforeA, 'FRLL Actor A cross-owner zero-write');
    context.checkpoint('fixture_frll_actor_b_isolation', 'pass');

    context.checkpoint('fixture_frll_late_actor_response', 'start');
    const pageAuthA = await frll.createPage();
    await frll.switchToActor('primary', pageAuthA);
    await frll.ui.openBrain(pageA);
    await frll.ui.waitForBrainAnchor(pageA);
    frll.holdNextBrainResponse('primary');
    const lateResponsePromise = pageA.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === `/api/v1/brain/concepts/${FRLL_ANCHOR_ID}`;
    }, { timeout: 30_000 });
    await frll.ui.clickBrainAnchor(pageA);
    await frll.waitForHeldBrainResponse();

    const profileB = contractData<readonly components['schemas']['LanguageProfile'][]>(
      'LanguageProfilesResponse', (await frll.request(actorB, '/v1/me/languages')).payload,
    )[0];
    if (!profileB) fail('K2 hosted acceptance Actor B fresh profile was missing.');
    const bSummaryResponsePromise = pageA.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/brain/summary', { timeout: 30_000 });
    const pageAuthB = await frll.createPage();
    await frll.switchToActor(actorB, pageAuthB);
    const bSummaryResponse = await bSummaryResponsePromise;
    requireCondition(bSummaryResponse.status() === 200,
      'K2 hosted acceptance Actor B Brain profile response did not return HTTP 200.');
    const switchedSummary = contractData<components['schemas']['BrainSummary']>(
      'BrainSummaryResponse', await bSummaryResponse.json(),
    );
    requireCondition(switchedSummary.languageProfileId === profileB.id &&
      switchedSummary.statusCounts.total === 0,
    'K2 hosted acceptance browser did not switch to Actor B profile before the late Actor A response.');
    await frll.ui.waitForEmptyBrain(pageA);

    frll.releaseHeldBrainResponse();
    const lateResponse = await lateResponsePromise;
    requireCondition(lateResponse.status() === 200,
      'K2 hosted acceptance delayed Actor A Brain response was not delivered after the Actor B switch.');
    const delayedA = contractData<components['schemas']['BrainConceptDetail']>(
      'BrainConceptResponse', await lateResponse.json(),
    );
    requireCondition(delayedA.concept.id === FRLL_ANCHOR_ID && delayedA.memory !== null &&
      delayedA.evidence.reviewCount === 1,
    'K2 hosted acceptance delayed Actor A response did not contain Actor A persisted evidence.');
    await pageA.evaluate(() => new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await frll.ui.assertNoBrainDetail(pageA);
    await frll.ui.waitForEmptyBrain(pageA);
    assertExact(await context.actorSnapshot(actorB), beforeB, 'FRLL late Actor A response Actor B zero-write');
    assertExact(await context.actorSnapshot('primary'), beforeA, 'FRLL late Actor A response source zero-write');
    context.checkpoint('fixture_frll_late_actor_response', 'pass');

    context.checkpoint('fixture_frll_passive_zero_write', 'start');
    const actorD = context.actors.scenarioD;
    const pageD = await frll.createPage();
    await frll.switchToActor(actorD, pageD);
    const passiveBaseline = await context.actorSnapshot(actorD);
    await frll.ui.searchAnchor(pageD);
    assertExact(await context.actorSnapshot(actorD), passiveBaseline,
      'FRLL passive Actor D Dictionary zero-write');
    await frll.ui.openPassiveToday(pageD);
    const afterPassiveToday = await context.actorSnapshot(actorD);
    assertTodayCoordinationOnly(passiveBaseline, afterPassiveToday);
    await frll.ui.openBrain(pageD);
    await frll.ui.waitForEmptyBrain(pageD);
    assertTodayCoordinationOnly(passiveBaseline, await context.actorSnapshot(actorD));
    context.checkpoint('fixture_frll_passive_zero_write', 'pass');
  },
};
