'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  mapBrainConceptDetailToViewModel,
  mapBrainSummaryToViewModel,
  mapBrainConceptToViewModel,
  type ApiClient,
  type BrainConceptListResponseDto,
  type BrainConceptResponseDto,
  type BrainConceptSummaryDto,
  type BrainSummaryResponseDto,
  type BrainSummaryViewModel,
  type OperationQuery,
  type UiErrorState,
  type BrainConceptViewModel,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';

export type BrainLoadStatus = 'loading' | 'success' | 'empty' | 'error';

export interface BrainDataState {
  readonly status: BrainLoadStatus;
  readonly summary: BrainSummaryViewModel | null;
  readonly nodes: readonly BrainConceptViewModel[];
  readonly error: UiErrorState | null;
}

interface BrainContextIdentity {
  readonly api: ApiClient;
  readonly enabled: boolean;
  readonly authState: string | undefined;
  readonly actorEpoch: number;
  readonly actorId: string | null;
  readonly languageProfileId: string | null;
  readonly reloadToken: number;
}

interface BrainSnapshot {
  readonly identity: BrainContextIdentity | null;
  readonly requestId: number;
  readonly data: BrainDataState;
}

interface BrainDetailState {
  readonly identity: BrainContextIdentity | null;
  readonly requestId: number;
  readonly selected: BrainConceptViewModel | null;
  readonly loading: boolean;
  readonly error: UiErrorState | null;
}

export interface UseBrainResult extends BrainDataState {
  retry(): void;
  readonly contextKey: string;
  readonly selectedDetail: BrainConceptViewModel | null;
  readonly detailLoading: boolean;
  readonly detailError: UiErrorState | null;
  selectConcept(node: BrainConceptViewModel): void;
}

const conceptStatuses = new Set([
  'unseen',
  'discovered',
  'learning',
  'familiar',
  'active',
  'mastered',
  'weak',
  'forgotten',
]);
const competenceDimensions = ['recognition', 'listening', 'production'] as const;
const grammarKeys = new Set([
  'patternFormula',
  'syntacticCategory',
  'pragmaticFunction',
  'vietnameseExplanation',
  'vietnameseCommonTraps',
  'structuralSlots',
]);
const grammarSlotKeys = new Set(['label', 'role', 'required', 'examples']);

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Malformed Brain response at ${path}`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string, maxLength?: number): string {
  if (
    typeof value !== 'string'
    || value.trim() === ''
    || (maxLength !== undefined && value.length > maxLength)
  ) {
    throw new Error(`Malformed Brain response at ${path}`);
  }
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`Malformed Brain response at ${path}`);
  }
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Malformed Brain response at ${path}`);
  return value;
}

function requireNumber(value: unknown, path: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw new Error(`Malformed Brain response at ${path}`);
  }
  return value;
}

function requireCount(value: unknown, path: string): number {
  const count = requireNumber(value, path, true);
  if (count < 0) throw new Error(`Malformed Brain response at ${path}`);
  return count;
}

function requireFraction(value: unknown, path: string): number {
  const fraction = requireNumber(value, path);
  if (fraction < 0 || fraction > 1) throw new Error(`Malformed Brain response at ${path}`);
  return fraction;
}

function requireNullableFraction(value: unknown, path: string): number | null {
  if (value === null) return null;
  return requireFraction(value, path);
}

function assertMeta(value: unknown, path: string): void {
  const meta = asRecord(value, path);
  requireString(meta.requestId, `${path}.requestId`);
  if (meta.apiVersion !== '1.0') throw new Error(`Malformed Brain response at ${path}.apiVersion`);
}

function assertCompetence(value: unknown, path: string): void {
  const competence = asRecord(value, path);
  for (const dimension of competenceDimensions) {
    const score = asRecord(competence[dimension], `${path}.${dimension}`);
    requireFraction(score.score, `${path}.${dimension}.score`);
    requireFraction(score.confidence, `${path}.${dimension}.confidence`);
    requireCount(score.evidenceCount, `${path}.${dimension}.evidenceCount`);
    if (score.updatedAt !== undefined) requireString(score.updatedAt, `${path}.${dimension}.updatedAt`);
  }
}

