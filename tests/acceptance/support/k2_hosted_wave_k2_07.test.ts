import { describe, expect, it } from 'vitest';
import {
  K2_07_PRIMARY_AFTER_SAVE_LINEAGE,
  K2_07_PRIMARY_AFTER_SAVE_ROWS,
  K2_07_OBSERVER_AFTER_PRIMARY_SAVE_ROWS,
  requireK2HostedLineage,
  selectK2HostedExerciseMode,
} from './k2_hosted_wave_k2_07';
import { requireK2ActorSnapshotRows } from './k2_hosted_runner';
import {
  k2RetainedTableNames,
  type K2HostedActorLineageProof,
  type K2HostedAnchorMaterial,
  type K2RetainedSnapshot,
} from './k2_hosted_probe_client';

const noMaterial: K2HostedAnchorMaterial = {
  hasTranslatedDefinition: false,
  hasHttpsAudio: false,
  hasPublishedClozeTarget: false,
};

function signals(overrides: Partial<Record<'recognition' | 'listening' | 'production', {
  score: number;
  evidenceCount: number;
}>> = {}) {
  return {
    recognition: { score: 0.5, evidenceCount: 0 },
    listening: { score: 0.5, evidenceCount: 0 },
    production: { score: 0.5, evidenceCount: 0 },
    ...overrides,
  };
}

function actorSnapshot(overrides: Readonly<Record<string, number>> = {}): K2RetainedSnapshot {
  const tables = Object.fromEntries(k2RetainedTableNames().map(table => [table, {
    rows: overrides[table] ?? 0,
    sha256: '0'.repeat(64),
  }])) as K2RetainedSnapshot['tables'];
  const totalRows = Object.values(tables).reduce((total, table) => total + table.rows, 0);
  return { tables, totalRows };
}

const primaryAfterSaveLineage: K2HostedActorLineageProof = {
  userConceptStateRows: 1,
  reviewItemRows: 1,
  fsrsStateRows: 1,
  recognitionEvidenceCount: 0,
  listeningEvidenceCount: 0,
  productionEvidenceCount: 0,
  productionPositiveMass: '0',
  productionNegativeMass: '0',
  events: [],
};

describe('K2-07 post-save actor fixture', () => {
  it('requires one primary intent projection row while competence evidence remains zero', () => {
    const snapshot = actorSnapshot({
      users: 1,
      learner_profiles: 1,
      user_languages: 1,
      concept_save_intents: 1,
      learning_events: 1,
      user_concept_states: 1,
      review_items: 1,
      fsrs_states: 1,
    });

    expect(K2_07_PRIMARY_AFTER_SAVE_ROWS.user_concept_states).toBe(1);
    expect(() => requireK2ActorSnapshotRows(snapshot, K2_07_PRIMARY_AFTER_SAVE_ROWS)).not.toThrow();
    expect(() => requireK2HostedLineage(primaryAfterSaveLineage, K2_07_PRIMARY_AFTER_SAVE_LINEAGE)).not.toThrow();
  });

  it.each([0, 2])('rejects a primary post-save projection with %s rows', stateRows => {
    const snapshot = actorSnapshot({
      users: 1,
      learner_profiles: 1,
      user_languages: 1,
      concept_save_intents: 1,
      learning_events: 1,
      user_concept_states: stateRows,
      review_items: 1,
      fsrs_states: 1,
    });

    expect(() => requireK2ActorSnapshotRows(snapshot, K2_07_PRIMARY_AFTER_SAVE_ROWS)).toThrow(
      'K2 hosted acceptance actor fixture did not match expected row counts.',
    );
    expect(() => requireK2HostedLineage(
      { ...primaryAfterSaveLineage, userConceptStateRows: stateRows },
      K2_07_PRIMARY_AFTER_SAVE_LINEAGE,
    )).toThrow('K2 hosted acceptance did not preserve one expected competence and FSRS lineage.');
  });

  it('keeps the observer projection empty after the primary actor saves', () => {
    const snapshot = actorSnapshot({
      users: 1,
      learner_profiles: 1,
      user_languages: 1,
      user_concept_states: 1,
    });

    expect(K2_07_OBSERVER_AFTER_PRIMARY_SAVE_ROWS.user_concept_states).toBe(0);
    expect(() => requireK2ActorSnapshotRows(snapshot, K2_07_OBSERVER_AFTER_PRIMARY_SAVE_ROWS)).toThrow(
      'K2 hosted acceptance actor fixture did not match expected row counts.',
    );
  });
});

describe('K2-07 fixture mode policy', () => {
  it('uses self-recall when no competence dimension has evidence', () => {
    expect(selectK2HostedExerciseMode(signals(), noMaterial)).toBe('self_recall');
  });

  it('skips a weaker dimension without canonical material and uses the next available mode', () => {
    expect(selectK2HostedExerciseMode(signals({
      listening: { score: 0.1, evidenceCount: 1 },
      production: { score: 0.3, evidenceCount: 1 },
    }), {
      ...noMaterial,
      hasTranslatedDefinition: true,
    })).toBe('typing');
  });

  it('selects the weakest observed dimension when its canonical material is available', () => {
    expect(selectK2HostedExerciseMode(signals({
      recognition: { score: 0.2, evidenceCount: 1 },
      production: { score: 0.3, evidenceCount: 1 },
    }), {
      hasTranslatedDefinition: true,
      hasHttpsAudio: false,
      hasPublishedClozeTarget: true,
    })).toBe('cloze');
  });

  it('rejects incomplete competence evidence instead of guessing a mode', () => {
    expect(() => selectK2HostedExerciseMode({ production: { score: 0.5, evidenceCount: 0 } }, noMaterial))
      .toThrow('competence signals were invalid');
  });
});
