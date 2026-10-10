import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertK2RetainedStateUnchanged,
  buildK2ProbeChildEnvironment,
  k2RetainedTableNames,
  parseK2ActorSnapshot,
  parseK2HostedMigrationProof,
  parseK2ActorOwnershipGraph,
  parseK2HostedTodayReviewTargets,
  parseK2HostedCandidateBaseProof,
  parseK2HostedDueCandidateOverlap,
  parseK2HostedFrllSemanticProof,
  parseK2HostedFixtureCapability,
  parseK2HostedCatalogPreflight,
  parsePilotReaderCatalogManifestProof,
  parsePilotReaderCompletionProof,
  parsePilotReaderMigrationProof,
  parseK2RetainedSnapshot,
  type K2RetainedSnapshot,
} from './k2_hosted_probe_client';
import { assertReviewedState, assertSavedState } from './k2_hosted_wave_k2_10';

type MutableK2RetainedSnapshot = {
  totalRows: number;
  tables: { -readonly [Table in keyof K2RetainedSnapshot['tables']]: { rows: number; sha256: string } };
};

const emptyActorSnapshot = (): MutableK2RetainedSnapshot => ({
  totalRows: 0,
  tables: Object.fromEntries(k2RetainedTableNames().map(name => [name, {
    rows: 0,
    sha256: '0'.repeat(64),
  }])) as MutableK2RetainedSnapshot['tables'],
});

