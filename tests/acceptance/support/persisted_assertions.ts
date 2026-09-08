import { isDeepStrictEqual } from 'node:util';
import type { components } from '../../../packages/types/src/generated/openapi';

export function assertExact(actual: unknown, expected: unknown, label: string): void {
  if (actual === undefined || expected === undefined || !isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label}: differs from persisted authority.`);
  }
}

// Only score/confidence/mastery use PostgreSQL numeric(10,8). Masses, IDs,
// versions, counts and replay snapshots are never compared with this tolerance.
export function assertProjectionNumber(actual: unknown, expected: unknown, label: string): void {
  const decimal = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(value)) return Number(value);
    return NaN;
  };
  if (actual === null && expected === null) return;
  const left = decimal(actual), right = decimal(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right) || Math.abs(left - right) > 1e-8) {
    throw new Error(`${label}: differs from persisted numeric(10,8) authority.`);
  }
}

export function assertTimestamp(actual: unknown, expected: unknown, label: string): void {
  const canonical = (value: unknown): string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(value)) {
      throw new Error(`${label}: missing or invalid UTC timestamp.`);
    }
    return value.replace(/\+00:00$/, 'Z').replace(/(\.\d*?)0+Z$/, '$1Z').replace(/\.Z$/, 'Z');
  };
  assertExact(canonical(actual), canonical(expected), label);
}

export function assertPersistedCompetence(
  signals: components['schemas']['CompetenceSignals'],
  state: object,
  label: string,
): void {
  const record = state as Record<string, unknown>;
  for (const dimension of ['recognition', 'listening', 'production'] as const) {
    const score = signals[dimension];
    assertProjectionNumber(score.score, record[dimension], `${label} ${dimension} score`);
    assertProjectionNumber(score.confidence, record[`${dimension}_confidence`], `${label} ${dimension} confidence`);
    assertExact(score.evidenceCount, record[`${dimension}_evidence_count`], `${label} ${dimension} evidenceCount`);
    const updated = record[`${dimension}_last_evidence_at`];
    if (updated === null) {
      assertExact('updatedAt' in score, false, `${label} ${dimension} absent updatedAt`);
    } else {
      assertTimestamp(score.updatedAt, updated, `${label} ${dimension} updatedAt`);
    }
  }
}
