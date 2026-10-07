import { describe, expect, it, vi } from 'vitest';
import { k2RetainedTableNames, type K2RetainedSnapshot } from './k2_hosted_probe_client';
import type { K2BoundWaveApi, K2HostedWaveContext } from './k2_hosted_runner';
import { k2HostedWaveK209 } from './k2_hosted_wave_k2_09';

const lemma = `kfixture${'a'.repeat(64)}`;
const fixture = {
  handles: {
    ownerConcept: 'k2-09-owner',
    secondaryConcept: 'k2-09-secondary',
    lexeme: 'k2-09-lexeme',
  },
  ids: {
    ownerConceptId: '00000000-0000-4000-8000-000000000001',
    secondaryConceptId: '00000000-0000-4000-8000-000000000002',
    lexemeId: '00000000-0000-4000-8000-000000000003',
  },
  lemma,
  inflectedForm: `${lemma}s`,
} as const;

function snapshot(): K2RetainedSnapshot {
  const tables = Object.fromEntries(k2RetainedTableNames().map(name => [name, {
    rows: 0,
    sha256: '0'.repeat(64),
  }])) as K2RetainedSnapshot['tables'];
  return { totalRows: 0, tables };
}

function competence(score: number, evidenceCount: number) {
  return Object.fromEntries(['recognition', 'listening', 'production'].map(dimension => [dimension, {
    score,
    confidence: score,
    evidenceCount,
  }]));
}

function createContext(badBridge = false) {
  const calls: Array<{ actor: string; route: string; method: string; options?: unknown }> = [];
  const checkpoints: string[] = [];
  const reports: string[] = [];
  const state = (actor: string, handle: string) => {
    const reviewedOwner = actor === 'primary' && handle === 'k2-09-owner';
    const status = reviewedOwner ? 'active' : 'discovered';
    const score = reviewedOwner ? 0.7 : actor === 'observer' && handle === 'k2-09-owner' ? 0.2 : 0.4;
    return { reviewedOwner, status, score };
  };
  const linkedConcept = (actor: string, handle: 'k2-09-owner' | 'k2-09-secondary') => {
    const value = state(actor, handle);
    return {
      concept: {
        id: handle,
        canonicalForm: handle,
        status: value.status,
        isDue: false,
      },
      competence: competence(value.score, value.reviewedOwner ? 1 : 0),
      mastery: null,
      confidence: value.score,
      exposureCount: 0,
      isSaved: actor === 'primary' ? handle === 'k2-09-owner' : handle === 'k2-09-secondary',
    };
  };
  const groupedPayload = (actor: string) => {
    const owner = linkedConcept(actor, 'k2-09-owner');
    const secondary = linkedConcept(actor, 'k2-09-secondary');
    return {
      data: [{ id: 'k2-09-owner' }, { id: 'k2-09-secondary' }],
      meta: { apiVersion: '1.0', hasMore: false, pageSize: 2, hasNextCursor: false },
      lemmaGroups: [{
        lexemeId: 'k2-09-lexeme',
        lemma,
        partOfSpeech: 'noun',
        matchedForms: [fixture.inflectedForm],
        senses: [
          {
            senseId: 'opaque-sense-one',
            senseOrder: 1,
            definition: 'K2-09 fixture sense one.',
            definitionLanguageCode: 'en',
            concepts: badBridge
              ? [{ ...owner, concept: { ...owner.concept, id: 'outside-fixture' } }, secondary]
              : [owner, secondary],
          },
          {
            senseId: 'opaque-sense-two',
            senseOrder: 2,
            definition: 'K2-09 fixture sense two.',
            definitionLanguageCode: 'en',
            concepts: [owner],
          },
        ],
      }],
    };
  };
  const requestFor = (actor: string): K2BoundWaveApi['request'] => vi.fn(async (route, options = {}) => {
    const method = options.method ?? 'GET';
    calls.push({ actor, route, method, options });
    if (route.startsWith('/v1/dictionary/search')) {
      const grouped = new URL(route, 'https://wave.invalid').searchParams.get('includeLemmaGroups') === 'true';
      return {
        status: 200,
        payload: grouped ? groupedPayload(actor) : {
          data: [{ id: 'k2-09-owner' }, { id: 'k2-09-secondary' }],
          meta: { apiVersion: '1.0', hasMore: false, pageSize: 2, hasNextCursor: false },
        },
      };
    }
    if (route.startsWith('/v1/library/concepts/')) {
      return { status: 200, payload: { data: { isSaved: true } } };
    }
    if (route === '/v1/review/queue?limit=100') {
      return { status: 200, payload: { data: [{
        reviewItemId: 'opaque-review-owner',
        concept: { id: 'k2-09-owner' },
        exerciseMode: 'self_recall',
      }] } };
    }
    if (route === '/v1/review/opaque-review-owner/answer') {
      return { status: 200, payload: {
        data: { reviewItemId: 'opaque-review-owner', competence: { production: { evidenceCount: 1 } } },
      } };
    }
    if (route === '/v1/concepts/k2-09-owner') {
      return { status: 200, payload: { data: {
        id: 'k2-09-owner', definitions: [
          { definition: 'K2-09 fixture sense one.', languageCode: 'en', order: 1 },
          { definition: 'K2-09 fixture sense two.', languageCode: 'en', order: 2 },
        ],
      } } };
    }
    if (route === '/v1/concepts/k2-09-secondary') {
      return { status: 200, payload: { data: {
        id: 'k2-09-secondary', definitions: [
          { definition: 'K2-09 fixture sense one.', languageCode: 'en', order: 1 },
        ],
      } } };
    }
    const brainHandle = route.endsWith('/k2-09-owner') ? 'k2-09-owner' : 'k2-09-secondary';
    const value = state(actor, brainHandle);
    return { status: 200, payload: { data: {
      concept: { id: brainHandle, learner: { status: value.status, isDue: false } },
      status: value.status,
      competence: competence(value.score, value.reviewedOwner ? 1 : 0),
      mastery: null,
      confidence: value.score,
      memory: null,
      evidence: {
        exposureCount: 0,
        reviewCount: value.reviewedOwner ? 1 : 0,
        lastSeenAt: null,
        lastReviewedAt: null,
      },
    } } };
  });
  const context = {
    actors: { primary: 'primary', observer: 'observer' },
    api: { primary: { request: requestFor('primary') }, observer: { request: requestFor('observer') } },
    actorSnapshot: vi.fn(async () => snapshot()),
    fixture,
    checkpoint: vi.fn((phase, event) => checkpoints.push(`${phase}:${event}`)),
    report: vi.fn(kind => reports.push(kind)),
  } as unknown as K2HostedWaveContext;
  return { context, calls, checkpoints, reports };
}

