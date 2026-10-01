import { describe, expect, it, vi } from 'vitest';
import {
  k2RetainedTableNames,
  type K2HostedActorLineageProof,
  type K2RetainedSnapshot,
} from './k2_hosted_probe_client';
import {
  type K2HostedCandidateInputProof,
  type K2HostedCandidateMatrixProof,
  type K2HostedWaveContext,
  type K2WaveApiOptions,
  type K2WaveActorHandle,
} from './k2_hosted_runner';
import { k2HostedWaveK208 } from './k2_hosted_wave_k2_08';

const actors = ['primary', 'observer', 'scenario-c', 'scenario-d'] as const;
type Actor = typeof actors[number];
const todayTables = new Set(['today_plans', 'today_plan_activities', 'today_activity_review_items']);

function opaque(index: number): string {
  return `opaque-${index.toString(16).padStart(32, '0')}`;
}

const candidateMatrix: K2HostedCandidateMatrixProof = {
  novel: { contentHandle: opaque(100), estimatedMinutes: 8, unseenConceptCount: 1, linkedConceptHandles: [opaque(21)] },
  weak: { contentHandle: opaque(101), estimatedMinutes: 5, unseenConceptCount: 1, linkedConceptHandles: [opaque(22)] },
  forgotten: { contentHandle: opaque(102), estimatedMinutes: 5, unseenConceptCount: 1, linkedConceptHandles: [opaque(23)] },
};

function baseCounts(actor: Actor): Record<string, number> {
  const due = actor === 'primary' || actor === 'observer' ? 20 : 0;
  return {
    users: 1,
    learner_profiles: 1,
    user_languages: 1,
    concept_save_intents: due,
    user_saved_concepts: due,
    learning_events: due,
    user_concept_states: due + (actor === 'observer' ? 2 : actor === 'scenario-c' ? 1 : 0),
    review_items: due,
    fsrs_states: due,
    review_events: 0,
    today_plans: 0,
    today_plan_activities: 0,
    today_activity_review_items: 0,
  };
}

function snapshot(actor: Actor, generated: boolean): K2RetainedSnapshot {
  const counts = baseCounts(actor);
  if (generated) {
    counts.today_plans = 1;
    counts.today_plan_activities = actor === 'observer' ? 2 : 1;
    counts.today_activity_review_items = actor === 'primary' ? 15 : actor === 'observer' ? 10 : 0;
  }
  const tables = Object.fromEntries(k2RetainedTableNames().map(table => {
    const rows = counts[table] ?? 0;
    const changedToday = generated && todayTables.has(table) && rows > 0;
    return [table, {
      rows,
      sha256: changedToday ? '1'.repeat(64) : '0'.repeat(64),
    }];
  })) as K2RetainedSnapshot['tables'];
  return { tables, totalRows: Object.values(tables).reduce((total, item) => total + item.rows, 0) };
}

function lineage(actor: Actor): K2HostedActorLineageProof {
  const due = actor === 'primary' || actor === 'observer' ? 20 : 0;
  return {
    userConceptStateRows: due + (actor === 'observer' ? 2 : actor === 'scenario-c' ? 1 : 0),
    reviewItemRows: due,
    fsrsStateRows: due,
    recognitionEvidenceCount: 0,
    listeningEvidenceCount: 0,
    productionEvidenceCount: 0,
    productionPositiveMass: '0',
    productionNegativeMass: '0',
    events: [],
  };
}

function candidateInputProof(actor: Actor): K2HostedCandidateInputProof {
  if (actor === 'observer') {
    return {
      baselineRoleOrder: ['novel', 'weak', 'forgotten'],
      effectiveStatus: { novel: 'none', weak: 'weak', forgotten: 'forgotten' },
      allCompetitorsEligible: true,
    };
  }
  if (actor === 'scenario-c') {
    return {
      baselineRoleOrder: ['novel', 'weak', 'forgotten'],
      effectiveStatus: { novel: 'none', weak: 'weak', forgotten: 'none' },
      allCompetitorsEligible: true,
    };
  }
  return {
    baselineRoleOrder: ['novel', 'weak', 'forgotten'],
    effectiveStatus: { novel: 'none', weak: 'none', forgotten: 'none' },
    allCompetitorsEligible: true,
  };
}

