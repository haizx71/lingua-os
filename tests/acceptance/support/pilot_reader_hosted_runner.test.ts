import { describe, expect, it } from 'vitest';
import type { components } from '../../../packages/types/src/generated/openapi';
import {
  assertExactReaderExposureCount,
  assertPilotReaderCompletionDeltas,
  assertPilotReaderCatalogProof,
  assertPilotReaderCompletionProofs,
  assertPilotReaderExposureReplay,
  assertPilotReaderTodayDeltas,
  canClaimOneShotReaderCommand,
  classifyPilotReaderRequest,
  loadPilotReaderCandidateFiles,
  pilotReaderSelectionUrl,
  type ReaderTarget,
} from './pilot_reader_hosted_runner';
import {
  k2RetainedTableNames,
  type K2RetainedSnapshot,
  type PilotReaderCatalogManifestProof,
  type PilotReaderCompletionProof,
} from './k2_hosted_probe_client';

const CONTENT_ID = '00000000-0000-4000-8000-000000000001';
const PROFILE_ID = '00000000-0000-4000-8000-000000000002';
const SEGMENT_ID = '00000000-0000-4000-8000-000000000003';
const SENTENCE_ID = '00000000-0000-4000-8000-000000000004';
const CONCEPT_ID = '00000000-0000-4000-8000-000000000005';
const EXPOSURE_ID = '00000000-0000-4000-8000-000000000006';

type MutableSnapshot = {
  totalRows: number;
  tables: { -readonly [Table in keyof K2RetainedSnapshot['tables']]: { rows: number; sha256: string } };
};

function actorSnapshot(
  rowOverrides: Readonly<Partial<Record<keyof K2RetainedSnapshot['tables'], number>>> = {},
  changedTables: readonly (keyof K2RetainedSnapshot['tables'])[] = [],
): K2RetainedSnapshot {
  const tables = Object.fromEntries(k2RetainedTableNames().map((name, index) => [name, {
    rows: rowOverrides[name] ?? 0,
    sha256: changedTables.includes(name) ? (index + 1).toString(16).padStart(64, '0') : '0'.repeat(64),
  }])) as MutableSnapshot['tables'];
  return { tables, totalRows: Object.values(tables).reduce((sum, table) => sum + table.rows, 0) };
}

