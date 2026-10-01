import { describe, expect, it } from 'vitest';
import {
  assertK2HostedDueOnlySeed,
  assertK2HostedDueOnlyTodayPlan,
  assertK2HostedDueOnlyPlanReplay,
  assertK2HostedDueOnlyTodayDelta,
  assertK2HostedDueOnlyTargetProbe,
  collectK2HostedDictionaryConceptIds,
} from './k2_hosted_wave_k2_08_due_only';
import { k2RetainedTableNames, type K2HostedActorLineageProof, type K2RetainedSnapshot } from './k2_hosted_probe_client';

function id(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function snapshot(overrides: Readonly<Record<string, number>> = {}, changedToday = false): K2RetainedSnapshot {
  const tables = Object.fromEntries(k2RetainedTableNames().map(table => [table, {
    rows: overrides[table] ?? 0,
    sha256: changedToday && table.startsWith('today_') && overrides[table]
      ? '1'.repeat(64)
      : '0'.repeat(64),
  }])) as K2RetainedSnapshot['tables'];
  return { tables, totalRows: Object.values(tables).reduce((sum, table) => sum + table.rows, 0) };
}

const seedLineage: K2HostedActorLineageProof = {
  userConceptStateRows: 20,
  reviewItemRows: 20,
  fsrsStateRows: 20,
  recognitionEvidenceCount: 0,
  listeningEvidenceCount: 0,
  productionEvidenceCount: 0,
  productionPositiveMass: '0',
  productionNegativeMass: '0',
  events: [],
};

describe('K2-08 due-only Dictionary fixture', () => {
  it('selects exactly 20 distinct catalog concepts across normal search pages', () => {
    const first = Array.from({ length: 12 }, (_, index) => ({ id: id(index + 1) }));
    const second = [first[0], ...Array.from({ length: 12 }, (_, index) => ({ id: id(index + 13) }))];
    expect(collectK2HostedDictionaryConceptIds([{ data: first }, { data: second }])).toEqual(
      Array.from({ length: 20 }, (_, index) => id(index + 1)),
    );
  });

  it('requires the exact 15-minute v2 Review-only plan with the first due target exposed', () => {
    const reviewIds = Array.from({ length: 20 }, (_, index) => id(index + 1));
    const plan = {
      data: {
        engineVersion: 'today-heuristic-v2',
        targetMinutes: 15,
        activities: [{
          activityType: 'review',
          position: 0,
          targetCount: 15,
          estimatedMinutes: 15,
          reviewItemId: reviewIds[0],
        }],
      },
    };
    expect(() => assertK2HostedDueOnlyTodayPlan(plan, reviewIds)).not.toThrow();
    expect(() => assertK2HostedDueOnlyTodayPlan({
      data: { ...plan.data, activities: [{ ...plan.data.activities[0], activityType: 'read' }] },
    }, reviewIds)).toThrow('due-only Review prefix');
    expect(() => assertK2HostedDueOnlyTodayPlan({
      data: { ...plan.data, engineVersion: 'today-heuristic-v1' },
    }, reviewIds)).toThrow('expected due-only Today plan');
  });

  it('maps the exact ordered 15-item prefix from the read-only target probe', () => {
    const reviewIds = Array.from({ length: 20 }, (_, index) => id(index + 1));
    expect(() => assertK2HostedDueOnlyTargetProbe({
      engineVersion: 'today-heuristic-v2',
      activityCount: 1,
      reviewActivityCount: 1,
      targetCount: 15,
      reviewItemIds: reviewIds.slice(0, 15),
    }, reviewIds)).not.toThrow();
    expect(() => assertK2HostedDueOnlyTargetProbe({
      engineVersion: 'today-heuristic-v2',
      activityCount: 1,
      reviewActivityCount: 1,
      targetCount: 15,
      reviewItemIds: [...reviewIds.slice(1, 15), reviewIds[0]],
    }, reviewIds)).toThrow('did not match the due-only Review prefix');
  });

  it('compares persisted plan data while allowing request-specific metadata to vary', () => {
    const plan = { id: id(99), engineVersion: 'today-heuristic-v2', activities: [] };
    expect(() => assertK2HostedDueOnlyPlanReplay(
      { data: plan, meta: { requestId: id(1) } },
      { data: plan, meta: { requestId: id(2) } },
    )).not.toThrow();
    expect(() => assertK2HostedDueOnlyPlanReplay(
      { data: plan, meta: { requestId: id(1) } },
      { data: { ...plan, id: id(100) }, meta: { requestId: id(2) } },
    )).toThrow('replay changed the persisted plan');
  });

  it('does not invent unavailable concepts and rejects malformed or duplicate page entries', () => {
    expect(collectK2HostedDictionaryConceptIds([{ data: [{ id: id(1) }] }])).toEqual([id(1)]);
    expect(() => collectK2HostedDictionaryConceptIds([{ data: [{ id: 'private-concept-marker' }] }]))
      .toThrow('dictionary response was invalid');
    expect(() => collectK2HostedDictionaryConceptIds([{ data: [{ id: id(1) }, { id: id(1) }] }]))
      .toThrow('dictionary response was invalid');
  });

  it('requires the exact saved due backlog with zero competence and review evidence', () => {
    const valid = snapshot({
      users: 1,
      learner_profiles: 1,
      user_languages: 1,
      concept_save_intents: 20,
      user_saved_concepts: 20,
      learning_events: 20,
      user_concept_states: 20,
      review_items: 20,
      fsrs_states: 20,
    });
    expect(() => assertK2HostedDueOnlySeed(valid, seedLineage)).not.toThrow();
    expect(() => assertK2HostedDueOnlySeed(
      valid,
      { ...seedLineage, productionEvidenceCount: 1 },
    )).toThrow('changed competence or review evidence');
    expect(() => assertK2HostedDueOnlySeed(
      snapshot({
        users: 1,
        learner_profiles: 1,
        user_languages: 1,
        concept_save_intents: 20,
        user_saved_concepts: 20,
        learning_events: 20,
        user_concept_states: 20,
        review_items: 19,
        fsrs_states: 20,
      }),
      seedLineage,
    )).toThrow('expected actor rows');
  });

  it('permits only the exact Today plan, activity, and 15-target insertion during generation', () => {
    const before = snapshot({
      users: 1,
      user_concept_states: 20,
      fsrs_states: 20,
      review_events: 0,
    });
    const after = snapshot({
      users: 1,
      user_concept_states: 20,
      fsrs_states: 20,
      review_events: 0,
      today_plans: 1,
      today_plan_activities: 1,
      today_activity_review_items: 15,
    }, true);
    expect(() => assertK2HostedDueOnlyTodayDelta(before, after)).not.toThrow();

    const learnerStateChange = snapshot({
      users: 1,
      user_concept_states: 21,
      fsrs_states: 20,
      review_events: 0,
      today_plans: 1,
      today_plan_activities: 1,
      today_activity_review_items: 15,
    }, true);
    expect(() => assertK2HostedDueOnlyTodayDelta(before, learnerStateChange))
      .toThrow('changed non-Today learner state');
    expect(() => assertK2HostedDueOnlyTodayDelta(before, snapshot({
      users: 1,
      user_concept_states: 20,
      fsrs_states: 20,
      review_events: 0,
      today_plans: 1,
      today_plan_activities: 1,
      today_activity_review_items: 14,
    }, true))).toThrow('exact Today rows');
  });
});
