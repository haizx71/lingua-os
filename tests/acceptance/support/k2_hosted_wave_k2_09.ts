import {
  assertK2RetainedStateUnchanged,
  type K2RetainedSnapshot,
} from './k2_hosted_probe_client';
import {
  dataObject,
  type K2BoundWaveApi,
  type K2HostedWaveContext,
  type K2HostedWavePlugin,
  type K2WaveActorHandle,
} from './k2_hosted_runner';
import type { K2HostedFixtureDto } from './k2_hosted_actors';

type JsonRecord = Record<string, unknown>;
type K209ConceptHandle = 'k2-09-owner' | 'k2-09-secondary';

function record(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

function exactSet(values: readonly unknown[], expected: readonly string[]): boolean {
  return values.length === expected.length &&
    JSON.stringify([...values].sort()) === JSON.stringify([...expected].sort());
}

function dictionaryGroups(payload: unknown): readonly JsonRecord[] {
  const envelope = record(payload, 'K2-09 grouped Dictionary response was invalid.');
  if (!Array.isArray(envelope.lemmaGroups) || envelope.lemmaGroups.length !== 1) {
    throw new Error('K2-09 grouped Dictionary response did not contain exactly one lexeme.');
  }
  const meta = record(envelope.meta, 'K2-09 grouped Dictionary cursor metadata was invalid.');
  if (meta.apiVersion !== '1.0' || meta.hasMore !== false || meta.pageSize !== 2 ||
      meta.hasNextCursor !== false) {
    throw new Error('K2-09 grouped Dictionary cursor metadata was invalid.');
  }
  return envelope.lemmaGroups.map(item =>
    record(item, 'K2-09 grouped Dictionary lemma group was invalid.'));
}

function conceptsByHandle(group: JsonRecord): ReadonlyMap<K209ConceptHandle, JsonRecord> {
  if (!Array.isArray(group.senses) || group.senses.length !== 2) {
    throw new Error('K2-09 Dictionary did not return both complete fixture senses.');
  }
  const expectedBridges = [
    ['k2-09-owner', 'k2-09-secondary'],
    ['k2-09-owner'],
  ] as const;
  const expectedDefinitions = [
    'K2-09 fixture sense one.',
    'K2-09 fixture sense two.',
  ] as const;
  const found = new Map<K209ConceptHandle, JsonRecord>();
  group.senses.forEach((rawSense, index) => {
    const sense = record(rawSense, 'K2-09 Dictionary sense was invalid.');
    if (sense.senseOrder !== index + 1 || sense.definitionLanguageCode !== 'en' ||
        sense.definition !== expectedDefinitions[index] || !Array.isArray(sense.concepts) ||
        !exactSet(sense.concepts.map(raw => record(raw, 'K2-09 bridged concept was invalid.').concept)
          .map(raw => record(raw, 'K2-09 bridged concept identity was invalid.').id), expectedBridges[index])) {
      throw new Error('K2-09 Dictionary sense order or complete bridge set changed.');
    }
    for (const rawConcept of sense.concepts) {
      const item = record(rawConcept, 'K2-09 linked concept summary was invalid.');
      const concept = record(item.concept, 'K2-09 linked concept identity was invalid.');
      const id = concept.id;
      if (id !== 'k2-09-owner' && id !== 'k2-09-secondary') {
        throw new Error('K2-09 Dictionary returned an unapproved linked concept.');
      }
      const handle = id as K209ConceptHandle;
      const prior = found.get(handle);
      if (prior && JSON.stringify(prior) !== JSON.stringify(item)) {
        throw new Error('K2-09 repeated bridge projections disagreed for one concept.');
      }
      found.set(handle, item);
    }
  });
  if (!found.has('k2-09-owner') || !found.has('k2-09-secondary')) {
    throw new Error('K2-09 Dictionary omitted an approved bridged concept.');
  }
  return found;
}

function assertFixtureGroup(
  payload: unknown,
  fixture: K2HostedFixtureDto,
  expectedSaved: Readonly<Record<K209ConceptHandle, boolean>>,
): ReadonlyMap<K209ConceptHandle, JsonRecord> {
  const envelope = record(payload, 'K2-09 grouped Dictionary response was invalid.');
  if (!Array.isArray(envelope.data) || envelope.data.length !== 2 ||
      !exactSet(envelope.data.map(raw => record(raw, 'K2-09 flat concept summary was invalid.').id),
        ['k2-09-owner', 'k2-09-secondary'])) {
    throw new Error('K2-09 inflected search did not return exactly the two fixture concepts.');
  }
  const [group] = dictionaryGroups(payload);
  if (group.lexemeId !== 'k2-09-lexeme' || group.lemma !== fixture.lemma ||
      group.partOfSpeech !== 'noun' ||
      !Array.isArray(group.matchedForms) || group.matchedForms.length !== 1 ||
      group.matchedForms[0] !== fixture.inflectedForm) {
    throw new Error('K2-09 inflected form did not resolve to the exact fixture lexeme.');
  }
  const linked = conceptsByHandle(group);
  for (const handle of ['k2-09-owner', 'k2-09-secondary'] as const) {
    const item = linked.get(handle);
    if (!item || item.isSaved !== expectedSaved[handle] || !Object.hasOwn(item, 'mastery') ||
        !(item.mastery === null || typeof item.mastery === 'number')) {
      throw new Error('K2-09 Dictionary Save badge or nullable mastery projection was invalid.');
    }
  }
  return linked;
}

function assertDefaultFlatShape(payload: unknown): void {
  const envelope = record(payload, 'K2-09 default Dictionary response was invalid.');
  const meta = record(envelope.meta, 'K2-09 default Dictionary cursor metadata was invalid.');
  if (Object.hasOwn(envelope, 'lemmaGroups') || !Array.isArray(envelope.data) ||
      envelope.data.length !== 2 || !exactSet(envelope.data.map(raw =>
        record(raw, 'K2-09 default Dictionary concept was invalid.').id),
      ['k2-09-owner', 'k2-09-secondary']) || meta.apiVersion !== '1.0' ||
      meta.hasMore !== false || meta.pageSize !== 2 || meta.hasNextCursor !== false) {
    throw new Error('K2-09 default Dictionary response did not preserve the flat cursor contract.');
  }
}

function assertOwnConceptDetails(
  ownerPayload: unknown,
  secondaryPayload: unknown,
): void {
  const owner = dataObject(ownerPayload, 'K2-09 owner concept detail was invalid.');
  const secondary = dataObject(secondaryPayload, 'K2-09 secondary concept detail was invalid.');
  if (owner.id !== 'k2-09-owner' || secondary.id !== 'k2-09-secondary') {
    throw new Error('K2-09 concept detail did not match its exact requested concept.');
  }
  const definitions = (value: JsonRecord): readonly string[] => {
    if (!Array.isArray(value.definitions)) throw new Error('K2-09 concept definitions were invalid.');
    return value.definitions.map(raw => {
      const item = record(raw, 'K2-09 concept definition was invalid.');
      if (item.languageCode !== 'en' || typeof item.definition !== 'string') {
        throw new Error('K2-09 concept definition provenance was invalid.');
      }
      return item.definition;
    });
  };
  const ownerDefinitions = definitions(owner);
  const secondaryDefinitions = definitions(secondary);
  if (JSON.stringify(ownerDefinitions) !== JSON.stringify([
    'K2-09 fixture sense one.', 'K2-09 fixture sense two.',
  ]) || JSON.stringify(secondaryDefinitions) !== JSON.stringify(['K2-09 fixture sense one.'])) {
    throw new Error('K2-09 concept detail exposed definitions outside its own approved bridges.');
  }
}

function assertGroupedBrainParity(
  linked: ReadonlyMap<K209ConceptHandle, JsonRecord>,
  details: ReadonlyMap<K209ConceptHandle, JsonRecord>,
): void {
  for (const handle of ['k2-09-owner', 'k2-09-secondary'] as const) {
    const grouped = linked.get(handle);
    const brain = details.get(handle);
    if (!grouped || !brain || !Object.hasOwn(brain, 'mastery') ||
        !(brain.mastery === null || typeof brain.mastery === 'number')) {
      throw new Error('K2-09 grouped/Brain concept binding was incomplete.');
    }
    const concept = record(grouped.concept, 'K2-09 grouped concept was invalid.');
    const brainConcept = record(brain.concept, 'K2-09 Brain detail was invalid.');
    const learner = record(brainConcept.learner, 'K2-09 Brain learner projection was invalid.');
    const evidence = record(brain.evidence, 'K2-09 Brain evidence projection was invalid.');
    const projection = (item: JsonRecord, c: JsonRecord, isSaved?: boolean) => ({
      status: c.status,
      isDue: c.isDue,
      competence: item.competence,
      mastery: item.mastery,
      confidence: item.confidence,
      memory: item.memory ?? null,
      exposureCount: item.exposureCount,
      lastSeenAt: item.lastSeenAt ?? null,
      ...(isSaved === undefined ? {} : { isSaved }),
    });
    const groupedProjection = projection(grouped, concept, grouped.isSaved === true);
    const brainProjection = projection({
      competence: brain.competence,
      mastery: brain.mastery,
      confidence: brain.confidence,
      memory: brain.memory,
      exposureCount: evidence.exposureCount,
      lastSeenAt: evidence.lastSeenAt,
    }, {
      status: brain.status,
      isDue: learner.isDue,
    });
    const { isSaved: _isSaved, ...groupedBrainProjection } = groupedProjection;
    if (JSON.stringify(groupedBrainProjection) !== JSON.stringify(brainProjection) ||
        concept.status !== brain.status || concept.isDue !== learner.isDue) {
      throw new Error('K2-09 grouped learner projection differed from authoritative Brain detail.');
    }
  }
}

function answerForQueueItem(item: JsonRecord, fixture: K2HostedFixtureDto): Readonly<{
  body: JsonRecord;
  mode: string;
}> {
  const mode = item.exerciseMode;
  if (mode === 'self_recall') {
    return { mode, body: { rating: 'good', exerciseMode: mode, correct: true, responseTimeMs: 1200 } };
  }
  if (mode === 'typing') {
    return {
      mode,
      body: { rating: 'good', exerciseMode: mode, responseText: fixture.lemma, responseTimeMs: 1200 },
    };
  }
  throw new Error('K2-09 fresh owner Review selected an unsupported fixture modality.');
}

export const k2HostedWaveK209: K2HostedWavePlugin = {
  waveId: 'K2-09',
  actorCount: 2,
  async run(context: K2HostedWaveContext) {
    const fixture = context.fixture;
    if (!fixture || !context.api.primary || !context.api.observer) {
      throw new Error('K2-09 fixture or actor bindings were missing.');
    }
    const primary = context.api.primary;
    const observer = context.api.observer;
    context.report('k2-09-bridge-dictionary');

    const flat = (await primary.request(
      `/v1/dictionary/search?query=${encodeURIComponent(fixture.lemma)}&languageCode=en&limit=100`,
    )).payload;
    assertDefaultFlatShape(flat);

    for (const [api, handle] of [[primary, 'k2-09-owner'], [observer, 'k2-09-secondary']] as const) {
      const saved = dataObject((await api.request(`/v1/library/concepts/${handle}`, { method: 'PUT' })).payload,
        'K2-09 normal Library Save response was invalid.');
      if (saved.isSaved !== true) throw new Error('K2-09 normal Library Save was not confirmed.');
    }

    const queueEnvelope = record((await primary.request('/v1/review/queue?limit=100')).payload,
      'K2-09 normal Review queue response was invalid.');
    if (!Array.isArray(queueEnvelope.data) || queueEnvelope.data.length !== 1) {
      throw new Error('K2-09 owner Save did not produce exactly one normal Review item.');
    }
    const reviewItem = record(queueEnvelope.data[0], 'K2-09 normal Review item was invalid.');
    const reviewConcept = record(reviewItem.concept, 'K2-09 normal Review concept was invalid.');
    if (reviewConcept.id !== 'k2-09-owner' || typeof reviewItem.reviewItemId !== 'string') {
      throw new Error('K2-09 Review queue did not bind to the saved owner concept.');
    }
    const answer = answerForQueueItem(reviewItem, fixture);
    const answerPath = `/v1/review/${reviewItem.reviewItemId}/answer`;
    context.checkpoint('fixture_k209_review_answer', 'start');
    const first = dataObject((await primary.request(answerPath, {
      method: 'POST', idempotencyKey: 'k209-owner-review', body: answer.body,
    })).payload, 'K2-09 normal Review answer was invalid.');
    context.checkpoint('fixture_k209_review_answer', 'pass');
    const afterAnswer = await context.actorSnapshot(context.actors.primary);
    context.checkpoint('fixture_k209_review_replay', 'start');
    const replay = dataObject((await primary.request(answerPath, {
      method: 'POST', idempotencyKey: 'k209-owner-review', body: answer.body,
    })).payload, 'K2-09 Review replay was invalid.');
    if (JSON.stringify(first) !== JSON.stringify(replay)) {
      throw new Error('K2-09 idempotent Review replay changed its saved result.');
    }
    assertK2RetainedStateUnchanged(afterAnswer,
      await context.actorSnapshot(context.actors.primary));
    context.checkpoint('fixture_k209_review_replay', 'pass');

    const preReads = new Map<K2WaveActorHandle, K2RetainedSnapshot>([
      ['primary', await context.actorSnapshot(context.actors.primary)],
      ['observer', await context.actorSnapshot(context.actors.observer)],
    ]);
    const groupedForActor = new Map<K2WaveActorHandle, ReadonlyMap<K209ConceptHandle, JsonRecord>>();
    const brainForActor = new Map<K2WaveActorHandle, ReadonlyMap<K209ConceptHandle, JsonRecord>>();
    for (const [handle, api, isPrimary] of [
      ['primary', primary, true], ['observer', observer, false],
    ] as const) {
      const flatAgain = await api.request(
        `/v1/dictionary/search?query=${encodeURIComponent(fixture.lemma)}&languageCode=en&limit=100`,
      );
      assertDefaultFlatShape(flatAgain.payload);
      const grouped = assertFixtureGroup(
        (await api.request(
          `/v1/dictionary/search?query=${encodeURIComponent(fixture.inflectedForm)}` +
          '&languageCode=en&limit=100&includeLemmaGroups=true',
        )).payload,
        fixture,
        isPrimary
          ? { 'k2-09-owner': true, 'k2-09-secondary': false }
          : { 'k2-09-owner': false, 'k2-09-secondary': true },
      );
      assertOwnConceptDetails(
        (await api.request('/v1/concepts/k2-09-owner')).payload,
        (await api.request('/v1/concepts/k2-09-secondary')).payload,
      );
      const brain = new Map<K209ConceptHandle, JsonRecord>();
      for (const conceptHandle of ['k2-09-owner', 'k2-09-secondary'] as const) {
        brain.set(conceptHandle, dataObject((await api.request(
          `/v1/brain/concepts/${conceptHandle}`,
        )).payload, 'K2-09 authoritative Brain detail was invalid.'));
      }
      assertGroupedBrainParity(grouped, brain);
      groupedForActor.set(handle, grouped);
      brainForActor.set(handle, brain);
      const before = preReads.get(handle);
      if (!before) throw new Error('K2-09 actor read-only baseline was missing.');
      assertK2RetainedStateUnchanged(before, await context.actorSnapshot(handle));
    }

    const reviewed = brainForActor.get('primary')?.get('k2-09-owner');
    const untouched = brainForActor.get('observer')?.get('k2-09-owner');
    const reviewedEvidence = reviewed ? record(reviewed.evidence, 'K2-09 Brain evidence was invalid.') : null;
    const untouchedEvidence = untouched ? record(untouched.evidence, 'K2-09 Brain evidence was invalid.') : null;
    if (!reviewedEvidence || !untouchedEvidence ||
        typeof reviewedEvidence.reviewCount !== 'number' || reviewedEvidence.reviewCount < 1 ||
        untouchedEvidence.reviewCount !== 0 ||
        JSON.stringify(groupedForActor.get('primary')?.get('k2-09-owner')?.competence) ===
          JSON.stringify(groupedForActor.get('observer')?.get('k2-09-owner')?.competence)) {
      throw new Error('K2-09 normal Review did not produce actor-specific learner state divergence.');
    }
  },
};