describe('K2-09 bridge-backed Dictionary wave', () => {
  it('uses normal Save and Review, checks both actors against Brain, and brackets GETs with unchanged snapshots', async () => {
    const { context, calls, checkpoints, reports } = createContext();

    await k2HostedWaveK209.run(context);

    expect(calls.filter(call => call.route.startsWith('/v1/library/concepts/')).map(call => call.route))
      .toEqual(['/v1/library/concepts/k2-09-owner', '/v1/library/concepts/k2-09-secondary']);
    const answers = calls.filter(call => call.route === '/v1/review/opaque-review-owner/answer');
    expect(answers).toHaveLength(2);
    expect(answers[0]?.options).toEqual(answers[1]?.options);
    expect(answers[0]?.options).toMatchObject({ method: 'POST', idempotencyKey: 'k209-owner-review' });
    expect(calls.filter(call => call.route.startsWith('/v1/brain/concepts/'))).toHaveLength(4);
    expect(calls.filter(call => call.route.includes('includeLemmaGroups=true'))).toHaveLength(2);
    expect(context.actorSnapshot).toHaveBeenCalledTimes(6);
    expect(checkpoints).toContain('fixture_k209_review_answer:pass');
    expect(checkpoints).toContain('fixture_k209_review_replay:pass');
    expect(reports).toEqual(['k2-09-bridge-dictionary']);
  });

  it('rejects an unapproved concept even when it appears in a bridged sense', async () => {
    const { context } = createContext(true);
    await expect(k2HostedWaveK209.run(context)).rejects.toThrow('complete bridge set changed');
  });
});