function assertConceptPresentationFields(concept: Record<string, unknown>, path: string): void {
  if (concept.partOfSpeech !== undefined && concept.partOfSpeech !== null) {
    requireString(concept.partOfSpeech, `${path}.partOfSpeech`);
  }
  if (concept.ipa !== undefined) {
    if (typeof concept.ipa !== 'string') throw new Error(`Malformed Brain response at ${path}.ipa`);
  }
  if (concept.level !== undefined && concept.level !== null) {
    const level = asRecord(concept.level, `${path}.level`);
    requireString(level.code, `${path}.level.code`);
    requireString(level.frameworkCode, `${path}.level.frameworkCode`);
    requireString(level.label, `${path}.level.label`);
  }
}

function assertConceptSummary(value: unknown, path: string): asserts value is BrainConceptSummaryDto {
  const item = asRecord(value, path);
  const concept = asRecord(item.concept, `${path}.concept`);
  requireString(concept.id, `${path}.concept.id`);
  requireString(concept.canonicalForm, `${path}.concept.canonicalForm`);
  assertConceptPresentationFields(concept, `${path}.concept`);
  if (typeof concept.status !== 'string' || !conceptStatuses.has(concept.status)) throw new Error(`Malformed Brain response at ${path}.concept.status`);
  requireBoolean(concept.isDue, `${path}.concept.isDue`);
  assertCompetence(item.competence, `${path}.competence`);
  requireNullableFraction(item.mastery, `${path}.mastery`);
  requireFraction(item.confidence, `${path}.confidence`);
  requireCount(item.exposureCount, `${path}.exposureCount`);
  if (item.lastSeenAt !== undefined) requireString(item.lastSeenAt, `${path}.lastSeenAt`);
}

function assertSummaryResponse(value: unknown): asserts value is BrainSummaryResponseDto {
  const response = asRecord(value, 'brainSummary');
  assertMeta(response.meta, 'brainSummary.meta');
  const summary = asRecord(response.data, 'brainSummary.data');
  requireString(summary.languageProfileId, 'brainSummary.data.languageProfileId');
  const counts = asRecord(summary.statusCounts, 'brainSummary.data.statusCounts');
  for (const status of conceptStatuses) requireCount(counts[status], `brainSummary.data.statusCounts.${status}`);
  requireCount(summary.dueCount, 'brainSummary.data.dueCount');
  requireNullableFraction(summary.memoryHealth, 'brainSummary.data.memoryHealth');
  assertCompetence(summary.competence, 'brainSummary.data.competence');
  if (summary.startingLevelEstimate !== null && summary.startingLevelEstimate !== undefined) {
    asRecord(summary.startingLevelEstimate, 'brainSummary.data.startingLevelEstimate');
  }
  if (!Array.isArray(summary.recentConcepts)) throw new Error('Malformed Brain response at brainSummary.data.recentConcepts');
  summary.recentConcepts.forEach((item, index) => assertConceptSummary(item, `brainSummary.data.recentConcepts[${index}]`));
  requireString(summary.calculatedAt, 'brainSummary.data.calculatedAt');
}

function assertCursorResponse(value: unknown, path = 'brainConcepts'): asserts value is BrainConceptListResponseDto {
  const response = asRecord(value, path);
  assertMeta(response.meta, `${path}.meta`);
  const meta = asRecord(response.meta, `${path}.meta`);
  if (meta.nextCursor !== null && typeof meta.nextCursor !== 'string') {
    throw new Error(`Malformed Brain response at ${path}.meta.nextCursor`);
  }
  if (typeof meta.nextCursor === 'string' && meta.nextCursor.trim() === '') {
    throw new Error(`Malformed Brain response at ${path}.meta.nextCursor`);
  }
  requireBoolean(meta.hasMore, `${path}.meta.hasMore`);
  requireCount(meta.pageSize, `${path}.meta.pageSize`);
  if (!Array.isArray(response.data)) throw new Error(`Malformed Brain response at ${path}.data`);
  response.data.forEach((item, index) => assertConceptSummary(item, `${path}.data[${index}]`));
  if (meta.hasMore && meta.nextCursor === null) throw new Error(`Malformed Brain response at ${path}.meta`);
  if (!meta.hasMore && meta.nextCursor !== null) throw new Error(`Malformed Brain response at ${path}.meta`);
}