function emptyFrllSemanticProof() {
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

describe('K2 read-only probe client', () => {
  it('accepts only the fixed actorless 72-pair Reader catalog proof', () => {
    const proof = {
      contentId: '550e8400-e29b-41d4-a716-446655440010',
      contentCount: 1,
      segmentCount: 72,
      sentenceCount: 72,
      translationCount: 72,
      conceptCount: 4,
      candidateSha256: '25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f',
      bodySha256: '180a51f21f5e26e43d49abcf2a828ae3b6b72a04671c101fbf1dfb5d7cd93e5e',
      translationSha256: 'a'.repeat(64),
      pairSha256: 'b'.repeat(64),
      contentProvenance: {
        authorMatched: true,
        sourceNameMatched: true,
        sourceVersionMatched: true,
        attributionMatched: true,
        rightsStatementMatched: true,
        approved: true,
        firstPartySource: true,
        firstPartyLicense: true,
      },
      translationProvenance: {
        sourceRecordCount: 1,
        authorMatched: true,
        sourceNameMatched: true,
        sourceVersionMatched: true,
        attributionMatched: true,
        rightsStatementMatched: true,
        approved: true,
        firstPartySource: true,
        firstPartyLicense: true,
      },
    };
    expect(parsePilotReaderCatalogManifestProof(proof)).toEqual(proof);
    expect(() => parsePilotReaderCatalogManifestProof({ ...proof, translationCount: 71 }))
      .toThrow('Reader catalog manifest proof was invalid');
    expect(() => parsePilotReaderCatalogManifestProof({
      ...proof,
      translationProvenance: { ...proof.translationProvenance, sourceRecordCount: 2 },
    })).toThrow('Reader catalog manifest proof was invalid');
    expect(() => parsePilotReaderCatalogManifestProof({
      ...proof,
      contentProvenance: { ...proof.contentProvenance, approved: false },
    })).toThrow('Reader catalog manifest proof was invalid');
    expect(() => parsePilotReaderCatalogManifestProof({ ...proof, rawRows: [] }))
      .toThrow('Reader catalog manifest proof was invalid');
  });

  it('keeps the Reader catalog manifest probe actorless in its child environment', () => {
    const env = buildK2ProbeChildEnvironment(
      'pilot_reader_catalog_manifest',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      undefined,
      { PATH: 'runner-path', SERVICE_ROLE_KEY: 'must-not-inherit', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'secret' },
    );
    expect(env.K2_ACCEPTANCE_PROBE_ACTION).toBe('pilot_reader_catalog_manifest');
    expect(env.K2_ACCEPTANCE_ACTOR_ID).toBeUndefined();
    expect(env.SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN).toBeUndefined();
    expect(() => buildK2ProbeChildEnvironment(
      'pilot_reader_catalog_manifest',
      'read-only-url',
      '550e8400-e29b-41d4-a716-446655440000',
      { PATH: 'runner-path' },
    )).toThrow('Reader catalog probe is actorless');
  });

  it('pins the passive Reader completion probe to an exact actor/profile/final-segment binding', () => {
    const actorId = '00000000-0000-4000-8000-000000000001';
    const profileId = '00000000-0000-4000-8000-000000000002';
    const contentId = '00000000-0000-4000-8000-000000000003';
    const segmentId = '00000000-0000-4000-8000-000000000004';
    const conceptIds = [
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000006',
    ];
    const before = buildK2ProbeChildEnvironment(
      'pilot_reader_completion',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      actorId,
      { PATH: 'runner-path', SERVICE_ROLE_KEY: 'must-not-inherit', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'secret' },
      profileId,
      conceptIds,
      undefined,
      { phase: 'before', contentId, segmentId },
    );
    expect(before.K2_ACCEPTANCE_PILOT_READER_BINDING).toBe(JSON.stringify({ phase: 'before', contentId, segmentId }));
    expect(before.K2_ACCEPTANCE_CONCEPT_IDS).toBe(JSON.stringify(conceptIds));
    expect(before).not.toHaveProperty('K2_ACCEPTANCE_IDEMPOTENCY_KEY_SHA256');
    expect(before).not.toHaveProperty('SERVICE_ROLE_KEY');
    expect(before).not.toHaveProperty('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
    expect(Object.keys(before).sort()).toEqual([
      'K2_ACCEPTANCE_ACTOR_ID', 'K2_ACCEPTANCE_CONCEPT_IDS', 'K2_ACCEPTANCE_PILOT_READER_BINDING',
      'K2_ACCEPTANCE_PROFILE_ID', 'K2_ACCEPTANCE_PROBE_ACTION', 'K2_STAGING_READONLY_DATABASE_URL', 'PATH',
    ].sort());
    expect(() => buildK2ProbeChildEnvironment(
      'pilot_reader_completion', 'read-only-url', actorId, { PATH: 'runner-path' }, profileId,
      conceptIds, undefined,
    )).toThrow(/exact actor\/profile binding/);
    expect(() => buildK2ProbeChildEnvironment(
      'pilot_reader_completion', 'read-only-url', actorId, { PATH: 'runner-path' }, profileId,
      [conceptIds[0]!, conceptIds[0]!], undefined, { phase: 'before', contentId, segmentId },
    )).toThrow(/exact actor\/profile binding/);

    const after = buildK2ProbeChildEnvironment(
      'pilot_reader_completion', 'read-only-url', actorId, { PATH: 'runner-path' }, profileId,
      conceptIds, 'a'.repeat(64), {
        phase: 'after', contentId, segmentId,
        exposureId: '00000000-0000-4000-8000-000000000007',
        projectionHeadBefore: { stateVersion: 4, nextIngestionSequence: 4 },
      },
    );
    expect(after.K2_ACCEPTANCE_IDEMPOTENCY_KEY_SHA256).toBe('a'.repeat(64));
    expect(after.K2_ACCEPTANCE_PILOT_READER_BINDING).toContain('projectionHeadBefore');
  });

  it('accepts only exact neutral passive-state reconciliation for every final concept', () => {
    const ids = [
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000006',
    ];
    const stableRows = {
      exposure_events: { rows: 1, sha256: 'a'.repeat(64) },
      learning_events: { rows: 2, sha256: 'b'.repeat(64) },
      reader_exposure_concepts: { rows: 1, sha256: 'c'.repeat(64) },
      user_concept_states: { rows: 1, sha256: 'd'.repeat(64) },
    };
    const before = {
      phase: 'before', eligibleConceptIds: ids, exposureEventIds: [], linkedConceptIds: [],
      learningConceptIds: [], conceptStates: [], skillStateCount: 3,
      skillNames: ['listening', 'production', 'recognition'], skillStatesPassiveOnly: true,
      projectionHead: {
        rowCount: 1, stateVersion: 4, nextIngestionSequence: 4,
        parameterVersion: 'competence-beta-v1', immutableSha256: 'e'.repeat(64),
        updatedAtMatchesCompletion: null,
      },
      stableRows,
    };
    expect(parsePilotReaderCompletionProof(before)).toEqual(before);

    const after = {
      phase: 'after', eligibleConceptIds: ids,
      exposureEventIds: ['00000000-0000-4000-8000-000000000007'],
      linkedConceptIds: ids, learningConceptIds: ids,
      conceptStates: ids.map(conceptId => ({ conceptId, status: 'discovered', exposureCount: 1, passiveOnly: true })),
      skillStateCount: 3,
      skillNames: ['listening', 'production', 'recognition'], skillStatesPassiveOnly: true,
      projectionHead: {
        rowCount: 1, stateVersion: 6, nextIngestionSequence: 6,
        parameterVersion: 'competence-beta-v1', immutableSha256: 'e'.repeat(64),
        updatedAtMatchesCompletion: true,
      },
      stableRows,
    };
    expect(parsePilotReaderCompletionProof(after)).toEqual(after);
    expect(() => parsePilotReaderCompletionProof({
      ...after, linkedConceptIds: [...ids, '00000000-0000-4000-8000-000000000008'],
    })).toThrow(/completion proof was invalid/);
    expect(() => parsePilotReaderCompletionProof({
      ...after, exposureEventIds: [...after.exposureEventIds, '00000000-0000-4000-8000-000000000009'],
    })).toThrow(/completion proof was invalid/);
    expect(() => parsePilotReaderCompletionProof({
      ...after,
      conceptStates: after.conceptStates.map((state, index) =>
        index === 1 ? { ...state, passiveOnly: false } : state),
    })).toThrow(/completion proof was invalid/);
    expect(() => parsePilotReaderCompletionProof({ ...after, stableRows: { ...stableRows, extra: { rows: 0, sha256: '0'.repeat(64) } } }))
      .toThrow(/completion proof was invalid/);
    expect(() => parsePilotReaderCompletionProof({
      ...after, stableRows: { ...stableRows, user_concept_states: { rows: -1, sha256: 'd'.repeat(64) } },
    })).toThrow(/completion proof was invalid/);
    expect(() => parsePilotReaderCompletionProof({
      ...after, projectionHead: { ...after.projectionHead, updatedAtMatchesCompletion: false },
    })).toThrow(/completion proof was invalid/);
    expect(() => parsePilotReaderCompletionProof({
      ...before, projectionHead: { ...before.projectionHead, immutableSha256: 'not-a-hash' },
    })).toThrow(/completion proof was invalid/);
  });

  it('requires every pinned public learner table and visible retained rows', () => {
    const snapshot = emptyActorSnapshot();
    snapshot.totalRows = 2;
    snapshot.tables.users.rows = 1;
    snapshot.tables.learner_profiles.rows = 1;
    expect(parseK2RetainedSnapshot(snapshot).totalRows).toBe(2);
    expect(() => parseK2RetainedSnapshot({ ...snapshot, tables: { users: snapshot.tables.users } }))
      .toThrow('incomplete table inventory');
  });

  it('supports actor-specific zero proof and catches any residual owner row', () => {
    expect(parseK2ActorSnapshot(emptyActorSnapshot()).totalRows).toBe(0);
    const residual = emptyActorSnapshot();
    residual.totalRows = 1;
    residual.tables.review_items.rows = 1;
    expect(parseK2ActorSnapshot(residual).tables.review_items.rows).toBe(1);
  });

  it('detects a retained table digest or count change', () => {
    const before = emptyActorSnapshot();
    const after = emptyActorSnapshot();
    after.tables.users.rows = 1;
    after.totalRows = 1;
    expect(() => assertK2RetainedStateUnchanged(before, after)).toThrow('retained learner-state snapshot changed');
  });

  it('requires the approved application migration head and exact count', () => {
    expect(parseK2HostedMigrationProof({ appMigrationHead: '0021', appliedMigrations: 21 }))
      .toEqual({ appMigrationHead: '0021', appliedMigrations: 21 });
    expect(() => parseK2HostedMigrationProof({ appMigrationHead: '0019', appliedMigrations: 19 }))
      .toThrow('staging migration head does not match');
    expect(() => parseK2HostedMigrationProof({ appMigrationHead: '0021', appliedMigrations: 20 }))
      .toThrow('staging migration head does not match');
    expect(() => parseK2HostedMigrationProof({ appMigrationHead: '0020', appliedMigrations: 21 }))
      .toThrow('staging migration head does not match');
  });

  it('accepts the fixed PILOT-READER migration proof without actor identity or extra fields', () => {
    const proof = { appMigrationHead: '0022', appliedMigrations: 22 };
    expect(parsePilotReaderMigrationProof(proof)).toEqual(proof);
    expect(() => parsePilotReaderMigrationProof({ ...proof, actorId: 'private-actor-marker' }))
      .toThrow('PILOT-READER migration probe returned invalid output');
    expect(() => parsePilotReaderMigrationProof({ appMigrationHead: '0021', appliedMigrations: 21 }))
      .toThrow('reviewed 0022 source');
  });

  it('keeps the PILOT-READER migration action actorless and passes verified actor IDs only in child env', () => {
    const url = 'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require';
    const systemEnv = { PATH: 'runner-path', SERVICE_ROLE_KEY: 'must-not-inherit' };
    const migrations = buildK2ProbeChildEnvironment('pilot_reader_migrations', url, undefined, systemEnv);
    expect(migrations.K2_ACCEPTANCE_PROBE_ACTION).toBe('pilot_reader_migrations');
    expect(migrations.K2_ACCEPTANCE_ACTOR_ID).toBeUndefined();
    expect(migrations.SERVICE_ROLE_KEY).toBeUndefined();
    expect(() => buildK2ProbeChildEnvironment(
      'pilot_reader_migrations', url, '00000000-0000-4000-8000-000000000001', systemEnv,
    )).toThrow('migration proof is actorless');

    const actorId = '00000000-0000-4000-8000-000000000001';
    const retained = buildK2ProbeChildEnvironment(
      'pilot_reader_retained_snapshot_excluding_actor', url, actorId, systemEnv,
    );
    expect(retained.K2_ACCEPTANCE_ACTOR_ID).toBe(actorId);
    expect(Object.keys(retained)).toEqual([
      'PATH', 'K2_STAGING_READONLY_DATABASE_URL', 'K2_ACCEPTANCE_PROBE_ACTION', 'K2_ACCEPTANCE_ACTOR_ID',
    ]);
    expect(() => buildK2ProbeChildEnvironment(
      'pilot_reader_retained_snapshot_excluding_actor', url, undefined, systemEnv,
    )).toThrow('verified actor binding');
  });

  it('accepts only the complete pinned Auth ownership and incoming-FK closure proof', () => {
    const proof = {
      ownershipGraphValid: true,
      ownedTableCount: 27,
      ownershipEdgeCount: 27,
      incomingConstraintCount: 51,
    } as const;
    expect(parseK2ActorOwnershipGraph(proof)).toEqual(proof);
    expect(() => parseK2ActorOwnershipGraph({ ...proof, incomingConstraintCount: 50 }))
      .toThrow('actor ownership graph proof was invalid');
    expect(() => parseK2ActorOwnershipGraph({ ...proof, ownershipGraphValid: false }))
      .toThrow('actor ownership graph proof was invalid');
    expect(() => parseK2ActorOwnershipGraph({ ...proof, unexpected: true }))
      .toThrow('actor ownership graph proof was invalid');
  });

  it('parses only a bounded actor-scoped Today mapping and rejects malformed targets', () => {
    const proof = {
      engineVersion: 'today-heuristic-v2',
      activityCount: 1,
      reviewActivityCount: 1,
      targetCount: 2,
      reviewItemIds: [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ],
    };
    expect(parseK2HostedTodayReviewTargets(proof)).toEqual(proof);
    expect(() => parseK2HostedTodayReviewTargets({ ...proof, targetCount: 181, reviewItemIds: [] }))
      .toThrow('Today target probe returned invalid output');
    expect(() => parseK2HostedTodayReviewTargets({
      ...proof,
      reviewItemIds: [proof.reviewItemIds[0], proof.reviewItemIds[0]],
    })).toThrow('Today target probe returned invalid output');
    expect(() => parseK2HostedTodayReviewTargets({ ...proof, reviewItemIds: ['private-target-marker'] }))
      .toThrow('Today target probe returned invalid output');
  });

  it('passes only the read-only URL, action, actor identity, and available runner basics to the probe child', () => {
    const systemEnv: NodeJS.ProcessEnv = { PATH: 'runner-path', PGSSLROOTCERT: '/runner/supabase-root.crt', SUPABASE_SECRET_KEY: 'must-not-inherit', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'must-not-inherit' };
    const environment = buildK2ProbeChildEnvironment(
      'actor_absent',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      '550e8400-e29b-41d4-a716-446655440000',
      systemEnv,
    );
    expect(environment).toEqual(expect.objectContaining({
      PATH: 'runner-path',
      PGSSLROOTCERT: '/runner/supabase-root.crt',
      K2_ACCEPTANCE_PROBE_ACTION: 'actor_absent',
      K2_ACCEPTANCE_ACTOR_ID: '550e8400-e29b-41d4-a716-446655440000',
    }));
    expect(environment).not.toHaveProperty('SUPABASE_SECRET_KEY');
    expect(environment).not.toHaveProperty('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
    expect(Object.keys(environment).sort()).toEqual([
      'K2_ACCEPTANCE_ACTOR_ID',
      'K2_ACCEPTANCE_PROBE_ACTION',
      'K2_STAGING_READONLY_DATABASE_URL',
      'PATH',
      'PGSSLROOTCERT',
      ...(process.platform === 'win32' && systemEnv.SystemRoot ? ['SystemRoot'] : []),
    ].sort());
  });

  it('parses the fixed-anchor FRLL proof without exposing row identities and rejects shape drift', () => {
    const proof = emptyFrllSemanticProof();
    expect(parseK2HostedFrllSemanticProof(proof)).toMatchObject({
      identity: { profileBound: false },
      review: { eventRows: 0, resultMemory: null },
      projection: { skillRows: 0 },
    });
    expect(() => parseK2HostedFrllSemanticProof({ ...proof, actorId: 'private-actor-marker' }))
      .toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof({
      ...proof,
      identity: { ...proof.identity, profileBound: true },
    })).toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof({
      ...proof,
      memory: { ...proof.memory, state: 'review', rowCount: 0 },
    })).toThrow('FRLL semantic proof was invalid');
  });

  it('preserves nullable mastery for a present concept row and rejects invalid null semantics', () => {
    const proof = emptyFrllSemanticProof();
    const saved = {
      ...proof,
      identity: { userRows: 1, learnerProfileRows: 1, languageProfileRows: 1, profileBound: true },
      concept: {
        ...proof.concept,
        rowCount: 1,
        status: 'learning',
        mastery: null,
        confidence: '0',
        exposureCount: 0,
        lastSeenAt: null,
        stateVersion: 2,
        hasLearningIntent: true,
        hasProjectableEvidence: false,
        recognition: { score: '0.5', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
        listening: { score: '0.5', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
        production: { score: '0.5', confidence: '0', evidenceCount: 0, lastEvidenceAt: null },
      },
    };
    expect(parseK2HostedFrllSemanticProof(saved).concept.mastery).toBeNull();
    expect(() => parseK2HostedFrllSemanticProof({
      ...saved,
      concept: { ...saved.concept, mastery: 0.5 },
    })).toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof({
      ...proof,
      concept: { ...proof.concept, mastery: '0.5' },
    })).toThrow('FRLL semantic proof was invalid');
  });

  it.runIf(process.env.K2_FRLL_PG_PROOF_ROUNDTRIP === '1')(
    'round-trips actual DB FRLL proof through parser and wave checks',
    () => {
      let payload: unknown;
      try {
        payload = JSON.parse(readFileSync(0, 'utf8')) as unknown;
      } catch {
        throw new Error('PostgreSQL FRLL proof roundtrip input was invalid.');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('PostgreSQL FRLL proof roundtrip input was invalid.');
      }
      const proofs = payload as Record<string, unknown>;
      const saved = parseK2HostedFrllSemanticProof(proofs.saved);
      const reviewed = parseK2HostedFrllSemanticProof(proofs.reviewed);
      assertSavedState(saved);
      assertReviewedState(reviewed, true);
      process.stdout.write(`K2_FRLL_ROUNDTRIP_PASS savedStatus=${saved.concept.status}\n`);
    },
  );

  it('keeps persisted exercise mode separate from its evidence mode and rejects enum confusion', () => {
    const proof = emptyFrllSemanticProof();
    const reviewed = {
      ...proof,
      review: {
        ...proof.review,
        eventRows: 1,
        reviewLearningEventRows: 1,
        rating: 'good',
        responseTimeMs: 1200,
        correct: null,
        exerciseMode: 'self_recall',
        evidenceMode: 'production',
        resultMemory: {
          state: 'review', dueAt: '2026-10-08T00:00:00Z', lastReviewedAt: '2026-10-08T00:00:00Z',
          difficulty: '5.0', stability: '2.1', step: null, stateVersion: 2, paramsVersion: 'fsrs-1',
        },
        resultCompetence: Object.fromEntries(['recognition', 'listening', 'production'].map(dimension => [dimension, {
          score: '0.5', confidence: '0.25', evidenceCount: 1, updatedAt: '2026-10-08T00:00:00Z',
        }])),
      },
    };
    expect(parseK2HostedFrllSemanticProof(reviewed).review).toMatchObject({
      exerciseMode: 'self_recall', evidenceMode: 'production',
    });
    expect(parseK2HostedFrllSemanticProof({
      ...reviewed,
      review: { ...reviewed.review, correct: true },
    }).review.correct).toBe(true);
    expect(parseK2HostedFrllSemanticProof({
      ...reviewed,
      review: { ...reviewed.review, correct: false },
    }).review.correct).toBe(false);
    expect(() => parseK2HostedFrllSemanticProof({
      ...reviewed,
      review: { ...reviewed.review, correct: 'true' },
    })).toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof({
      ...reviewed,
      review: { ...reviewed.review, correct: true, exerciseMode: 'typing' },
    })).toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof({
      ...reviewed,
      review: { ...reviewed.review, exerciseMode: 'production' },
    })).toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof({
      ...reviewed,
      review: { ...reviewed.review, evidenceMode: 'self_recall' },
    })).toThrow('FRLL semantic proof was invalid');
  });

  it('validates persisted FSRS state and nullable step against the database shape constraint', () => {
    const proof = emptyFrllSemanticProof();
    const timestamp = '2026-10-08T00:00:00Z';
    const persisted = (state: string, step: number | null, fresh = false) => ({
      ...proof,
      memory: {
        rowCount: 1,
        state,
        stateVersion: fresh ? 1 : 2,
        dueAt: timestamp,
        lastReviewedAt: fresh ? null : timestamp,
        difficulty: fresh ? null : '5.0',
        stability: fresh ? null : '2.1',
        step,
        paramsVersion: 'fsrs-1',
      },
    });
    for (const [state, step, fresh] of [
      ['new', null, true],
      ['learning', 0, false],
      ['relearning', 1, false],
      ['review', null, false],
    ] as const) {
      expect(parseK2HostedFrllSemanticProof(persisted(state, step, fresh)).memory.state).toBe(state);
    }
    expect(() => parseK2HostedFrllSemanticProof(persisted('new', 0, true)))
      .toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof(persisted('learning', null)))
      .toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof(persisted('review', 0)))
      .toThrow('FRLL semantic proof was invalid');
  });

  it('requires completed review snapshots to use a reviewed FSRS state shape', () => {
    const proof = emptyFrllSemanticProof();
    const timestamp = '2026-10-08T00:00:00Z';
    const reviewedWith = (state: string, step: number | null) => ({
      ...proof,
      review: {
        ...proof.review,
        eventRows: 1,
        reviewLearningEventRows: 1,
        rating: 'good',
        responseTimeMs: 1200,
        correct: null,
        exerciseMode: 'self_recall' as const,
        evidenceMode: 'production' as const,
        resultMemory: {
          state, dueAt: timestamp, lastReviewedAt: timestamp,
          difficulty: '5.0', stability: '2.1', step, stateVersion: 2, paramsVersion: 'fsrs-1',
        },
        resultCompetence: Object.fromEntries(['recognition', 'listening', 'production'].map(dimension => [dimension, {
          score: '0.5', confidence: '0.25', evidenceCount: 1, updatedAt: timestamp,
        }])),
      },
    });
    expect(parseK2HostedFrllSemanticProof(reviewedWith('learning', 0)).review.eventRows).toBe(1);
    expect(parseK2HostedFrllSemanticProof(reviewedWith('review', null)).review.eventRows).toBe(1);
    expect(() => parseK2HostedFrllSemanticProof(reviewedWith('new', null)))
      .toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof(reviewedWith('review', 0)))
      .toThrow('FRLL semantic proof was invalid');
    expect(() => parseK2HostedFrllSemanticProof(reviewedWith('learning', null)))
      .toThrow('FRLL semantic proof was invalid');
  });

  it('passes only a fresh actor/profile and hash to the fixed FRLL semantic probe', () => {
    const systemEnv: NodeJS.ProcessEnv = {
      PATH: 'runner-path',
      PGSSLROOTCERT: '/runner/supabase-root.crt',
      SUPABASE_SECRET_KEY: 'must-not-inherit',
      K2_ACCEPTANCE_IDEMPOTENCY_KEY: 'must-not-inherit',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'must-not-inherit',
    };
    const env = buildK2ProbeChildEnvironment(
      'frll_anchor_semantic_proof',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      '00000000-0000-4000-8000-000000000001',
      systemEnv,
      '00000000-0000-4000-8000-000000000002',
      undefined,
      'a'.repeat(64),
    );
    expect(env.K2_ACCEPTANCE_PROBE_ACTION).toBe('frll_anchor_semantic_proof');
    expect(env.K2_ACCEPTANCE_ACTOR_ID).toBe('00000000-0000-4000-8000-000000000001');
    expect(env.K2_ACCEPTANCE_PROFILE_ID).toBe('00000000-0000-4000-8000-000000000002');
    expect(env.K2_ACCEPTANCE_IDEMPOTENCY_KEY_SHA256).toBe('a'.repeat(64));
    expect(env.K2_ACCEPTANCE_IDEMPOTENCY_KEY).toBeUndefined();
    expect(env.SUPABASE_SECRET_KEY).toBeUndefined();
    expect(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN).toBeUndefined();
    expect(() => buildK2ProbeChildEnvironment(
      'frll_anchor_semantic_proof',
      'read-only-url',
      '00000000-0000-4000-8000-000000000001',
      systemEnv,
      '00000000-0000-4000-8000-000000000002',
      undefined,
      'raw-idempotency-key',
    )).toThrow('SHA-256 key digest');
  });

  it('passes only exact fresh actor/profile bindings to the candidate probe child', () => {
    const actorId = '550e8400-e29b-41d4-a716-446655440000';
    const profileId = '550e8400-e29b-41d4-a716-446655440001';
    const environment = buildK2ProbeChildEnvironment(
      'k208_candidate_base',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      actorId,
      { PATH: 'runner-path', SERVICE_ROLE_KEY: 'must-not-inherit', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'secret' },
      profileId,
    );
    expect(environment).toMatchObject({
      K2_ACCEPTANCE_PROBE_ACTION: 'k208_candidate_base',
      K2_ACCEPTANCE_ACTOR_ID: actorId,
      K2_ACCEPTANCE_PROFILE_ID: profileId,
    });
    expect(environment).not.toHaveProperty('SERVICE_ROLE_KEY');
    expect(environment).not.toHaveProperty('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
    expect(Object.keys(environment).sort()).toEqual([
      'K2_ACCEPTANCE_ACTOR_ID', 'K2_ACCEPTANCE_PROFILE_ID', 'K2_ACCEPTANCE_PROBE_ACTION',
      'K2_STAGING_READONLY_DATABASE_URL', 'PATH',
    ].sort());
  });

  it('passes only the fixed twenty actor-bound due IDs into the read-only catalog membership child', () => {
    const actorId = '550e8400-e29b-41d4-a716-446655440000';
    const profileId = '550e8400-e29b-41d4-a716-446655440001';
    const conceptIds = Array.from({ length: 20 }, (_, index) =>
      `550e8400-e29b-41d4-a716-44665544${(index + 16).toString(16).padStart(4, '0')}`);
    const environment = buildK2ProbeChildEnvironment(
      'k208_due_candidate_overlap',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      actorId,
      { PATH: 'runner-path', SERVICE_ROLE_KEY: 'must-not-inherit', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'secret' },
      profileId,
      conceptIds,
    );
    expect(environment.K2_ACCEPTANCE_CONCEPT_IDS).toBe(JSON.stringify(conceptIds));
    expect(environment).not.toHaveProperty('SERVICE_ROLE_KEY');
    expect(environment).not.toHaveProperty('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
    expect(Object.keys(environment).sort()).toEqual([
      'K2_ACCEPTANCE_ACTOR_ID', 'K2_ACCEPTANCE_CONCEPT_IDS', 'K2_ACCEPTANCE_PROFILE_ID',
      'K2_ACCEPTANCE_PROBE_ACTION', 'K2_STAGING_READONLY_DATABASE_URL', 'PATH',
    ].sort());
    expect(() => buildK2ProbeChildEnvironment(
      'k208_due_candidate_overlap',
      'postgresql://reader:placeholder@db.example.invalid/postgres?sslmode=require',
      actorId, { PATH: 'runner-path' }, profileId, conceptIds.slice(1),
    )).toThrow('exactly twenty unique concepts');
    expect(parseK2HostedDueCandidateOverlap({ overlapCount: 0 })).toEqual({ overlapCount: 0 });
    expect(() => parseK2HostedDueCandidateOverlap({ overlapCount: 21 }))
      .toThrow('due-content membership proof was invalid');
    expect(() => parseK2HostedDueCandidateOverlap({ overlapCount: 0, conceptIds }))
      .toThrow('due-content membership proof was invalid');
  });

  it('accepts only bounded candidate proof fields and current capability metadata booleans', () => {
    const candidate = {
      contentId: '550e8400-e29b-41d4-a716-446655440010',
      estimatedMinutes: 5,
      linkedConceptIds: ['550e8400-e29b-41d4-a716-446655440020'],
      unseenCount: 1,
      isSaved: false,
      isUnfinished: false,
      isCompleted: false,
    };
    expect(parseK2HostedCandidateBaseProof({ candidates: [candidate], stateConceptIds: [], stateStatuses: [] }))
      .toMatchObject({ candidates: [candidate] });
    expect(() => parseK2HostedCandidateBaseProof({
      candidates: [{ ...candidate, email: 'learner@example.invalid' }],
      stateConceptIds: [],
      stateStatuses: [],
    })).toThrow('candidate base proof was invalid');
    expect(parseK2HostedCandidateBaseProof({
      candidates: [candidate],
      stateConceptIds: ['550e8400-e29b-41d4-a716-446655440020'],
      stateStatuses: [{
        conceptId: '550e8400-e29b-41d4-a716-446655440020', status: 'weak', stateVersion: 1,
      }],
    }).stateStatuses[0].status).toBe('weak');
    expect(() => parseK2HostedCandidateBaseProof({
      candidates: [candidate],
      stateConceptIds: ['550e8400-e29b-41d4-a716-446655440020'],
      stateStatuses: [{
        conceptId: '550e8400-e29b-41d4-a716-446655440020', status: 'weak', stateVersion: 1,
        userId: 'private-actor-marker',
      }],
    })).toThrow('candidate base proof was invalid');
    expect(parseK2HostedFixtureCapability({
      authBoundaryUnchanged: true,
      fixtureCapabilityReady: true,
      learnerOwnerRlsPolicyBaseline: true,
      readerSelectOnly: true,
      serviceFixtureAndViewAclBaseline: true,
    }).fixtureCapabilityReady).toBe(true);
    expect(() => parseK2HostedFixtureCapability({ fixtureCapabilityReady: true }))
      .toThrow('fixture privilege proof was invalid');
    expect(parseK2HostedCatalogPreflight({
      eligibleContentCount: 3,
      fiveMinuteRemediationCount: 2,
      hasNovelControl: true,
      sourceRankShapeAvailable: true,
    }).eligibleContentCount).toBe(3);
  });
});
