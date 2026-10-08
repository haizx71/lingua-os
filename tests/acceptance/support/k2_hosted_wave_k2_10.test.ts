import { describe, expect, it } from 'vitest';
import type { components } from '../../../packages/types/src/generated/openapi';
import { assertTimestamp } from './persisted_assertions';
import {
  k2RetainedTableNames,
  type K2RetainedTableName,
  type K2RetainedSnapshot,
  type K2HostedFrllSemanticProof,
} from './k2_hosted_probe_client';
import {
  assertFreshProfile,
  assertReviewTransition,
  assertReviewedState,
  assertSavedState,
  assertTodayCoordinationOnly,
} from './k2_hosted_wave_k2_10';

const actorTable = (rows: Partial<Record<K2RetainedTableName, number>> = {}): K2RetainedSnapshot => {
  const tables = Object.fromEntries(k2RetainedTableNames().map(name => [name, {
    rows: rows[name] ?? 0,
    sha256: '0'.repeat(64),
  }])) as K2RetainedSnapshot['tables'];
  return { tables, totalRows: Object.values(rows).reduce<number>((sum, count) => sum + (count ?? 0), 0) };
};

function emptySemanticProof(): K2HostedFrllSemanticProof {
  const dimension = { score: null, confidence: null, evidenceCount: null, lastEvidenceAt: null };
  return {
    identity: { userRows: 0, learnerProfileRows: 0, languageProfileRows: 0, profileBound: false },
    save: { savedMembershipRows: 0, saveIntentRows: 0, saveLearningEventRows: 0, reviewItemRows: 0, fsrsStateRows: 0 },
    concept: {
      rowCount: 0, status: null, mastery: null, confidence: null, exposureCount: null, lastSeenAt: null,
      stateVersion: null, hasLearningIntent: null, hasProjectableEvidence: null,
      recognition: dimension, listening: dimension, production: dimension,
    },
    memory: {
      rowCount: 0, state: null, stateVersion: null, dueAt: null, lastReviewedAt: null,
      difficulty: null, stability: null, step: null, paramsVersion: null,
    },
    review: {
      eventRows: 0, reviewLearningEventRows: 0, idempotencyKeyMatched: false, rating: null,
      responseTimeMs: null, correct: null, exerciseMode: null, evidenceMode: null,
      resultMemory: null, resultCompetence: null,
    },
    projection: {
      headRows: 0, nextIngestionSequence: null, methodVersion: null, stateVersion: null, skillRows: 0, skills: [],
    },
  };
}

