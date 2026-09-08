import type { components } from '../../../packages/types/src/generated/openapi';
import type { LearnerStateDigest } from './postgres_probe_client';
import { assertExact, assertPersistedCompetence, assertProjectionNumber, assertTimestamp } from './persisted_assertions';

export function assertReviewPersistence(
  answer: components['schemas']['ReviewAnswerResult'],
  before: LearnerStateDigest,
  after: LearnerStateDigest,
  profileId: string,
): void {
  const prefix = 'Review persisted';
  const event = after.review_events[0];
  const memory = event.result_memory_snapshot;
  const competence = event.result_competence_snapshot;
  if (!memory || !competence || !before.concept_state || !after.concept_state) {
    throw new Error(`${prefix}: missing committed snapshot or concept state.`);
  }
  assertExact(answer.reviewItemId, memory.reviewItemId, `${prefix} reviewItemId`);
  assertExact(answer.memory.state, memory.state, `${prefix} memory state`);
  assertTimestamp(answer.memory.dueAt, memory.dueAt, `${prefix} dueAt`);
  assertTimestamp(answer.memory.lastReviewedAt, memory.lastReviewAt, `${prefix} lastReviewedAt`);
  assertExact(answer.memory.isDue, false, `${prefix} answer isDue`);
  assertExact(answer.remainingDueCount, event.result_remaining_due_count, `${prefix} remainingDueCount`);
  assertExact(answer.feedback ?? null, event.result_feedback, `${prefix} feedback`);
  for (const dimension of ['recognition', 'listening', 'production'] as const) {
    const saved = competence[dimension] as Record<string, unknown> | undefined;
    if (!saved) throw new Error(`${prefix}: missing ${dimension} snapshot.`);
    const score = answer.competence[dimension];
    for (const field of ['score', 'confidence', 'evidenceCount'] as const) {
      assertExact(score[field], saved[field], `${prefix} ${dimension} ${field}`);
    }
    if (saved.updatedAt === null) assertExact('updatedAt' in score, false, `${prefix} ${dimension} updatedAt`);
    else assertTimestamp(score.updatedAt, saved.updatedAt, `${prefix} ${dimension} updatedAt`);
  }
  const fsrs = after.fsrs_states[0] as unknown as Record<string, unknown>;
  for (const [snapshotKey, stateKey] of [
    ['state', 'state'], ['stateVersion', 'state_version'], ['step', 'step'],
    ['parameterSetId', 'parameter_set_id'], ['paramsVersion', 'params_version'],
  ]) assertExact(memory[snapshotKey], fsrs[stateKey], `${prefix} FSRS ${stateKey}`);
  assertTimestamp(memory.dueAt, fsrs.due_at, `${prefix} FSRS dueAt`);
  assertTimestamp(memory.lastReviewAt, fsrs.last_review_at, `${prefix} FSRS lastReviewAt`);

  const pre = before.concept_state, post = after.concept_state;
  assertPersistedCompetence(answer.competence, post, prefix);
  assertExact(post.state_version, pre.state_version + 1, `${prefix} concept version exactly once`);
  const preHeads = before.projection_heads.filter(row => row.user_language_id === profileId);
  const postHeads = after.projection_heads.filter(row => row.user_language_id === profileId);
  assertExact(preHeads.length, 1, `${prefix} pre head count`);
  assertExact(postHeads.length, 1, `${prefix} post head count`);
  const head = postHeads[0];
  assertExact(head.state_version, Number(preHeads[0].state_version) + 1, `${prefix} head version exactly once`);
  assertExact(head.next_ingestion_sequence, Number(preHeads[0].next_ingestion_sequence) + 1, `${prefix} sequence exactly once`);
  assertExact(head.parameter_set_id, preHeads[0].parameter_set_id, `${prefix} head parameter continuity`);
  assertExact(head.parameter_version, preHeads[0].parameter_version, `${prefix} head parameter version continuity`);
  const reviewEvidence = after.learning_events.find(row => row.source_type === 'review_event') as unknown as Record<string, unknown>;
  for (const row of [post, reviewEvidence]) {
    assertExact(row.competence_parameter_set_id, head.parameter_set_id, `${prefix} parameter set lineage`);
    assertExact(row.competence_parameter_version, head.parameter_version, `${prefix} parameter version lineage`);
    assertExact(row.projection_method_version, head.projection_method_version, `${prefix} projection method`);
  }
  assertExact(post.has_learning_intent, true, `${prefix} learning intent`);
  assertExact(post.mastery, null, `${prefix} incomplete mastery`);
  for (const dimension of ['recognition', 'listening', 'production'] as const) {
    const previous = before.skill_states.filter(row => row.user_language_id === profileId && row.skill === dimension);
    const current = after.skill_states.filter(row => row.user_language_id === profileId && row.skill === dimension);
    assertExact(previous.length, 1, `${prefix} previous skill ${dimension}`);
    assertExact(current.length, 1, `${prefix} current skill ${dimension}`);
    const a = previous[0], b = current[0];
    const delta = dimension === 'production' ? 1 : 0;
    assertExact(post[`${dimension}_evidence_count`], Number(pre[`${dimension}_evidence_count`]) + delta, `${prefix} ${dimension} concept evidence`);
    assertExact(b.evidence_count, Number(a.evidence_count) + delta, `${prefix} ${dimension} skill evidence`);
    assertExact(b.state_version, Number(a.state_version) + delta, `${prefix} ${dimension} skill version`);
    assertExact(b.competence_parameter_set_id, head.parameter_set_id, `${prefix} ${dimension} skill parameter set`);
    assertExact(b.competence_parameter_version, head.parameter_version, `${prefix} ${dimension} skill parameter version`);
    assertExact(b.method_version, head.projection_method_version, `${prefix} ${dimension} skill method`);
    if (delta === 0) {
      assertExact(b, a, `${prefix} untouched ${dimension} skill`);
      for (const suffix of ['', '_confidence', '_positive_mass', '_negative_mass', '_last_evidence_at']) {
        assertExact(post[`${dimension}${suffix}`], pre[`${dimension}${suffix}`], `${prefix} untouched ${dimension}${suffix}`);
      }
    } else {
      assertProjectionNumber(b.score, post.production, `${prefix} production skill score`);
      assertProjectionNumber(b.confidence, post.production_confidence, `${prefix} production skill confidence`);
      assertTimestamp(b.last_evidence_at, post.production_last_evidence_at, `${prefix} production skill last_evidence_at`);
      // Observational only: require nonzero persisted mass and consistent skill /
      // concept evidence for this sole-concept learner; never compute a score.
      for (const suffix of ['positive_mass', 'negative_mass']) {
        assertExact(post[`production_${suffix}`], b[suffix], `${prefix} production ${suffix}`);
        if (!Number.isFinite(Number(b[suffix])) || Number(b[suffix]) < 0) throw new Error(`${prefix}: invalid mass.`);
      }
      if (Number(b.positive_mass) + Number(b.negative_mass) <= 0) throw new Error(`${prefix}: no competence evidence mass.`);
    }
  }
}