function assertConceptDetailResponse(value: unknown): asserts value is BrainConceptResponseDto {
  const response = asRecord(value, 'brainConcept');
  assertMeta(response.meta, 'brainConcept.meta');
  const detail = asRecord(response.data, 'brainConcept.data');
  const concept = asRecord(detail.concept, 'brainConcept.data.concept');
  requireString(concept.id, 'brainConcept.data.concept.id');
  requireString(concept.canonicalForm, 'brainConcept.data.concept.canonicalForm');
  assertConceptPresentationFields(concept, 'brainConcept.data.concept');
  if (!Array.isArray(concept.definitions)) throw new Error('Malformed Brain response at brainConcept.data.concept.definitions');
  concept.definitions.forEach((value, index) => {
    const path = `brainConcept.data.concept.definitions[${index}]`;
    const definition = asRecord(value, path);
    requireString(definition.definition, `${path}.definition`);
    if (definition.translation !== undefined && typeof definition.translation !== 'string') {
      throw new Error(`Malformed Brain response at ${path}.translation`);
    }
  });
  if (concept.grammar !== undefined) {
    const grammarPath = 'brainConcept.data.concept.grammar';
    const grammar = asRecord(concept.grammar, grammarPath);
    requireExactKeys(grammar, grammarKeys, grammarPath);
    requireString(grammar.patternFormula, `${grammarPath}.patternFormula`, 1000);
    requireString(grammar.syntacticCategory, `${grammarPath}.syntacticCategory`, 100);
    requireString(grammar.pragmaticFunction, `${grammarPath}.pragmaticFunction`, 2000);
    requireString(grammar.vietnameseExplanation, `${grammarPath}.vietnameseExplanation`, 4000);
    if (grammar.vietnameseCommonTraps !== undefined) {
      requireString(grammar.vietnameseCommonTraps, `${grammarPath}.vietnameseCommonTraps`, 4000);
    }
    if (
      !Array.isArray(grammar.structuralSlots)
      || grammar.structuralSlots.length === 0
      || grammar.structuralSlots.length > 20
    ) {
      throw new Error('Malformed Brain response at brainConcept.data.concept.grammar.structuralSlots');
    }
    grammar.structuralSlots.forEach((value, index) => {
      const path = `brainConcept.data.concept.grammar.structuralSlots[${index}]`;
      const slot = asRecord(value, path);
      requireExactKeys(slot, grammarSlotKeys, path);
      requireString(slot.label, `${path}.label`, 100);
      requireString(slot.role, `${path}.role`, 100);
      requireBoolean(slot.required, `${path}.required`);
      if (!Array.isArray(slot.examples) || slot.examples.length > 10) {
        throw new Error(`Malformed Brain response at ${path}.examples`);
      }
      slot.examples.forEach((example, exampleIndex) => requireString(example, `${path}.examples[${exampleIndex}]`));
    });
  }
  const learner = asRecord(concept.learner, 'brainConcept.data.concept.learner');
  if (typeof learner.status !== 'string' || !conceptStatuses.has(learner.status)) throw new Error('Malformed Brain response at brainConcept.data.concept.learner.status');
  requireBoolean(learner.isDue, 'brainConcept.data.concept.learner.isDue');
  requireCount(learner.exposureCount, 'brainConcept.data.concept.learner.exposureCount');
  assertCompetence(learner.competence, 'brainConcept.data.concept.learner.competence');
  if (learner.memory !== undefined && learner.memory !== null) asRecord(learner.memory, 'brainConcept.data.concept.learner.memory');
  if (typeof detail.status !== 'string' || !conceptStatuses.has(detail.status)) throw new Error('Malformed Brain response at brainConcept.data.status');
  if (detail.status !== learner.status) throw new Error('Malformed Brain response: detail status mismatch');
  assertCompetence(detail.competence, 'brainConcept.data.competence');
  requireNullableFraction(detail.mastery, 'brainConcept.data.mastery');
  requireFraction(detail.confidence, 'brainConcept.data.confidence');
  const evidence = asRecord(detail.evidence, 'brainConcept.data.evidence');
  requireCount(evidence.exposureCount, 'brainConcept.data.evidence.exposureCount');
  requireCount(evidence.reviewCount, 'brainConcept.data.evidence.reviewCount');
  if (evidence.lastSeenAt !== undefined) requireString(evidence.lastSeenAt, 'brainConcept.data.evidence.lastSeenAt');
  if (evidence.lastReviewedAt !== undefined) requireString(evidence.lastReviewedAt, 'brainConcept.data.evidence.lastReviewedAt');
}

