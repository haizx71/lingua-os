'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  mapContentToReaderPassage,
  mapDictionaryLookupToReaderViewModel,
  type ApiClient,
  type ConceptDetailDto,
  type ReaderPassageViewModel,
  type ReaderProgressViewModel,
  type ReaderLookupViewModel,
  type ReaderTokenViewModel,
  type UiErrorState,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';

export type ReaderLoadStatus = 'loading' | 'success' | 'empty' | 'error';

export interface ReaderActionError {
  readonly kind: 'lookup' | 'exposure' | 'progress' | 'sentence' | 'content' | 'concept';
  readonly message: string;
}

export interface UseReaderSessionOptions {
  readonly apiClient?: ApiClient;
  readonly initialPassage?: ReaderPassageViewModel;
  readonly enabled?: boolean;
  readonly requestedContentId?: string | null;
}

export interface ReaderSessionState {
  readonly status: ReaderLoadStatus;
  readonly passage: ReaderPassageViewModel | null;
  readonly error: UiErrorState | null;
  readonly languageProfileId: string | null;
  readonly selectedToken: ReaderTokenViewModel | null;
  readonly lookupResult: ReaderLookupViewModel | null;
  readonly lookupStatus: 'idle' | 'loading' | 'found' | 'not_found' | 'error' | 'timeout';
  readonly inspecting: boolean;
  readonly actionError: ReaderActionError | null;
  readonly busyKeys: ReadonlySet<string>;
  readonly savedSentenceIds: ReadonlySet<string>;
  readonly savedConceptIds: ReadonlySet<string>;
  retry(): void;
  inspectToken(token: ReaderTokenViewModel): Promise<void>;
  lookupToken(token: ReaderTokenViewModel): Promise<void>;
  retryLookup(): Promise<void>;
  closeInspector(): void;
  saveConcept(token: ReaderTokenViewModel): Promise<boolean>;
  saveSentence(sentenceId: string): Promise<void>;
  saveContent(): Promise<void>;
  completeSegment(segmentId: string, isCompleted: boolean): Promise<void>;
}

const fallbackUuid = '00000000-0000-4000-8000-000000000001';
const boundedUuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface ReaderOperationIdentity {
  readonly requestIdentity: string;
  readonly loadSequence: number;
  readonly actorEpoch: number;
  readonly actorId: string | null;
  readonly languageProfileId: string | null;
  readonly contentId: string | null;
  readonly operationKey: string;
  readonly operationSequence: number;
}

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : fallbackUuid;
}

function actionMessage(kind: ReaderActionError['kind']): string {
  switch (kind) {
    case 'lookup': return 'Không thể tải chi tiết từ vựng';
    case 'exposure': return 'Không thể lưu tương tác đọc';
    case 'progress': return 'Không thể lưu tiến độ đọc';
    case 'sentence': return 'Không thể lưu câu';
    case 'content': return 'Không thể lưu bài đọc';
    case 'concept': return 'Không thể lưu từ vựng';
  }
}

function detailToken(token: ReaderTokenViewModel, detail: ConceptDetailDto): ReaderTokenViewModel {
  return {
    ...token,
    raw: token.raw,
    lemma: detail.canonicalForm,
    ...(detail.ipa ? { ipa: detail.ipa } : {}),
    ...(detail.partOfSpeech ? { pos: detail.partOfSpeech } : {}),
    ...(detail.definitions[0]?.translation
      ? { translationVi: detail.definitions[0].translation }
      : {}),
    ...(detail.definitions[0]?.definition
      ? { explanationEn: detail.definitions[0].definition }
      : {}),
  };
}