function savedSemanticProof(): K2HostedFrllSemanticProof {
  const proof = emptySemanticProof();
  return {
    ...proof,
    identity: { userRows: 1, learnerProfileRows: 1, languageProfileRows: 1, profileBound: true },
    save: { savedMembershipRows: 1, saveIntentRows: 1, saveLearningEventRows: 1, reviewItemRows: 1, fsrsStateRows: 1 },
    concept: {
      ...proof.concept,
      rowCount: 1, status: 'learning', mastery: null, confidence: '0', exposureCount: 0,
      lastSeenAt: null, stateVersion: 2,
      hasLearningIntent: true, hasProjectableEvidence: false,
      recognition: { score: '0.50', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
      listening: { score: '0.50', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
      production: { score: '0.50', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
    },
    memory: {
      rowCount: 1, state: 'new', stateVersion: 1, dueAt: '2026-10-08T01:00:00Z', lastReviewedAt: null,
      difficulty: null, stability: null, step: null, paramsVersion: 'fsrs-1',
    },
    projection: {
      headRows: 1, nextIngestionSequence: 2, methodVersion: 'competence-1', stateVersion: 2,
      skillRows: 3,
      skills: (['recognition', 'listening', 'production'] as const).map(skill => ({
        skill, score: '0.50', confidence: '0', evidenceCount: 0, stateVersion: 1,
        lastEvidenceAt: null, methodVersion: 'competence-1',
      })),
    },
  };
}

function reviewedSemanticProof(): K2HostedFrllSemanticProof {
  const saved = savedSemanticProof();
  const lastReviewedAt = '2026-10-08T00:05:00Z';
  const dueAt = '2026-10-08T00:15:00Z';
  const dimensions = {
    recognition: { score: '0.50', confidence: '0', evidenceCount: 0, updatedAt: null },
    listening: { score: '0.50', confidence: '0', evidenceCount: 0, updatedAt: null },
    production: { score: '0.70', confidence: '0.60', evidenceCount: 1, updatedAt: lastReviewedAt },
  } as const;
  const skills = [
    { skill: 'recognition', score: '0.50', confidence: '0', evidenceCount: 0, stateVersion: 1, lastEvidenceAt: null, methodVersion: 'competence-1' },
    { skill: 'listening', score: '0.50', confidence: '0', evidenceCount: 0, stateVersion: 1, lastEvidenceAt: null, methodVersion: 'competence-1' },
    { skill: 'production', score: '0.70', confidence: '0.60', evidenceCount: 1, stateVersion: 2, lastEvidenceAt: lastReviewedAt, methodVersion: 'competence-1' },
  ] as const;
  return {
    ...saved,
    concept: {
      ...saved.concept,
      status: 'active', mastery: '0.50', confidence: '0.40', exposureCount: 2,
      lastSeenAt: lastReviewedAt, stateVersion: 3, hasProjectableEvidence: true,
      recognition: { score: '0.50', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
      listening: { score: '0.50', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
      production: { score: '0.70', confidence: '0.60', evidenceCount: 1, lastEvidenceAt: lastReviewedAt },
    },
    memory: {
      rowCount: 1, state: 'learning', stateVersion: 2, dueAt, lastReviewedAt,
      difficulty: '4.50', stability: '2.00', step: 1, paramsVersion: 'fsrs-1',
    },
    review: {
      eventRows: 1, reviewLearningEventRows: 1, idempotencyKeyMatched: true,
      rating: 'good', responseTimeMs: 1000, correct: true,
      exerciseMode: 'self_recall', evidenceMode: 'production',
      resultMemory: {
        state: 'learning', dueAt, lastReviewedAt, difficulty: '4.50', stability: '2.00',
        step: 1, stateVersion: 2, paramsVersion: 'fsrs-1',
      },
      resultCompetence: dimensions,
    },
    projection: {
      headRows: 1, nextIngestionSequence: 3, methodVersion: 'competence-1', stateVersion: 3,
      skillRows: 3, skills,
    },
  };
}

function snapshotWith(
  snapshot: K2RetainedSnapshot,
  changes: Partial<Record<K2RetainedTableName, { rows?: number; sha256?: string }>>,
): K2RetainedSnapshot {
  const tables = Object.fromEntries(k2RetainedTableNames().map(name => [name, {
    ...snapshot.tables[name],
    ...changes[name],
  }])) as K2RetainedSnapshot['tables'];
  return {
    tables,
    totalRows: Object.values(tables).reduce<number>((sum, table) => sum + table.rows, 0),
  };
}

function reviewTransitionSnapshots(): { before: K2RetainedSnapshot; after: K2RetainedSnapshot } {
  const before = actorTable({
    fsrs_states: 1, review_items: 1, review_events: 0, learning_events: 1,
    user_concept_states: 1, user_language_projection_heads: 1, user_skill_states: 3,
  });
  const changes: Partial<Record<K2RetainedTableName, { rows?: number; sha256?: string }>> = {};
  for (const table of [
    'fsrs_states', 'review_items', 'review_events', 'learning_events',
    'user_concept_states', 'user_language_projection_heads', 'user_skill_states',
  ] as const) changes[table] = { sha256: '1'.repeat(64) };
  changes.review_events = { rows: 1, sha256: '1'.repeat(64) };
  changes.learning_events = { rows: 2, sha256: '1'.repeat(64) };
  changes.today_plans = { rows: 1, sha256: '2'.repeat(64) };
  changes.today_plan_activities = { rows: 1, sha256: '2'.repeat(64) };
  return { before, after: snapshotWith(before, changes) };
}

describe('K2-10 frozen FRLL/R1 assertions', () => {
  const profile = {
    id: '00000000-0000-4000-8000-000000000001',
    etag: '"profile-etag"',
    targetLanguageCode: 'en',
    nativeLanguageCode: 'vi',
    goal: 'communication',
    dailyMinutes: 15,
    targetLevel: null,
    startingLevelEstimate: null,
    status: 'active',
    createdAt: '2026-10-08T00:00:00Z',
    updatedAt: '2026-10-08T00:00:00Z',
  } as const;

  it('pins every field of the normal fresh onboarding profile', () => {
    expect(() => assertFreshProfile(profile as components['schemas']['LanguageProfile'])).not.toThrow();
    expect(() => assertFreshProfile({ ...profile, dailyMinutes: 30 } as components['schemas']['LanguageProfile']))
      .toThrow('fresh profile DTO');
    expect(() => assertFreshProfile({ ...profile, targetLevel: 'B1' } as unknown as components['schemas']['LanguageProfile']))
      .toThrow('fresh profile DTO');
  });

  it('compares API and probe UTC timestamp spellings by their normalized instant', () => {
    expect(() => assertTimestamp(
      '2026-10-08T00:05:00Z', '2026-10-08T00:05:00+00:00', 'FRLL timestamp equivalence',
    )).not.toThrow();
    expect(() => assertTimestamp(
      '2026-10-08T00:05:00.120Z', '2026-10-08T00:05:00.120000+00:00', 'FRLL fractional timestamp equivalence',
    )).not.toThrow();
    expect(() => assertTimestamp(
      '2026-10-08T00:05:01Z', '2026-10-08T00:05:00+00:00', 'FRLL timestamp instant mismatch',
    )).toThrow('differs from persisted authority');
  });

  it('allows only documented Today coordination tables to change during passive reads', () => {
    const before = actorTable();
    const todayRead = actorTable({ today_plans: 1, today_plan_activities: 1, today_activity_review_items: 1 });
    expect(() => assertTodayCoordinationOnly(before, todayRead)).not.toThrow();
    expect(() => assertTodayCoordinationOnly(before, actorTable({ user_skill_states: 1 })))
      .toThrow('complete learner-owned rows');
  });

  it('requires a real saved intent, item, and primary Memory row before passing F1-D', () => {
    expect(() => assertSavedState(emptySemanticProof())).toThrow('Save did not create exactly one intent');
    expect(() => assertSavedState({
      ...savedSemanticProof(),
      save: { ...savedSemanticProof().save, saveIntentRows: 0 },
    })).toThrow('Save did not create exactly one intent');
    expect(() => assertSavedState(savedSemanticProof())).not.toThrow();
    expect(() => assertSavedState({
      ...savedSemanticProof(),
      concept: { ...savedSemanticProof().concept, mastery: '0' },
    })).toThrow('Save did not create exactly one intent');
  });

  it('requires committed review, Memory version advance, competence projection, and exact receipt proof', () => {
    expect(() => assertReviewedState(emptySemanticProof())).toThrow('Review did not persist one atomic');
    expect(() => assertReviewedState(reviewedSemanticProof(), true)).not.toThrow();
    expect(() => assertReviewedState({
      ...reviewedSemanticProof(),
      review: { ...reviewedSemanticProof().review, idempotencyKeyMatched: false },
    }, true)).toThrow('Review did not persist one atomic');
  });

  it('accepts the real first-good learning step and rejects invalid post-review FSRS shapes', () => {
    const reviewed = reviewedSemanticProof();
    expect(reviewed.memory.state).toBe('learning');
    expect(reviewed.memory.step).toBe(1);
    expect(() => assertReviewedState(reviewed)).not.toThrow();

    const newState: K2HostedFrllSemanticProof = {
      ...reviewed,
      memory: { ...reviewed.memory, state: 'new', lastReviewedAt: null, difficulty: null, stability: null, step: null },
      review: {
        ...reviewed.review,
        resultMemory: reviewed.review.resultMemory
          ? { ...reviewed.review.resultMemory, state: 'learning', step: 1 }
          : null,
      },
    };
    expect(() => assertReviewedState(newState)).toThrow('Review did not persist one atomic');

    const mismatchedStep: K2HostedFrllSemanticProof = {
      ...reviewed,
      memory: { ...reviewed.memory, step: 0 },
    };
    expect(() => assertReviewedState(mismatchedStep)).toThrow('FRLL persisted memory step');

    const illegalNullStep: K2HostedFrllSemanticProof = {
      ...reviewed,
      memory: { ...reviewed.memory, step: null },
    };
    expect(() => assertReviewedState(illegalNullStep)).toThrow('Review did not persist one atomic');
  });

  it('compares review receipts at the persisted FSRS numeric scale without accepting adjacent values', () => {
    const reviewed = reviewedSemanticProof();
    const roundedReceipt: K2HostedFrllSemanticProof = {
      ...reviewed,
      memory: { ...reviewed.memory, difficulty: '5.1235', stability: '2.0000' },
      review: {
        ...reviewed.review,
        resultMemory: reviewed.review.resultMemory
          ? { ...reviewed.review.resultMemory, difficulty: '5.1234567', stability: '2.00000001' }
          : null,
      },
    };
    expect(() => assertReviewedState(roundedReceipt)).not.toThrow();

    const roundedHalf: K2HostedFrllSemanticProof = {
      ...roundedReceipt,
      memory: { ...roundedReceipt.memory, difficulty: '5.1235' },
      review: {
        ...roundedReceipt.review,
        resultMemory: roundedReceipt.review.resultMemory
          ? { ...roundedReceipt.review.resultMemory, difficulty: '5.12345' }
          : null,
      },
    };
    expect(() => assertReviewedState(roundedHalf)).not.toThrow();

    const adjacentStoredValue: K2HostedFrllSemanticProof = {
      ...roundedReceipt,
      memory: { ...roundedReceipt.memory, difficulty: '5.1234' },
    };
    expect(() => assertReviewedState(adjacentStoredValue)).toThrow(
      'FRLL persisted memory difficulty: differs from persisted numeric(7,4) authority.',
    );

    const outOfRangeReceipt: K2HostedFrllSemanticProof = {
      ...roundedReceipt,
      review: {
        ...roundedReceipt.review,
        resultMemory: roundedReceipt.review.resultMemory
          ? { ...roundedReceipt.review.resultMemory, difficulty: '10.0001' }
          : null,
      },
    };
    expect(() => assertReviewedState(outOfRangeReceipt)).toThrow(
      'FRLL persisted memory difficulty: differs from persisted numeric(7,4) authority.',
    );

    const outOfRangeDifficulty: K2HostedFrllSemanticProof = {
      ...roundedReceipt,
      memory: { ...roundedReceipt.memory, difficulty: '10.0001' },
      review: {
        ...roundedReceipt.review,
        resultMemory: roundedReceipt.review.resultMemory
          ? { ...roundedReceipt.review.resultMemory, difficulty: '10.0001' }
          : null,
      },
    };
    expect(() => assertReviewedState(outOfRangeDifficulty)).toThrow(
      'FRLL persisted memory difficulty: differs from persisted numeric(7,4) authority.',
    );

    const outOfRangeStability: K2HostedFrllSemanticProof = {
      ...roundedReceipt,
      memory: { ...roundedReceipt.memory, stability: '100000000.0000' },
      review: {
        ...roundedReceipt.review,
        resultMemory: roundedReceipt.review.resultMemory
          ? { ...roundedReceipt.review.resultMemory, stability: '100000000.0000' }
          : null,
      },
    };
    expect(() => assertReviewedState(outOfRangeStability)).toThrow(
      'FRLL persisted memory stability: differs from persisted numeric(12,4) authority.',
    );
  });

  it('allows only the complete semantic Review transition and documented Today deltas', () => {
    const { before, after } = reviewTransitionSnapshots();
    expect(() => assertReviewTransition(before, after, savedSemanticProof(), reviewedSemanticProof(), true)).not.toThrow();
  });

  it('rejects any unrelated retained learner-table mutation during Review', () => {
    const { before, after } = reviewTransitionSnapshots();
    const unrelatedMutation = snapshotWith(after, {
      user_content_progress: { rows: 1, sha256: '3'.repeat(64) },
    });
    expect(() => assertReviewTransition(
      before, unrelatedMutation, savedSemanticProof(), reviewedSemanticProof(), true,
    )).toThrow('unrelated learner table user_content_progress');
  });

  it('rejects a retained table count or semantic evidence delta that disagrees with the proof', () => {
    const { before, after } = reviewTransitionSnapshots();
    const wrongReviewCount = snapshotWith(after, {
      review_events: { rows: 2, sha256: '4'.repeat(64) },
    });
    expect(() => assertReviewTransition(
      before, wrongReviewCount, savedSemanticProof(), reviewedSemanticProof(), true,
    )).toThrow('post-answer review_events rows');

    const reviewed = reviewedSemanticProof();
    const wrongProductionDelta: K2HostedFrllSemanticProof = {
      ...reviewed,
      projection: {
        ...reviewed.projection,
        skills: reviewed.projection.skills.map(skill => skill.skill === 'production'
          ? { ...skill, evidenceCount: 0 }
          : skill),
      },
    };
    expect(() => assertReviewTransition(
      before, after, savedSemanticProof(), wrongProductionDelta, true,
    )).toThrow('production skill evidence delta');
  });

  it('rejects swapped exercise and evidence modes even when the memory delta is otherwise valid', () => {
    const { before, after } = reviewTransitionSnapshots();
    const reviewed = reviewedSemanticProof();
    const swappedExercise: K2HostedFrllSemanticProof = {
      ...reviewed,
      review: { ...reviewed.review, exerciseMode: 'typing' },
    };
    const swappedEvidence: K2HostedFrllSemanticProof = {
      ...reviewed,
      review: { ...reviewed.review, evidenceMode: 'recognition' },
    };
    expect(() => assertReviewTransition(
      before, after, savedSemanticProof(), swappedExercise, true,
    )).toThrow('persisted Review exercise mode');
    expect(() => assertReviewTransition(
      before, after, savedSemanticProof(), swappedEvidence, true,
    )).toThrow('self-recall evidence mode');
  });
});
