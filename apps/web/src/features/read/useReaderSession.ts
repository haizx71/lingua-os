'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  mapContentToReaderPassage,
  type ApiClient,
  type ConceptDetailDto,
  type ReaderPassageViewModel,
  type ReaderProgressViewModel,
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
}

export interface ReaderSessionState {
  readonly status: ReaderLoadStatus;
  readonly passage: ReaderPassageViewModel | null;
  readonly error: UiErrorState | null;
  readonly languageProfileId: string | null;
  readonly selectedToken: ReaderTokenViewModel | null;
  readonly inspecting: boolean;
  readonly actionError: ReaderActionError | null;
  readonly busyKeys: ReadonlySet<string>;
  readonly savedSentenceIds: ReadonlySet<string>;
  readonly savedConceptIds: ReadonlySet<string>;
  retry(): void;
  inspectToken(token: ReaderTokenViewModel): Promise<void>;
  closeInspector(): void;
  saveConcept(token: ReaderTokenViewModel): Promise<boolean>;
  saveSentence(sentenceId: string): Promise<void>;
  saveContent(): Promise<void>;
  completeSegment(segmentId: string, isCompleted: boolean): Promise<void>;
}

const fallbackUuid = '00000000-0000-4000-8000-000000000001';

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
}: UseReaderSessionOptions = {}): ReaderSessionState {
  const auth = useOptionalAuth();
  const api = customApiClient ?? getApiClient();
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<ReaderLoadStatus>(initialPassage ? 'success' : 'loading');
  const [passage, setPassage] = useState<ReaderPassageViewModel | null>(initialPassage ?? null);
  const [error, setError] = useState<UiErrorState | null>(null);
  const [languageProfileId, setLanguageProfileId] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<ReaderTokenViewModel | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [actionError, setActionError] = useState<ReaderActionError | null>(null);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [savedSentenceIds, setSavedSentenceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [savedConceptIds, setSavedConceptIds] = useState<ReadonlySet<string>>(() => new Set());
  const loadSequenceRef = useRef(0);
  const inspectSequenceRef = useRef(0);
  const previousActorIdRef = useRef<string | null>(auth?.user?.id ?? null);
  const idempotencyKeysRef = useRef(new Map<string, string>());
  const busyRef = useRef(new Set<string>());

  const actorEpoch = auth?.getActorEpoch?.() ?? api.getActorGeneration?.() ?? 0;
  const actorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
  const authState = auth?.authState;

  const isCurrent = useCallback((epoch: number, operationActorId: string | null) => {
    if (initialPassage) return true;
    if (auth?.isCurrentActor && !auth.isCurrentActor(epoch, operationActorId)) return false;
    if (!auth && api.getActorGeneration && api.getActorGeneration() !== epoch) return false;
    if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationActorId) return false;
    return true;
  }, [api, auth, initialPassage]);

  const clearActorState = useCallback(() => {
    loadSequenceRef.current += 1;
    inspectSequenceRef.current += 1;
    idempotencyKeysRef.current.clear();
    busyRef.current.clear();
    setPassage(null);
    setError(null);
    setLanguageProfileId(null);
    setSelectedToken(null);
    setInspecting(false);
    setActionError(null);
    setBusyKeys(new Set());
    setSavedSentenceIds(new Set());
    setSavedConceptIds(new Set());
    setStatus('loading');
  }, []);

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
      !cancelled && sequence === loadSequenceRef.current && isCurrent(operationEpoch, operationActorId);

    setStatus('loading');
    setPassage(null);
    setError(null);
    setSelectedToken(null);
    setActionError(null);

    void (async () => {
      try {
        const me = await api.getMe();
        if (!operationIsCurrent()) return;
        const profile = me.data.languageProfiles.find((item) =>
          item.status === 'active' && item.targetLanguageCode === 'en'
        );
        if (!profile) {
          setStatus('empty');
          setLanguageProfileId(null);
          return;
        }

        const recommendations = await api.listRecommendedContent({ languageProfileId: profile.id });
        if (!operationIsCurrent()) return;
        const recommendation = recommendations.data[0];
        if (!recommendation) {
          setLanguageProfileId(profile.id);
          setStatus('empty');
          return;
        }

        const content = await api.getContent(recommendation.id);
        if (!operationIsCurrent()) return;
        if (content.data.summary.id !== recommendation.id) {
          throw new Error('Reader content identity mismatch');
        }
        setLanguageProfileId(profile.id);
        setPassage(mapContentToReaderPassage(content.data));
        setStatus('success');
      } catch (cause) {
        if (!operationIsCurrent() || isLinguaActorAbortedError(cause)) return;
        setPassage(null);
        setError(mapApiErrorToUi(cause));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (sequence === loadSequenceRef.current) loadSequenceRef.current += 1;
    };
  }, [api, actorEpoch, actorId, auth, authState, clearActorState, enabled, initialPassage, isCurrent, reloadToken]);

  const beginAction = useCallback((key: string): boolean => {
    if (busyRef.current.has(key)) return false;
    busyRef.current.add(key);
    setBusyKeys(new Set(busyRef.current));
    setActionError(null);
    return true;
  }, []);

  const endAction = useCallback((key: string, epoch: number, operationActorId: string | null) => {
    if (!isCurrent(epoch, operationActorId)) return;
    busyRef.current.delete(key);
    setBusyKeys(new Set(busyRef.current));
  }, [isCurrent]);

  const keyFor = useCallback((logicalOperation: string) => {
    const existing = idempotencyKeysRef.current.get(logicalOperation);
    if (existing) return existing;
    const created = newIdempotencyKey();
    idempotencyKeysRef.current.set(logicalOperation, created);
    return created;
  }, []);

  const inspectToken = useCallback(async (token: ReaderTokenViewModel) => {
    if (!token.conceptId || !passage) return;
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
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    const logical = `lookup:${passage.id}:${token.segmentId}:${token.sentenceId}:${token.startOffset}:${token.endOffset}`;
    const operationIsCurrent = () =>
      sequence === inspectSequenceRef.current && isCurrent(operationEpoch, operationActorId);

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
  }, [actorEpoch, actorId, api, initialPassage, isCurrent, keyFor, languageProfileId, passage]);

  const closeInspector = useCallback(() => {
    inspectSequenceRef.current += 1;
    setSelectedToken(null);
    setInspecting(false);
    setActionError(null);
  }, []);

  const saveConcept = useCallback(async (token: ReaderTokenViewModel) => {
    if (!token.conceptId) return false;
    const actionKey = `concept:${token.conceptId}`;
    if (!beginAction(actionKey)) return false;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    try {
      const response = await api.saveConceptToLibrary(token.conceptId);
      if (!isCurrent(operationEpoch, operationActorId)) return false;
      if (response.data.isSaved) {
        setSavedConceptIds((current) => new Set(current).add(token.conceptId!));
        return true;
      }
      return false;
    } catch (cause) {
      if (isCurrent(operationEpoch, operationActorId) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'concept', message: actionMessage('concept') });
      }
      return false;
    } finally {
      endAction(actionKey, operationEpoch, operationActorId);
    }
  }, [actorEpoch, actorId, api, beginAction, endAction, isCurrent]);

  const saveSentence = useCallback(async (sentenceId: string) => {
    const actionKey = `sentence:${sentenceId}`;
    if (!beginAction(actionKey)) return;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    try {
      const response = await api.saveReaderSentence({
        body: { sentenceId },
        headers: { 'Idempotency-Key': keyFor(actionKey) },
      });
      if (!isCurrent(operationEpoch, operationActorId)) return;
      if (response.data.isSaved) {
        setSavedSentenceIds((current) => new Set(current).add(sentenceId));
        idempotencyKeysRef.current.delete(actionKey);
      }
    } catch (cause) {
      if (isCurrent(operationEpoch, operationActorId) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'sentence', message: actionMessage('sentence') });
      }
    } finally {
      endAction(actionKey, operationEpoch, operationActorId);
    }
  }, [actorEpoch, actorId, api, beginAction, endAction, isCurrent, keyFor]);

  const saveContent = useCallback(async () => {
    if (!passage) return;
    const actionKey = `content:${passage.id}`;
    if (!beginAction(actionKey)) return;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    try {
      const response = await api.saveContentToLibrary(passage.id);
      if (!isCurrent(operationEpoch, operationActorId)) return;
      if (response.data.isSaved) setPassage((current) => current ? { ...current, isSaved: true } : null);
    } catch (cause) {
      if (isCurrent(operationEpoch, operationActorId) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'content', message: actionMessage('content') });
      }
    } finally {
      endAction(actionKey, operationEpoch, operationActorId);
    }
  }, [actorEpoch, actorId, api, beginAction, endAction, isCurrent, passage]);

  const completeSegment = useCallback(async (segmentId: string, isCompleted: boolean) => {
    if (!passage || !languageProfileId) return;
    const actionKey = `segment:${passage.id}:${segmentId}:${isCompleted}`;
    if (!beginAction(actionKey)) return;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
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
      if (!isCurrent(operationEpoch, operationActorId)) return;
      const response = await api.updateReaderProgress({
        contentId: passage.id,
        body: { languageProfileId, currentSegmentId: segmentId, isCompleted },
        headers: { 'Idempotency-Key': keyFor(progressLogical) },
      });
      if (!isCurrent(operationEpoch, operationActorId)) return;
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
      if (isCurrent(operationEpoch, operationActorId) && !isLinguaActorAbortedError(cause)) {
        setActionError({ kind: 'progress', message: actionMessage('progress') });
      }
    } finally {
      endAction(actionKey, operationEpoch, operationActorId);
    }
  }, [actorEpoch, actorId, api, beginAction, endAction, isCurrent, keyFor, languageProfileId, passage]);

  return {
    status,
    passage,
    error,
    languageProfileId,
    selectedToken,
    inspecting,
    actionError,
    busyKeys,
    savedSentenceIds,
    savedConceptIds,
    retry: () => setReloadToken((value) => value + 1),
    inspectToken,
    closeInspector,
    saveConcept,
    saveSentence,
    saveContent,
    completeSegment,
  };
}