function plan(actor: Actor): unknown {
  const activity = (index: number, type: 'review' | 'read', count: number, minutes: number,
    reasonCodes: readonly string[], contentId?: string) => ({
    id: opaque(300 + actors.indexOf(actor) * 10 + index),
    activityType: type,
    position: index,
    targetCount: count,
    estimatedMinutes: minutes,
    reasonCodes,
    status: 'pending',
    ...(contentId ? { contentId } : {}),
  });
  const activities = actor === 'primary'
    ? [activity(0, 'review', 15, 15, ['FSRS_DUE'])]
    : actor === 'observer'
      ? [
          activity(0, 'review', 10, 10, ['FSRS_DUE']),
          activity(1, 'read', 1, 5,
            ['FORGOTTEN_REMEDIATION', 'CONTENT_FIT', 'WEAK_RECOGNITION'], candidateMatrix.forgotten.contentHandle),
        ]
      : actor === 'scenario-c'
        ? [activity(0, 'read', 1, 5,
            ['WEAK_REMEDIATION', 'CONTENT_FIT', 'NEW_CONCEPT_BUDGET'], candidateMatrix.weak.contentHandle)]
        : [activity(0, 'read', 1, 8,
            ['CONTENT_FIT', 'NEW_CONCEPT_BUDGET'], candidateMatrix.novel.contentHandle)];
  return { data: {
    id: opaque(400 + actors.indexOf(actor)),
    engineVersion: 'today-heuristic-v2',
    targetMinutes: 15,
    activities,
  } };
}

function contextWithApi(): Readonly<{
  context: K2HostedWaveContext;
  savedByActor: ReadonlyMap<Actor, Set<string>>;
  generationCount: ReadonlyMap<Actor, number>;
  deniedCompletions: readonly Readonly<{ actor: Actor; owner: Actor; route: string }>[];
}> {
  const savedByActor = new Map<Actor, Set<string>>(actors.map(actor => [actor, new Set()]));
  const generationCount = new Map<Actor, number>(actors.map(actor => [actor, 0]));
  const dueHandles = Array.from({ length: 20 }, (_, index) => opaque(index + 1));
  const allSearchHandles = [...dueHandles, opaque(21), opaque(22), opaque(23)];
  const reviewIds = new Map<Actor, readonly string[]>(actors.map((actor, index) => [
    actor,
    dueHandles.map((_, itemIndex) => opaque(200 + index * 30 + itemIndex)),
  ]));
  const deniedCompletions: Array<Readonly<{ actor: Actor; owner: Actor; route: string }>> = [];
  const planOwners = new Map(actors.map((actor, index) => [opaque(400 + index), actor]));
  const apiByActor = new Map(actors.map(actor => [actor, {
    async request(route: string, options: K2WaveApiOptions = {}, expectedStatuses: readonly number[] = [200]) {
      if (route.startsWith('/v1/today?languageProfileId=actor:')) {
        const status = 404;
        if (!expectedStatuses.includes(status)) throw new Error('Unexpected actor-isolation status.');
        return { status, payload: null };
      }
      const completion = /^\/v1\/today\/(opaque-[0-9a-f]{32})\/activities\/(opaque-[0-9a-f]{32})\/complete$/.exec(route);
      if (completion && options.method === 'POST' && JSON.stringify(options.body) === '{}') {
        const owner = planOwners.get(completion[1]);
        const activityOwner = actors.find((_, index) => opaque(300 + index * 10) === completion[2]);
        if (!owner || owner !== activityOwner) throw new Error('Unknown disposable completion target.');
        deniedCompletions.push({ actor, owner, route });
        const status = 404;
        if (!expectedStatuses.includes(status)) throw new Error('Unexpected cross-actor completion status.');
        return { status, payload: null };
      }
      if (route.startsWith('/v1/dictionary/search?')) {
        return { status: 200, payload: { data: allSearchHandles.map(id => ({ id })) } };
      }
      if (route.startsWith('/v1/library/concepts/') && options.method === 'PUT') {
        const concept = decodeURIComponent(route.slice('/v1/library/concepts/'.length));
        savedByActor.get(actor)?.add(concept);
        return { status: 200, payload: { data: { isSaved: true } } };
      }
      if (route.startsWith('/v1/review/queue?')) {
        const ids = reviewIds.get(actor) ?? [];
        const concepts = [...(savedByActor.get(actor) ?? [])];
        if (concepts.length === 0) return { status: 200, payload: { data: [] } };
        return {
          status: 200,
          payload: { data: ids.map((reviewItemId, index) => ({
            reviewItemId,
            concept: { id: concepts[index] },
          })) },
        };
      }
      if (route === '/v1/today') {
        generationCount.set(actor, (generationCount.get(actor) ?? 0) + 1);
        return { status: 200, payload: plan(actor) };
      }
      throw new Error('Unexpected fixed test route.');
    },
  }] as const));
  const checkpoints: string[] = [];
  const reports: string[] = [];
  const context: K2HostedWaveContext = {
    actors: {
      primary: 'primary', observer: 'observer', scenarioC: 'scenario-c', scenarioD: 'scenario-d',
    },
    api: {
      primary: apiByActor.get('primary')!,
      observer: apiByActor.get('observer')!,
      scenarioC: apiByActor.get('scenario-c')!,
      scenarioD: apiByActor.get('scenario-d')!,
    },
    actorSnapshot: async actor => snapshot(actor, generationCount.get(actor)! > 0),
    actorLineage: async actor => lineage(actor),
    actorTodayReviewTargets: async actor => {
      const count = actor === 'primary' ? 15 : 10;
      return {
        engineVersion: 'today-heuristic-v2',
        activityCount: actor === 'observer' ? 2 : 1,
        reviewActivityCount: actor === 'primary' || actor === 'observer' ? 1 : 0,
        targetCount: actor === 'primary' || actor === 'observer' ? count : 0,
        reviewItemIds: (reviewIds.get(actor) ?? []).slice(0, count),
      };
    },
    candidateMatrix: Object.fromEntries(actors.map(actor => [actor, candidateMatrix])),
    candidateProof: async actor => candidateInputProof(actor),
    verifyDueCandidateIsolation: vi.fn(async () => {}),
    fixtureSetup: {
      seedForgottenWeakPair: vi.fn(async () => {}),
      seedWeakOnly: vi.fn(async () => {}),
    },
    anchorMaterial: async () => ({
      hasTranslatedDefinition: true,
      hasHttpsAudio: false,
      hasPublishedClozeTarget: false,
    }),
    requireSnapshotRows: (value, expected) => {
      for (const [table, rows] of Object.entries(expected)) {
        if (value.tables[table as keyof K2RetainedSnapshot['tables']].rows !== rows) {
          throw new Error('Test actor snapshot mismatch.');
        }
      }
    },
    report: kind => reports.push(kind),
    checkpoint: (phase, event) => checkpoints.push(`${phase}:${event}`),
  };
  return { context, savedByActor, generationCount, deniedCompletions };
}