export function useReaderSession({
  apiClient: customApiClient,
  initialPassage,
  enabled = true,
  requestedContentId,
}: UseReaderSessionOptions = {}): ReaderSessionState {
  const auth = useOptionalAuth();
  const api = customApiClient ?? getApiClient();
  const requestIdentity = requestedContentId === undefined
    ? 'recommendations'
    : requestedContentId === null ? 'duplicate' : `requested:${requestedContentId}`;
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<ReaderLoadStatus>(initialPassage ? 'success' : 'loading');
  const [settledRequestIdentity, setSettledRequestIdentity] = useState<string | null>(initialPassage ? 'sample' : null);
  const [passage, setPassage] = useState<ReaderPassageViewModel | null>(initialPassage ?? null);
  const [error, setError] = useState<UiErrorState | null>(null);
  const [languageProfileId, setLanguageProfileId] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<ReaderTokenViewModel | null>(null);
  const [lookupResult, setLookupResult] = useState<ReaderLookupViewModel | null>(null);
  const [lookupStatus, setLookupStatus] = useState<ReaderSessionState['lookupStatus']>('idle');
  const [inspecting, setInspecting] = useState(false);
  const [actionError, setActionError] = useState<ReaderActionError | null>(null);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [savedSentenceIds, setSavedSentenceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [savedConceptIds, setSavedConceptIds] = useState<ReadonlySet<string>>(() => new Set());
  const loadSequenceRef = useRef(0);
  const inspectSequenceRef = useRef(0);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const lookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupTokenRef = useRef<ReaderTokenViewModel | null>(null);
  const operationSequencesRef = useRef(new Map<string, number>());
  const previousActorIdRef = useRef<string | null>(auth?.user?.id ?? null);
  const idempotencyKeysRef = useRef(new Map<string, string>());
  const busyRef = useRef(new Set<string>());
  const requestIdentityRef = useRef(requestIdentity);
  requestIdentityRef.current = requestIdentity;
  const profileIdRef = useRef(languageProfileId);
  profileIdRef.current = languageProfileId;
  const passageIdRef = useRef(passage?.id ?? null);
  passageIdRef.current = passage?.id ?? null;

  const cancelLookup = useCallback(() => {
    if (lookupTimeoutRef.current !== null) {
      clearTimeout(lookupTimeoutRef.current);
      lookupTimeoutRef.current = null;
    }
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
  }, []);

  const actorEpoch = auth?.getActorEpoch?.() ?? api.getActorGeneration?.() ?? 0;
  const actorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
  const authState = auth?.authState;
  const lookupActorIdentityRef = useRef({ actorEpoch, actorId });

  useEffect(() => {
    const previous = lookupActorIdentityRef.current;
    if (previous.actorEpoch === actorEpoch && previous.actorId === actorId) return;
    lookupActorIdentityRef.current = { actorEpoch, actorId };
    cancelLookup();
    inspectSequenceRef.current += 1;
    lookupTokenRef.current = null;
    setLookupResult(null);
    setLookupStatus('idle');
    setSelectedToken(null);
    setInspecting(false);
  }, [actorEpoch, actorId, cancelLookup]);

  const isCurrent = useCallback((epoch: number, operationActorId: string | null) => {
    if (initialPassage) return true;
    if (auth?.isCurrentActor && !auth.isCurrentActor(epoch, operationActorId)) return false;
    if (!auth && api.getActorGeneration && api.getActorGeneration() !== epoch) return false;
    if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationActorId) return false;
    return true;
  }, [api, auth, initialPassage]);

  const isOperationCurrent = useCallback((operation: ReaderOperationIdentity) => {
    return operation.requestIdentity === requestIdentityRef.current
      && operation.loadSequence === loadSequenceRef.current
      && operation.languageProfileId === profileIdRef.current
      && operation.contentId === passageIdRef.current
      && operationSequencesRef.current.get(operation.operationKey) === operation.operationSequence
      && isCurrent(operation.actorEpoch, operation.actorId);
  }, [isCurrent]);

  const isOperationActorCurrent = useCallback((operation: ReaderOperationIdentity) => {
    return isCurrent(operation.actorEpoch, operation.actorId);
  }, [isCurrent]);

  const canContinueBoundMutation = useCallback((operation: ReaderOperationIdentity) => {
    if (!isOperationActorCurrent(operation)) return false;
    if (requestIdentityRef.current !== operation.requestIdentity) return true;
    return operation.loadSequence === loadSequenceRef.current
      && operation.languageProfileId === profileIdRef.current;
  }, [isOperationActorCurrent]);

  const captureOperation = useCallback((
    operationKey: string,
    operationProfileId: string | null,
    operationContentId: string | null,
  ): ReaderOperationIdentity => {
    const operationSequence = (operationSequencesRef.current.get(operationKey) ?? 0) + 1;
    operationSequencesRef.current.set(operationKey, operationSequence);
    return {
      requestIdentity,
      loadSequence: loadSequenceRef.current,
      actorEpoch,
      actorId,
      languageProfileId: operationProfileId,
      contentId: operationContentId,
      operationKey,
      operationSequence,
    };
  }, [actorEpoch, actorId, requestIdentity]);

  const clearActorState = useCallback(() => {
    cancelLookup();
    loadSequenceRef.current += 1;
    inspectSequenceRef.current += 1;
    operationSequencesRef.current.clear();
    idempotencyKeysRef.current.clear();
    busyRef.current.clear();
    setPassage(null);
    setError(null);
    setLanguageProfileId(null);
    setSelectedToken(null);
    setLookupResult(null);
    setLookupStatus('idle');
    setInspecting(false);
    setActionError(null);
    setBusyKeys(new Set());
    setSavedSentenceIds(new Set());
    setSavedConceptIds(new Set());
    setStatus('loading');
    setSettledRequestIdentity(null);
  }, [cancelLookup]);

  useEffect(() => () => cancelLookup(), [cancelLookup]);

  useEffect(() => {
    cancelLookup();
    inspectSequenceRef.current += 1;
    lookupTokenRef.current = null;
    setLookupResult(null);
    setLookupStatus('idle');
    setSelectedToken(null);
    setInspecting(false);
  }, [cancelLookup, requestIdentity, passage?.id]);

  useEffect(() => {
    if (initialPassage) return;
    const currentActorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
    if (previousActorIdRef.current !== currentActorId) clearActorState();
    previousActorIdRef.current = currentActorId;
  }, [api, auth?.user?.id, clearActorState, initialPassage]);

  useEffect(() => {
    if (initialPassage || !enabled) return;
    if (auth && authState !== 'authenticated') {
      clearActorState();
      return;
    }

    const sequence = ++loadSequenceRef.current;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    let cancelled = false;
    const operationIsCurrent = () =>
      !cancelled && sequence === loadSequenceRef.current
        && requestIdentity === requestIdentityRef.current
        && isCurrent(operationEpoch, operationActorId);

    setStatus('loading');
    setSettledRequestIdentity(null);
    setPassage(null);
    setError(null);
    setLanguageProfileId(null);
    setSelectedToken(null);
    setInspecting(false);
    setActionError(null);
    setBusyKeys(new Set());
    setSavedSentenceIds(new Set());
    setSavedConceptIds(new Set());
    busyRef.current.clear();
    operationSequencesRef.current.clear();
    inspectSequenceRef.current += 1;

    const unavailable = () => {
      setError({ code: 'NOT_FOUND', message: 'Không tìm thấy nội dung được yêu cầu.', retryable: true });
      setStatus('error');
      setSettledRequestIdentity(requestIdentity);
    };

    void (async () => {
      try {
        let selectedContentId: string | undefined;
        if (requestedContentId !== undefined) {
          if (requestedContentId === null || !boundedUuidPattern.test(requestedContentId)) {
            if (operationIsCurrent()) unavailable();
            return;
          }
          selectedContentId = requestedContentId.toLowerCase();
        }

        const me = await api.getMe();
        if (!operationIsCurrent()) return;
        const profile = me.data.languageProfiles.find((item) =>
          item.status === 'active' && item.targetLanguageCode === 'en'
        );
        if (!profile) {
          setStatus('empty');
          setLanguageProfileId(null);
          setSettledRequestIdentity(requestIdentity);
          return;
        }

        let contentId = selectedContentId;
        if (contentId === undefined) {
          const recommendations = await api.listRecommendedContent({ languageProfileId: profile.id });
          if (!operationIsCurrent()) return;
          const recommendation = recommendations.data[0];
          if (!recommendation) {
            setLanguageProfileId(profile.id);
            setStatus('empty');
            setSettledRequestIdentity(requestIdentity);
            return;
          }
          contentId = recommendation.id;
        }

        const content = await api.getContent(contentId);
        if (!operationIsCurrent()) return;
        const returnedContentId = content.data.summary.id;
        if (selectedContentId !== undefined
          ? returnedContentId.toLowerCase() !== selectedContentId
          : returnedContentId !== contentId) {
          throw new Error('Reader content identity mismatch');
        }
        setLanguageProfileId(profile.id);
        setPassage(mapContentToReaderPassage(content.data));
        setStatus('success');
        setSettledRequestIdentity(requestIdentity);
      } catch (cause) {
        if (!operationIsCurrent() || isLinguaActorAbortedError(cause)) return;
        setPassage(null);
        setError(mapApiErrorToUi(cause));
        setStatus('error');
        setSettledRequestIdentity(requestIdentity);
      }
    })();

    return () => {
      cancelled = true;
      if (sequence === loadSequenceRef.current) loadSequenceRef.current += 1;
    };
  }, [api, actorEpoch, actorId, auth, authState, clearActorState, enabled, initialPassage, isCurrent, reloadToken, requestIdentity, requestedContentId]);

  const beginAction = useCallback((operation: ReaderOperationIdentity): boolean => {
    if (!isOperationCurrent(operation) || busyRef.current.has(operation.operationKey)) return false;
    busyRef.current.add(operation.operationKey);
    setBusyKeys(new Set(busyRef.current));
    setActionError(null);
    return true;
  }, [isOperationCurrent]);

  const endAction = useCallback((operation: ReaderOperationIdentity) => {
    if (!isOperationCurrent(operation)) return;
    busyRef.current.delete(operation.operationKey);
    setBusyKeys(new Set(busyRef.current));
  }, [isOperationCurrent]);

  const keyFor = useCallback((logicalOperation: string) => {
    const existing = idempotencyKeysRef.current.get(logicalOperation);
    if (existing) return existing;
    const created = newIdempotencyKey();
    idempotencyKeysRef.current.set(logicalOperation, created);
    return created;
  }, []);

  const inspectToken = useCallback(async (token: ReaderTokenViewModel) => {
    if (!token.conceptId || !passage) return;
    cancelLookup();
    setLookupResult(null);
    setLookupStatus('idle');
    lookupTokenRef.current = null;
    if (initialPassage && !languageProfileId) {
      setSelectedToken(token);
      setInspecting(false);
      setActionError(null);
      return;
    }
    if (!token.segmentId || !token.sentenceId
      || token.startOffset === undefined || token.endOffset === undefined
      || !languageProfileId) return;
    const sequence = ++inspectSequenceRef.current;
    const logical = `lookup:${passage.id}:${token.segmentId}:${token.sentenceId}:${token.startOffset}:${token.endOffset}`;
    const operation = captureOperation(logical, languageProfileId, passage.id);
    const operationIsCurrent = () => sequence === inspectSequenceRef.current && isOperationCurrent(operation);
    if (!operationIsCurrent()) return;

    setSelectedToken(token);
    setInspecting(true);
    setActionError(null);

    const exposure = api.recordReaderExposure({
      body: {
        languageProfileId,
        contentId: passage.id,
        segmentId: token.segmentId,
        sentenceId: token.sentenceId,
        startOffset: token.startOffset,
        endOffset: token.endOffset,
        exposureType: 'lookup',
      },
      headers: { 'Idempotency-Key': keyFor(logical) },
    }).catch((cause) => {
      if (operationIsCurrent() && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'exposure', message: actionMessage('exposure') });
      }
    });

    try {
      const response = await api.getConcept(token.conceptId);
      if (!operationIsCurrent()) return;
      if (response.data.id !== token.conceptId) throw new Error('Reader concept identity mismatch');
      setSelectedToken(detailToken(token, response.data));
    } catch (cause) {
      if (!operationIsCurrent() || isLinguaActorAbortedError(cause)) return;
      setActionError({ kind: 'lookup', message: actionMessage('lookup') });
    } finally {
      await exposure;
      if (operationIsCurrent()) setInspecting(false);
    }
  }, [api, cancelLookup, captureOperation, initialPassage, isOperationCurrent, keyFor, languageProfileId, passage]);

  const lookupToken = useCallback(async (token: ReaderTokenViewModel) => {
    if (!token.isLookupable || !passage) return;
    cancelLookup();
    const sequence = ++inspectSequenceRef.current;
    const logical = `dictionary:${passage.id}:${token.segmentId ?? ''}:${token.sentenceId ?? ''}:${token.startOffset ?? -1}:${token.endOffset ?? -1}`;
    const operation = captureOperation(logical, languageProfileId, passage.id);
    const controller = new AbortController();
    let timedOut = false;
    const operationIsCurrent = () => {
      const actorCurrent = auth?.isCurrentActor
        ? auth.isCurrentActor(operation.actorEpoch, operation.actorId)
        : (!api.getActorGeneration || api.getActorGeneration() === operation.actorEpoch)
          && (!api.getCurrentActorId || api.getCurrentActorId() === operation.actorId);
      return sequence === inspectSequenceRef.current
        && isOperationCurrent(operation)
        && actorCurrent;
    };
    lookupAbortRef.current = controller;
    lookupTokenRef.current = token;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 5000);
    lookupTimeoutRef.current = timeout;
    setSelectedToken(token);
    setLookupResult(null);
    setLookupStatus('loading');
    setInspecting(true);
    setActionError(null);

    try {
      const response = await api.lookupDictionaryWord(
        { surface: token.raw },
        { signal: controller.signal }
      );
      if (!operationIsCurrent()) return;
      if (response.data.surface !== token.raw) throw new Error('Reader lookup surface mismatch');
      const result = mapDictionaryLookupToReaderViewModel(response.data);
      setLookupResult(result);
      setLookupStatus(result.matchStatus);
    } catch (cause) {
      if (!operationIsCurrent() || isLinguaActorAbortedError(cause)) return;
      setLookupStatus(timedOut ? 'timeout' : 'error');
    } finally {
      if (lookupTimeoutRef.current === timeout) {
        clearTimeout(timeout);
        lookupTimeoutRef.current = null;
      }
      if (lookupAbortRef.current === controller) lookupAbortRef.current = null;
      if (operationIsCurrent()) setInspecting(false);
    }
  }, [api, auth, cancelLookup, captureOperation, isOperationCurrent, languageProfileId, passage]);

  const retryLookup = useCallback(async () => {
    const token = lookupTokenRef.current;
    if (token) await lookupToken(token);
  }, [lookupToken]);

  const closeInspector = useCallback(() => {
    cancelLookup();
    inspectSequenceRef.current += 1;
    lookupTokenRef.current = null;
    setSelectedToken(null);
    setLookupResult(null);
    setLookupStatus('idle');
    setInspecting(false);
    setActionError(null);
  }, [cancelLookup]);

  const saveConcept = useCallback(async (token: ReaderTokenViewModel) => {
    if (!token.conceptId) return false;
    const actionKey = `concept:${passage?.id ?? 'sample'}:${token.conceptId}`;
    if (busyRef.current.has(actionKey)) return false;
    const operation = captureOperation(actionKey, languageProfileId, passage?.id ?? null);
    if (!beginAction(operation)) return false;
    try {
      const response = await api.saveConceptToLibrary(token.conceptId);
      if (!isOperationCurrent(operation)) return false;
      if (response.data.isSaved) {
        setSavedConceptIds((current) => new Set(current).add(token.conceptId!));
        return true;
      }
      return false;
    } catch (cause) {
      if (isOperationCurrent(operation) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'concept', message: actionMessage('concept') });
      }
      return false;
    } finally {
      endAction(operation);
    }
  }, [api, beginAction, captureOperation, endAction, isOperationCurrent, languageProfileId, passage]);

  const saveSentence = useCallback(async (sentenceId: string) => {
    if (!passage) return;
    const actionKey = `sentence:${passage.id}:${sentenceId}`;
    if (busyRef.current.has(actionKey)) return;
    const operation = captureOperation(actionKey, languageProfileId, passage.id);
    if (!beginAction(operation)) return;
    try {
      const response = await api.saveReaderSentence({
        body: { sentenceId },
        headers: { 'Idempotency-Key': keyFor(actionKey) },
      });
      if (!isOperationCurrent(operation)) return;
      if (response.data.isSaved) {
        setSavedSentenceIds((current) => new Set(current).add(sentenceId));
        idempotencyKeysRef.current.delete(actionKey);
      }
    } catch (cause) {
      if (isOperationCurrent(operation) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'sentence', message: actionMessage('sentence') });
      }
    } finally {
      endAction(operation);
    }
  }, [api, beginAction, captureOperation, endAction, isOperationCurrent, keyFor, languageProfileId, passage]);

  const saveContent = useCallback(async () => {
    if (!passage) return;
    const actionKey = `content:${passage.id}`;
    if (busyRef.current.has(actionKey)) return;
    const operation = captureOperation(actionKey, languageProfileId, passage.id);
    if (!beginAction(operation)) return;
    try {
      const response = await api.saveContentToLibrary(passage.id);
      if (!isOperationCurrent(operation)) return;
      if (response.data.isSaved) setPassage((current) => current ? { ...current, isSaved: true } : null);
    } catch (cause) {
      if (isOperationCurrent(operation) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'content', message: actionMessage('content') });
      }
    } finally {
      endAction(operation);
    }
  }, [api, beginAction, captureOperation, endAction, isOperationCurrent, languageProfileId, passage]);

  const completeSegment = useCallback(async (segmentId: string, isCompleted: boolean) => {
    if (!passage || !languageProfileId) return;
    const actionKey = `segment:${passage.id}:${segmentId}:${isCompleted}`;
    if (busyRef.current.has(actionKey)) return;
    const operation = captureOperation(actionKey, languageProfileId, passage.id);
    if (!beginAction(operation)) return;
    const exposureLogical = `read:${passage.id}:${segmentId}`;
    const progressLogical = `progress:${passage.id}:${segmentId}:${isCompleted}`;
    try {
      await api.recordReaderExposure({
        body: {
          languageProfileId,
          contentId: passage.id,
          segmentId,
          exposureType: 'read',
        },
        headers: { 'Idempotency-Key': keyFor(exposureLogical) },
      });
      if (!canContinueBoundMutation(operation)) return;
      const response = await api.updateReaderProgress({
        contentId: passage.id,
        body: { languageProfileId, currentSegmentId: segmentId, isCompleted },
        headers: { 'Idempotency-Key': keyFor(progressLogical) },
      });
      if (!isOperationCurrent(operation)) return;
      const nextProgress: ReaderProgressViewModel = {
        currentSegmentId: response.data.currentSegmentId,
        furthestSegmentId: response.data.furthestSegmentId,
        progressPercent: response.data.progressPercent,
        isCompleted: response.data.isCompleted,
      };
      setPassage((current) => current ? { ...current, progress: nextProgress } : null);
      idempotencyKeysRef.current.delete(exposureLogical);
      idempotencyKeysRef.current.delete(progressLogical);
    } catch (cause) {
      if (isOperationCurrent(operation) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'progress', message: actionMessage('progress') });
      }
    } finally {
      endAction(operation);
    }
  }, [api, beginAction, canContinueBoundMutation, captureOperation, endAction, isOperationCurrent, keyFor, languageProfileId, passage]);

  const retry = useCallback(() => {
    loadSequenceRef.current += 1;
    inspectSequenceRef.current += 1;
    operationSequencesRef.current.clear();
    busyRef.current.clear();
    setStatus('loading');
    setSettledRequestIdentity(null);
    setPassage(null);
    setError(null);
    setLanguageProfileId(null);
    setSelectedToken(null);
    setInspecting(false);
    setActionError(null);
    setBusyKeys(new Set());
    setSavedSentenceIds(new Set());
    setSavedConceptIds(new Set());
    setReloadToken((value) => value + 1);
  }, []);

  const currentRequestIsSettled = Boolean(initialPassage) || settledRequestIdentity === requestIdentity;

  return {
    status: currentRequestIsSettled ? status : 'loading',
    passage: currentRequestIsSettled ? passage : null,
    error: currentRequestIsSettled ? error : null,
    languageProfileId: currentRequestIsSettled ? languageProfileId : null,
    selectedToken: currentRequestIsSettled ? selectedToken : null,
    lookupResult: currentRequestIsSettled ? lookupResult : null,
    lookupStatus: currentRequestIsSettled ? lookupStatus : 'idle',
    inspecting: currentRequestIsSettled && inspecting,
    actionError: currentRequestIsSettled ? actionError : null,
    busyKeys: currentRequestIsSettled ? busyKeys : new Set<string>(),
    savedSentenceIds: currentRequestIsSettled ? savedSentenceIds : new Set<string>(),
    savedConceptIds: currentRequestIsSettled ? savedConceptIds : new Set<string>(),
    retry,
    inspectToken,
    lookupToken,
    retryLookup,
    closeInspector,
    saveConcept,
    saveSentence,
    saveContent,
    completeSegment,
  };
}