function queryForProfile(
  languageProfileId: string | undefined,
  cursor?: string
): OperationQuery<'listBrainConcepts'> | undefined {
  const query: Record<string, string> = {};
  if (languageProfileId) query.languageProfileId = languageProfileId;
  if (cursor) query.cursor = cursor;
  return Object.keys(query).length > 0 ? query as OperationQuery<'listBrainConcepts'> : undefined;
}

function summaryQuery(languageProfileId: string | undefined): OperationQuery<'getBrainSummary'> | undefined {
  return languageProfileId ? { languageProfileId } : undefined;
}

function emptyState(status: BrainLoadStatus = 'loading', error: UiErrorState | null = null): BrainDataState {
  return { status, summary: null, nodes: [], error };
}

function sameContextIdentity(left: BrainContextIdentity | null, right: BrainContextIdentity | null): boolean {
  return Boolean(left && right
    && left.api === right.api
    && left.enabled === right.enabled
    && left.authState === right.authState
    && left.actorEpoch === right.actorEpoch
    && left.actorId === right.actorId
    && left.languageProfileId === right.languageProfileId
    && left.reloadToken === right.reloadToken);
}

export function useBrain(
  api: ApiClient,
  languageProfileId?: string,
  enabled = true,
): UseBrainResult {
  const auth = useOptionalAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [snapshot, setSnapshot] = useState<BrainSnapshot>(() => ({
    identity: null,
    requestId: 0,
    data: emptyState(),
  }));
  const [detailState, setDetailState] = useState<BrainDetailState>(() => ({
    identity: null,
    requestId: 0,
    selected: null,
    loading: false,
    error: null,
  }));
  const loadRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const committedIdentityRef = useRef<BrainContextIdentity | null>(null);
  const layoutLifecycleRef = useRef({ hasMounted: false, needsRecovery: false });
  const [lifecycleRecovery, setLifecycleRecovery] = useState(0);
  const clientVersionRef = useRef({ api, version: 0 });
  if (clientVersionRef.current.api !== api) {
    clientVersionRef.current = { api, version: clientVersionRef.current.version + 1 };
  }

  const actorEpoch = auth?.getActorEpoch?.() ?? auth?.actorEpoch ?? api.getActorGeneration?.() ?? 0;
  const actorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
  const contextIdentity: BrainContextIdentity = useMemo(() => ({
    api,
    enabled,
    authState: auth?.authState,
    actorEpoch,
    actorId,
    languageProfileId: languageProfileId ?? null,
    reloadToken,
  }), [api, enabled, auth?.authState, actorEpoch, actorId, languageProfileId, reloadToken]);
  // A suspended/abandoned render must not invalidate the still-visible request.
  // Render output is masked by identity independently; async guards follow commits.
  useLayoutEffect(() => { committedIdentityRef.current = contextIdentity; }, [contextIdentity]);
  const contextKey = JSON.stringify([
    clientVersionRef.current.version,
    enabled,
    auth?.authState,
    contextIdentity.actorEpoch,
    contextIdentity.actorId,
    contextIdentity.languageProfileId,
    contextIdentity.reloadToken,
  ]);

  const snapshotIsCurrent = sameContextIdentity(snapshot.identity, contextIdentity)
    && snapshot.requestId === loadRequestRef.current;
  const boundaryState = !enabled
    ? emptyState('error', {
      code: 'NETWORK_ERROR',
      message: 'Không thể kết nối. Vui lòng kiểm tra đường truyền.',
      retryable: true,
    })
    : auth?.authState === 'unauthenticated'
      ? emptyState('error', {
        code: 'UNAUTHENTICATED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        retryable: false,
      })
      : emptyState('loading');
  const visibleState = snapshotIsCurrent ? snapshot.data : boundaryState;
  const detailIsCurrent = sameContextIdentity(detailState.identity, contextIdentity)
    && detailState.requestId === detailRequestRef.current;
  const visibleDetail = detailIsCurrent ? detailState : {
    identity: contextIdentity,
    requestId: detailRequestRef.current,
    selected: null,
    loading: false,
    error: null,
  };

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  const selectConcept = useCallback((node: BrainConceptViewModel) => {
    // Bind the callback to the render that offered this selection, not whichever
    // context happens to be current when a delayed event invokes it.
    const operationIdentity = contextIdentity;
    if (!operationIdentity.enabled
      || (operationIdentity.authState !== undefined && operationIdentity.authState !== 'authenticated')
      || !mountedRef.current) return;
    const operationEpoch = operationIdentity.actorEpoch;
    const operationActorId = operationIdentity.actorId;
    const contextIsCurrent = () => {
      if (!mountedRef.current) return false;
      if (!sameContextIdentity(committedIdentityRef.current, operationIdentity)) return false;
      if (auth?.isCurrentActor && !auth.isCurrentActor(operationEpoch, operationActorId)) return false;
      if (!auth && api.getActorGeneration && api.getActorGeneration() !== operationEpoch) return false;
      if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationActorId) return false;
      return true;
    };
    if (!contextIsCurrent()) return;
    const requestId = ++detailRequestRef.current;
    const isCurrent = () => requestId === detailRequestRef.current && contextIsCurrent();

    setDetailState({ identity: operationIdentity, requestId, selected: null, loading: true, error: null });
    void api.getBrainConcept(node.id).then((response) => {
      if (!isCurrent()) return;
      assertConceptDetailResponse(response);
      if (response.data.concept.id !== node.id) {
        throw new Error('Malformed Brain response: detail concept mismatch');
      }
      setDetailState({
        identity: operationIdentity,
        requestId,
        selected: mapBrainConceptDetailToViewModel(response.data, node.translationVi),
        loading: true,
        error: null,
      });
    }).catch((error) => {
      if (!isCurrent() || isLinguaActorAbortedError(error)) return;
      setDetailState({
        identity: operationIdentity,
        requestId,
        selected: null,
        loading: false,
        error: mapApiErrorToUi(error),
      });
    }).finally(() => {
      if (isCurrent()) {
        setDetailState((current) => ({ ...current, loading: false }));
      }
    });
  }, [api, auth, contextIdentity]);

  useLayoutEffect(() => {
    const recoveringAfterHiddenTree = layoutLifecycleRef.current.hasMounted
      && layoutLifecycleRef.current.needsRecovery;
    layoutLifecycleRef.current.hasMounted = true;
    layoutLifecycleRef.current.needsRecovery = false;
    mountedRef.current = true;
    if (recoveringAfterHiddenTree) {
      // Suspense can clean up layout effects without unmounting the hook. The
      // snapshot remains usable, while this token reliably re-runs the load
      // effect so a response ignored while hidden is recovered on reveal.
      loadRequestRef.current += 1;
      detailRequestRef.current += 1;
      setLifecycleRecovery((value) => value + 1);
    }
    return () => {
      layoutLifecycleRef.current.needsRecovery = true;
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    const operationIdentity = contextIdentity;
    let cancelled = false;
    const detailResetId = ++detailRequestRef.current;
    setDetailState({ identity: operationIdentity, requestId: detailResetId, selected: null, loading: false, error: null });

    const isCurrent = () => {
      if (!mountedRef.current || cancelled) return false;
      if (requestId !== loadRequestRef.current) return false;
      if (!sameContextIdentity(committedIdentityRef.current, operationIdentity)) return false;
      if (auth?.isCurrentActor && !auth.isCurrentActor(operationIdentity.actorEpoch, operationIdentity.actorId)) return false;
      if (!auth && api.getActorGeneration && api.getActorGeneration() !== operationIdentity.actorEpoch) return false;
      if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationIdentity.actorId) return false;
      return true;
    };

    const commitState = (data: BrainDataState) => {
      if (isCurrent()) setSnapshot({ identity: operationIdentity, requestId, data });
    };

    if (!enabled) {
      commitState(emptyState('error', {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối. Vui lòng kiểm tra đường truyền.',
        retryable: true,
      }));
      return () => {
        cancelled = true;
        loadRequestRef.current += 1;
        detailRequestRef.current += 1;
      };
    }

    if (auth && auth.authState !== 'authenticated') {
      commitState(auth.authState === 'loading'
        ? emptyState('loading')
        : emptyState('error', {
          code: 'UNAUTHENTICATED',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          retryable: false,
        }));
      return () => {
        cancelled = true;
        loadRequestRef.current += 1;
        detailRequestRef.current += 1;
      };
    }

    commitState(emptyState('loading'));

    const load = async () => {
      try {
        const summaryResponse = await api.getBrainSummary(summaryQuery(languageProfileId));
        if (!isCurrent()) return;
        assertSummaryResponse(summaryResponse);

        if (languageProfileId && summaryResponse.data.languageProfileId !== languageProfileId) {
          throw new Error('Malformed Brain response: summary profile mismatch');
        }

        const summaryProfileId = summaryResponse.data.languageProfileId;
        const allItems: BrainConceptSummaryDto[] = [];
        const seenConceptIds = new Set<string>();
        const seenCursors = new Set<string>();
        let cursor: string | undefined;

        while (true) {
          const listResponse = await api.listBrainConcepts(queryForProfile(summaryProfileId || languageProfileId, cursor));
          if (!isCurrent()) return;
          assertCursorResponse(listResponse);
          for (const item of listResponse.data) {
            if (seenConceptIds.has(item.concept.id)) throw new Error('Malformed Brain response: duplicate concept');
            seenConceptIds.add(item.concept.id);
            allItems.push(item);
          }
          if (!listResponse.meta.hasMore) break;
          const nextCursor = listResponse.meta.nextCursor;
          if (!nextCursor || seenCursors.has(nextCursor)) throw new Error('Malformed Brain response: invalid cursor traversal');
          seenCursors.add(nextCursor);
          cursor = nextCursor;
        }

        if (!isCurrent()) return;
        commitState({
          status: allItems.length === 0 ? 'empty' : 'success',
          summary: mapBrainSummaryToViewModel(summaryResponse.data),
          nodes: allItems.map((item) => mapBrainConceptToViewModel(item)),
          error: null,
        });
      } catch (error) {
        if (!isCurrent() || isLinguaActorAbortedError(error)) return;
        commitState(emptyState('error', mapApiErrorToUi(error)));
      }
    };

    void load();
    return () => {
      cancelled = true;
      loadRequestRef.current += 1;
      detailRequestRef.current += 1;
    };
  }, [api, auth?.authState, auth?.actorEpoch, auth?.user?.id, auth?.getActorEpoch, auth?.isCurrentActor, enabled, languageProfileId, reloadToken, lifecycleRecovery, contextIdentity]);

  return {
    ...visibleState,
    retry,
    contextKey,
    selectedDetail: visibleDetail.selected,
    detailLoading: visibleDetail.loading,
    detailError: visibleDetail.error,
    selectConcept,
  };
}