describe('K2-08 full four-actor hosted wave', () => {
  it('proves due control, F/W/N scenarios, reserve, replay, isolation, and Today-only deltas', async () => {
    const { context, savedByActor, generationCount, deniedCompletions } = contextWithApi();
    await expect(k2HostedWaveK208.run(context)).resolves.toBeUndefined();

    expect([...savedByActor.values()].map(items => items.size)).toEqual([20, 20, 0, 0]);
    expect(context.verifyDueCandidateIsolation).toHaveBeenCalledOnce();
    expect(context.fixtureSetup?.seedForgottenWeakPair).toHaveBeenCalledOnce();
    expect(context.fixtureSetup?.seedWeakOnly).toHaveBeenCalledOnce();
    expect([...generationCount.values()]).toEqual([2, 2, 2, 2]);
    expect(deniedCompletions).toHaveLength(12);
    expect(new Set(deniedCompletions.map(item => `${item.actor}:${item.owner}`)).size).toBe(12);
    expect(deniedCompletions.every(item => item.actor !== item.owner)).toBe(true);
  });

  it('fails closed before Today when exact fixture statuses differ from the reviewed matrix', async () => {
    const { context, generationCount } = contextWithApi();
    const candidateProof = context.candidateProof!;
    const alteredContext: K2HostedWaveContext = {
      ...context,
      candidateProof: async (actor: K2WaveActorHandle) => actor === 'observer'
        ? { ...candidateInputProof(actor), effectiveStatus: { novel: 'none', weak: 'none', forgotten: 'forgotten' } }
        : candidateProof(actor),
    };

    await expect(k2HostedWaveK208.run(alteredContext)).rejects.toThrow('candidate input proof');
    expect([...generationCount.values()]).toEqual([0, 0, 0, 0]);
  });

  it('fails closed before Today when the bounded competitor proof is incomplete', async () => {
    const { context, generationCount } = contextWithApi();
    const incompleteContext: K2HostedWaveContext = {
      ...context,
      candidateProof: async actor => ({ ...candidateInputProof(actor), allCompetitorsEligible: false }),
    };

    await expect(k2HostedWaveK208.run(incompleteContext)).rejects.toThrow('candidate input proof');
    expect([...generationCount.values()]).toEqual([0, 0, 0, 0]);
  });
});