function proof(candidate: Awaited<ReturnType<typeof loadPilotReaderCandidateFiles>>): PilotReaderCatalogManifestProof {
  return {
    contentId: CONTENT_ID,
    contentCount: 1,
    segmentCount: 72,
    sentenceCount: 72,
    translationCount: 72,
    conceptCount: 72,
    candidateSha256: '25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f',
    bodySha256: '180a51f21f5e26e43d49abcf2a828ae3b6b72a04671c101fbf1dfb5d7cd93e5e',
    translationSha256: candidate.translationSha256,
    pairSha256: candidate.pairSha256,
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
}

function target(): ReaderTarget {
  const annotation = {
    segmentId: SEGMENT_ID,
    sentenceId: SENTENCE_ID,
    conceptId: CONCEPT_ID,
    startOffset: 0,
    endOffset: 4,
    segmentIndex: 0,
    surfaceText: 'word',
  };
  return {
    contentId: CONTENT_ID,
    segmentIds: [SEGMENT_ID],
    sentenceIds: [SENTENCE_ID],
    annotations: [annotation],
    finalConceptIds: [],
    revealSentenceIndex: 0,
    selectedAnnotation: annotation,
  };
}

function completionProof(phase: 'before' | 'after'): PilotReaderCompletionProof {
  const eligibleConceptIds = [CONCEPT_ID, SENTENCE_ID].sort();
  return {
    phase,
    eligibleConceptIds,
    exposureEventIds: phase === 'before' ? [] : [EXPOSURE_ID],
    linkedConceptIds: phase === 'before' ? [] : eligibleConceptIds,
    learningConceptIds: phase === 'before' ? [] : eligibleConceptIds,
    conceptStates: phase === 'before' ? [] : eligibleConceptIds.map(conceptId => ({
      conceptId, status: 'discovered', exposureCount: 1, passiveOnly: true,
    })),
    skillStateCount: 3,
    skillNames: ['listening', 'production', 'recognition'],
    skillStatesPassiveOnly: true,
    projectionHead: {
      rowCount: 1,
      stateVersion: phase === 'before' ? 4 : 6,
      nextIngestionSequence: phase === 'before' ? 4 : 6,
      parameterVersion: 'competence-beta-v1',
      immutableSha256: 'e'.repeat(64),
      updatedAtMatchesCompletion: phase === 'before' ? null : true,
    },
    stableRows: {
      exposure_events: { rows: 1, sha256: 'a'.repeat(64) },
      learning_events: { rows: 2, sha256: 'b'.repeat(64) },
      reader_exposure_concepts: { rows: 1, sha256: 'c'.repeat(64) },
      user_concept_states: { rows: 1, sha256: 'd'.repeat(64) },
    },
  };
}

const blockedState = {
  contentRequestArmed: false,
  contentRequestStarted: false,
  contentConfirmed: false,
  lookupArmed: false,
  completionArmed: false,
  reviewClickArmed: false,
  todayClickArmed: false,
  saveConfirmed: false,
  conceptReadConfirmed: false,
  readExposureConfirmed: false,
  progressConfirmed: false,
};

describe('PILOT-READER hosted acceptance harness', () => {
  it('pins the exact candidate and all 72 ordered English/Vietnamese pairs', async () => {
    const candidate = await loadPilotReaderCandidateFiles();
    expect(candidate.pairs).toHaveLength(72);
    expect(candidate.pairs.map(pair => pair.ordinal)).toEqual(
      Array.from({ length: 72 }, (_unused, index) => index + 1),
    );
    expect(candidate.pairs.every(pair => pair.english.trim() && pair.vietnamese.trim())).toBe(true);
    expect(candidate.translationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.pairSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts only the actorless full-catalog pin with approved first-party provenance', async () => {
    const candidate = await loadPilotReaderCandidateFiles();
    expect(assertPilotReaderCatalogProof(proof(candidate), candidate)).toBe(CONTENT_ID);

    const wrongPairs = { ...proof(candidate), pairSha256: '0'.repeat(64) } as PilotReaderCatalogManifestProof;
    expect(() => assertPilotReaderCatalogProof(wrongPairs, candidate)).toThrow(/catalog proof/);
    const wrongSource = {
      ...proof(candidate),
      translationProvenance: { ...proof(candidate).translationProvenance, sourceRecordCount: 2 },
    } as unknown as PilotReaderCatalogManifestProof;
    expect(() => assertPilotReaderCatalogProof(wrongSource, candidate)).toThrow(/catalog proof/);
    const unapproved = {
      ...proof(candidate),
      contentProvenance: { ...proof(candidate).contentProvenance, approved: false },
    } as unknown as PilotReaderCatalogManifestProof;
    expect(() => assertPilotReaderCatalogProof(unapproved, candidate)).toThrow(/catalog proof/);
  });

  it('keeps Review and Today requests behind explicit clicks and server completion', () => {
    const readerTarget = target();
    expect(classifyPilotReaderRequest(
      'https://pilot-reader.invalid/api/v1/review/queue', 'GET', PROFILE_ID, readerTarget, blockedState,
    )).toBeNull();
    expect(classifyPilotReaderRequest(
      'https://pilot-reader.invalid/api/v1/today', 'GET', PROFILE_ID, readerTarget, {
        ...blockedState, todayClickArmed: true,
      },
    )).toBeNull();
    const afterCompletedClick = classifyPilotReaderRequest(
      `https://pilot-reader.invalid/api/v1/today?languageProfileId=${PROFILE_ID}`,
      'GET', PROFILE_ID, readerTarget, {
        ...blockedState, todayClickArmed: true, progressConfirmed: true,
      },
    );
    expect(afterCompletedClick?.action).toBe('today');
    expect(classifyPilotReaderRequest(
      `https://pilot-reader.invalid/api/v1/review/queue?languageProfileId=${PROFILE_ID}`,
      'GET', PROFILE_ID, readerTarget, { ...blockedState, reviewClickArmed: true },
    )?.action).toBe('review_queue');
    expect(classifyPilotReaderRequest(
      `https://pilot-reader.invalid/api/v1/today?languageProfileId=${PROFILE_ID}&profile=${PROFILE_ID}`,
      'GET', PROFILE_ID, readerTarget, {
        ...blockedState, todayClickArmed: true, progressConfirmed: true,
      },
    )).toBeNull();
  });

  it('requires a confirmed concept lookup before Save and rejects foreign API routes', () => {
    const readerTarget = target();
    expect(classifyPilotReaderRequest(
      `https://pilot-reader.invalid/api/v1/library/concepts/${CONCEPT_ID}`,
      'PUT', PROFILE_ID, readerTarget, blockedState,
    )).toBeNull();
    expect(classifyPilotReaderRequest(
      `https://pilot-reader.invalid/api/v1/library/concepts/${CONCEPT_ID}`,
      'PUT', PROFILE_ID, readerTarget, { ...blockedState, conceptReadConfirmed: true },
    )?.action).toBe('concept_save');
    expect(classifyPilotReaderRequest(
      `https://other.invalid/api/v1/content/${CONTENT_ID}`,
      'GET', PROFILE_ID, readerTarget, { ...blockedState, contentRequestArmed: true },
    )).toBeNull();
  });

  it('requests only the exact actorless-pinned content identity through an armed direct GET', () => {
    const readerTarget = target();
    const url = `https://pilot-reader.invalid/api/v1/content/${CONTENT_ID}`;
    expect(pilotReaderSelectionUrl('https://reader.example', CONTENT_ID))
      .toBe(`https://reader.example/read?contentId=${CONTENT_ID}`);
    expect(() => pilotReaderSelectionUrl('https://reader.example', 'not-a-uuid')).toThrow(/identity/);
    expect(classifyPilotReaderRequest(url, 'GET', PROFILE_ID, readerTarget, blockedState)).toBeNull();
    expect(classifyPilotReaderRequest(url, 'GET', PROFILE_ID, readerTarget, {
      ...blockedState, contentRequestArmed: true,
    })?.action).toBe('content');
    expect(classifyPilotReaderRequest(url, 'GET', PROFILE_ID, readerTarget, {
      ...blockedState, contentRequestArmed: true, contentRequestStarted: true,
    })).toBeNull();
    expect(classifyPilotReaderRequest(url, 'GET', PROFILE_ID, readerTarget, {
      ...blockedState, contentRequestArmed: true, contentConfirmed: true,
    })).toBeNull();
    expect(classifyPilotReaderRequest(`${url}?unexpected=1`, 'GET', PROFILE_ID, readerTarget, {
      ...blockedState, contentRequestArmed: true,
    })).toBeNull();
    expect(classifyPilotReaderRequest(
      'https://pilot-reader.invalid/api/v1/content/recommended?languageProfileId=' + PROFILE_ID,
      'GET', PROFILE_ID, readerTarget, { ...blockedState, contentRequestArmed: true },
    )).toBeNull();
    expect(classifyPilotReaderRequest(
      'https://pilot-reader.invalid/api/v1/content/00000000-0000-4000-8000-000000000099',
      'GET', PROFILE_ID, readerTarget, { ...blockedState, contentRequestArmed: true },
    )).toBeNull();
  });

  it('proves exact one-shot final-segment passive deltas across all 27 actor tables', () => {
    const before = actorSnapshot({
      exposure_events: 1, learning_events: 2, reader_exposure_concepts: 1,
      user_concept_states: 1, user_language_projection_heads: 1, user_skill_states: 3,
    });
    const after = actorSnapshot({
      exposure_events: 2, learning_events: 4, reader_exposure_concepts: 3,
      reader_mutation_results: 1, user_concept_states: 3, user_content_progress: 1,
      user_language_projection_heads: 1, user_skill_states: 3,
    }, ['exposure_events', 'learning_events', 'reader_exposure_concepts',
      'reader_mutation_results', 'user_concept_states', 'user_content_progress',
      'user_language_projection_heads']);
    expect(() => assertPilotReaderCompletionDeltas(before, after, 2)).not.toThrow();

    const duplicateExposure = actorSnapshot({
      exposure_events: 3, learning_events: 4, reader_exposure_concepts: 3,
      reader_mutation_results: 1, user_concept_states: 3, user_content_progress: 1,
      user_language_projection_heads: 1, user_skill_states: 3,
    }, ['exposure_events', 'learning_events', 'reader_exposure_concepts',
      'reader_mutation_results', 'user_concept_states', 'user_content_progress',
      'user_language_projection_heads']);
    expect(() => assertPilotReaderCompletionDeltas(before, duplicateExposure, 2)).toThrow(/row deltas/);

    const activeMutation = actorSnapshot({
      exposure_events: 2, learning_events: 4, reader_exposure_concepts: 3,
      reader_mutation_results: 1, user_concept_states: 3, user_content_progress: 1,
      fsrs_states: 1, user_language_projection_heads: 1, user_skill_states: 3,
    }, ['exposure_events', 'learning_events', 'reader_exposure_concepts',
      'reader_mutation_results', 'user_concept_states', 'user_content_progress', 'fsrs_states',
      'user_language_projection_heads']);
    expect(() => assertPilotReaderCompletionDeltas(before, activeMutation, 2)).toThrow(/row deltas/);

    const changedStableDigest = actorSnapshot({
      exposure_events: 2, learning_events: 4, reader_exposure_concepts: 3,
      reader_mutation_results: 1, user_concept_states: 3, user_content_progress: 1,
      user_language_projection_heads: 1, user_skill_states: 3,
    }, ['exposure_events', 'learning_events', 'reader_exposure_concepts',
      'reader_mutation_results', 'user_concept_states', 'user_content_progress',
      'user_language_projection_heads', 'fsrs_states']);
    expect(() => assertPilotReaderCompletionDeltas(before, changedStableDigest, 2)).toThrow(/digest/);
  });

  it('rejects changes to retained positive-table rows and immutable projection lineage', () => {
    const before = completionProof('before');
    const after = completionProof('after');
    expect(() => assertPilotReaderCompletionProofs(before, after, before.eligibleConceptIds, EXPOSURE_ID))
      .not.toThrow();

    for (const table of [
      'exposure_events', 'learning_events', 'reader_exposure_concepts', 'user_concept_states',
    ] as const) {
      const changedStableDigest: PilotReaderCompletionProof = {
        ...after,
        stableRows: {
          ...after.stableRows,
          [table]: { ...after.stableRows[table], sha256: 'f'.repeat(64) },
        },
      };
      expect(() => assertPilotReaderCompletionProofs(
        before, changedStableDigest, before.eligibleConceptIds, EXPOSURE_ID,
      )).toThrow(/passive completion proof/);
    }

    const changedStableCount: PilotReaderCompletionProof = {
      ...after,
      stableRows: {
        ...after.stableRows,
        user_concept_states: { ...after.stableRows.user_concept_states, rows: 2 },
      },
    };
    expect(() => assertPilotReaderCompletionProofs(
      before, changedStableCount, before.eligibleConceptIds, EXPOSURE_ID,
    )).toThrow(/passive completion proof/);

    const changedHeadLineage: PilotReaderCompletionProof = {
      ...after,
      projectionHead: { ...after.projectionHead, immutableSha256: '0'.repeat(64) },
    };
    expect(() => assertPilotReaderCompletionProofs(
      before, changedHeadLineage, before.eligibleConceptIds, EXPOSURE_ID,
    )).toThrow(/passive completion proof/);
    const wrongCompletionTime: PilotReaderCompletionProof = {
      ...after,
      projectionHead: { ...after.projectionHead, updatedAtMatchesCompletion: false },
    };
    expect(() => assertPilotReaderCompletionProofs(
      before, wrongCompletionTime, before.eligibleConceptIds, EXPOSURE_ID,
    )).toThrow(/passive completion proof/);
  });

  it('bounds user-clicked Today writes to exactly the server-returned plan', () => {
    const before = actorSnapshot({ user_skill_states: 3 });
    const plan = {
      activities: [
        { activityType: 'review', targetCount: 2 },
        { activityType: 'read' },
      ],
    } as unknown as components['schemas']['TodayPlan'];
    const after = actorSnapshot({ today_plans: 1, today_plan_activities: 2, today_activity_review_items: 2, user_skill_states: 3 },
      ['today_plans', 'today_plan_activities', 'today_activity_review_items']);
    expect(() => assertPilotReaderTodayDeltas(before, after, plan)).not.toThrow();
    const extraProgression = actorSnapshot({ today_plans: 1, today_plan_activities: 2, today_activity_review_items: 2, fsrs_states: 1, user_skill_states: 3 },
      ['today_plans', 'today_plan_activities', 'today_activity_review_items', 'fsrs_states']);
    expect(() => assertPilotReaderTodayDeltas(before, extraProgression, plan)).toThrow(/row deltas/);
  });

  it('fails closed on repeated final exposure/progress commands and reconciles exact response count', () => {
    const body = { contentId: CONTENT_ID, exposureType: 'read' };
    expect(canClaimOneShotReaderCommand(undefined, undefined, '00000000-0000-4000-8000-000000000007', body)).toBe(true);
    expect(canClaimOneShotReaderCommand('00000000-0000-4000-8000-000000000007', body,
      '00000000-0000-4000-8000-000000000007', body)).toBe(false);
    expect(canClaimOneShotReaderCommand('00000000-0000-4000-8000-000000000007', body,
      '00000000-0000-4000-8000-000000000008', { ...body, segmentId: SEGMENT_ID })).toBe(false);
    expect(() => assertExactReaderExposureCount(2, 2)).not.toThrow();
    expect(() => assertExactReaderExposureCount(1, 2)).toThrow(/exact segment annotations/);
    expect(() => assertExactReaderExposureCount(3, 2)).toThrow(/exact segment annotations/);
  });

  it('requires exact idempotent replay of the accepted read exposure', () => {
    const original = {
      exposureId: EXPOSURE_ID, contentId: CONTENT_ID, segmentId: SEGMENT_ID,
      exposureType: 'read' as const, acceptedConceptCount: 2,
    };
    expect(() => assertPilotReaderExposureReplay(original, { ...original })).not.toThrow();
    expect(() => assertPilotReaderExposureReplay(original, { ...original, exposureId: SENTENCE_ID }))
      .toThrow(/replay did not match/);
    expect(() => assertPilotReaderExposureReplay(original, { ...original, acceptedConceptCount: 1 }))
      .toThrow(/replay did not match/);
  });
});
