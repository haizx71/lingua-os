import { assertExact } from './persisted_assertions';

type Rows = Record<string, unknown>;
function observation(value: unknown): Rows {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new Error('R1: missing authoritative observation.');
  }
  return value as Rows;
}

export function assertNoLearningMutation(before: unknown, after: unknown, allowTodayCoordination = false): void {
  const coordination = new Set(['today_plans', 'today_plan_activities', 'today_activity_review_items']);
  const select = (value: unknown) => Object.fromEntries(Object.entries(observation(value))
    .filter(([table]) => !allowTodayCoordination || !coordination.has(table)));
  assertExact(select(after), select(before), 'R1 complete learner-owned rows');
}

export function assertSameReceipt(before: unknown, after: unknown): void {
  const required = ['reviewItemId', 'idempotencyKey', 'rating', 'responseTimeMs'];
  const original = observation(before);
  if (required.some(key => original[key] === undefined)) throw new Error('R1: incomplete original receipt.');
  assertExact(after, before, 'R1 exact durable receipt');
}

export function assertCleanupEvidence(authDeleted: unknown, evidence: unknown): void {
  const record = observation(evidence);
  const counts = observation(record.counts);
  if (authDeleted !== true || record.clean !== true || record.anchor_concept_intact !== true ||
      counts.users !== 0 || Object.values(counts).some(value => value !== 0)) {
    throw new Error('R1: cleanup is not independently verified.');
  }
}
