'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  type ApiClient,
  type ConceptDetailDto,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';
import {
  mapConceptDetailToSearchResultViewModel,
  mapConceptSummaryToSearchResultViewModel,
  type ConceptSearchResultViewModel,
} from './adapters';
import type { DictionaryConceptItem } from '../../fixtures/dictionaryFixture';

export interface UseConceptDiscoveryOptions {
  readonly apiClient?: ApiClient;
  readonly initialConcepts?: DictionaryConceptItem[];
  readonly debounceMs?: number;
}

export interface ConceptSaveError {
  readonly conceptId: string;
  readonly message: string;
}

export interface ConceptDiscoveryState {
  readonly searchQuery: string;
  readonly setSearchQuery: (query: string) => void;
  readonly clearSearch: () => void;
  readonly isSearching: boolean;
  readonly searchError: Error | null;
  readonly retrySearch: () => void;
  readonly results: readonly ConceptSearchResultViewModel[];
  readonly savedConceptIds: ReadonlySet<string>;
  readonly isSaved: (conceptId: string) => boolean;
  readonly isSaving: (conceptId: string) => boolean;
  readonly saveConcept: (conceptId: string) => Promise<void>;
  readonly saveError: ConceptSaveError | null;
  readonly clearSaveError: () => void;
  readonly isInspecting: (conceptId: string) => boolean;
  readonly inspectConcept: (conceptId: string) => Promise<void>;
  readonly inspectedDetails: ReadonlyMap<string, ConceptDetailDto>;
  readonly isSavedStateReady: boolean;
  readonly isReconciling: boolean;
  readonly reconciliationError: Error | null;
}

export function useConceptDiscovery({
  apiClient: customApiClient,
  initialConcepts,
  debounceMs = typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 0 : 250,
}: UseConceptDiscoveryOptions = {}): ConceptDiscoveryState {
  const authContext = useOptionalAuth();
  const authState = authContext?.authState ?? 'unauthenticated';
  const user = authContext?.user ?? null;
  const isConfigured = authContext?.isConfigured ?? false;
  const getActorEpoch = authContext?.getActorEpoch;
  const isCurrentActor = authContext?.isCurrentActor;
  const api = customApiClient ?? getApiClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<Error | null>(null);
  const [searchResults, setSearchResults] = useState<readonly ConceptSearchResultViewModel[]>([]);
  const [savedConceptIds, setSavedConceptIds] = useState<ReadonlySet<string>>(() => new Set());
  const [savingConceptIds, setSavingConceptIds] = useState<ReadonlySet<string>>(() => new Set());
  const [saveError, setSaveError] = useState<ConceptSaveError | null>(null);
  const [inspectingConceptIds, setInspectingConceptIds] = useState<ReadonlySet<string>>(() => new Set());
  const [inspectedDetails, setInspectedDetails] = useState<ReadonlyMap<string, ConceptDetailDto>>(
    () => new Map()
  );
  const [isSavedStateReady, setIsSavedStateReady] = useState(() => {
    if (!isConfigured) return true;
    if (authState !== 'authenticated') return true;
    return false;
  });
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationError, setReconciliationError] = useState<Error | null>(null);

  const searchSequenceRef = useRef(0);
  const reconcileSequenceRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActorIdRef = useRef<string | null>(null);

  // Clear state only when an actual actor transition occurs (from one user to another, or user to null)
  // Transitions from initial null -> userId during hydration must not clear user input.
  useEffect(() => {
    const currentActorId = user?.id ?? null;
    if (prevActorIdRef.current !== null && prevActorIdRef.current !== currentActorId) {
      setSearchQuery('');
      setSearchResults([]);
      setSavedConceptIds(new Set());
      setSavingConceptIds(new Set());
      setSaveError(null);
      setInspectingConceptIds(new Set());
      setInspectedDetails(new Map());
      setIsSavedStateReady(false);
      setIsReconciling(false);
      setReconciliationError(null);
      reconcileSequenceRef.current++;
      searchSequenceRef.current = 0;
    }
    prevActorIdRef.current = currentActorId;
  }, [user?.id]);

  // Reconcile saved concepts from authoritative Library API across all cursor pages
  const reconcileSavedConcepts = useCallback(async () => {
    const isAuth = isConfigured && authState === 'authenticated';
    if (!isAuth) {
      setIsSavedStateReady(true);
      setIsReconciling(false);
      return;
    }

    const opEpoch = getActorEpoch ? getActorEpoch() : 0;
    const opActorId = user?.id ?? null;
    const seq = ++reconcileSequenceRef.current;

    setIsSavedStateReady(false);
    setIsReconciling(true);
    setReconciliationError(null);

    const accumulatedIds = new Set<string>();
    const seenCursors = new Set<string>();
    let currentCursor: string | undefined = undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        if (seq !== reconcileSequenceRef.current) return;
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

        const query: { itemType: 'concept'; cursor?: string } = { itemType: 'concept' };
        if (currentCursor !== undefined) {
          query.cursor = currentCursor;
        }

        const response = await api.listLibraryItems(query);

        if (seq !== reconcileSequenceRef.current) return;
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

        for (const item of response.data) {
          if (item.itemType === 'concept' && item.concept?.id) {
            accumulatedIds.add(item.concept.id);
          }
        }

        const nextCursor = response.meta?.nextCursor ?? null;
        const responseHasMore = response.meta?.hasMore ?? Boolean(nextCursor);

        if (!nextCursor || !responseHasMore) {
          hasMore = false;
        } else {
          if (seenCursors.has(nextCursor)) {
            throw new Error(`Pagination loop detected for cursor: ${nextCursor}`);
          }
          seenCursors.add(nextCursor);
          currentCursor = nextCursor;
        }
      }

      if (seq !== reconcileSequenceRef.current) return;
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

      setSavedConceptIds(accumulatedIds);
      setIsSavedStateReady(true);
      setIsReconciling(false);
    } catch (err) {
      if (seq !== reconcileSequenceRef.current) return;
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
      if (isLinguaActorAbortedError(err)) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setReconciliationError(error);
      setIsSavedStateReady(true);
      setIsReconciling(false);
    }
  }, [api, authState, isConfigured, user?.id, getActorEpoch, isCurrentActor]);

  useEffect(() => {
    void reconcileSavedConcepts();
  }, [reconcileSavedConcepts]);

  // Execute dictionary search with sequence counter to drop stale out-of-order responses
  const executeSearch = useCallback(
    async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed) {
        setSearchResults([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      // If query exceeds OpenAPI max_length (120), return empty result immediately
      if (trimmed.length > 120) {
        setSearchResults([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      const seq = ++searchSequenceRef.current;
      const opEpoch = getActorEpoch ? getActorEpoch() : 0;
      const opActorId = user?.id ?? null;

      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await api.searchDictionary({ query: trimmed });
        if (seq !== searchSequenceRef.current) return;
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

        // In mock mode, filter response items by canonical form to match query
        const isMock = typeof (api as unknown as { fixture?: unknown }).fixture === 'function';
        let rawItems = response.data;
        if (isMock) {
          rawItems = rawItems.filter((item) =>
            item.canonicalForm.toLowerCase().includes(trimmed.toLowerCase())
          );
        }

        const mapped = rawItems.map((summary) => {
          const cached = inspectedDetails.get(summary.id);
          if (cached) {
            return mapConceptDetailToSearchResultViewModel(cached, savedConceptIds.has(summary.id));
          }
          return mapConceptSummaryToSearchResultViewModel(summary, savedConceptIds.has(summary.id));
        });
        setSearchResults(mapped);
      } catch (err) {
        if (seq !== searchSequenceRef.current) return;
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
        if (isLinguaActorAbortedError(err)) return;

        const errObj =
          err instanceof Error
            ? err
            : new Error('Không thể tra cứu từ điển lúc này. Vui lòng thử lại.');
        setSearchError(errObj);
      } finally {
        if (seq === searchSequenceRef.current) {
          setIsSearching(false);
        }
      }
    },
    [api, inspectedDetails, savedConceptIds, user?.id, getActorEpoch, isCurrentActor]
  );

  // Debounced search trigger on query text change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    if (debounceMs <= 0) {
      void executeSearch(searchQuery);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(searchQuery);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, debounceMs, executeSearch]);

  const retrySearch = useCallback(() => {
    if (searchQuery.trim()) {
      void executeSearch(searchQuery);
    }
  }, [searchQuery, executeSearch]);

  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setSearchError(null);
  }, []);

  // Inspect a concept lazily via GET /v1/concepts/{conceptId}
  const inspectConcept = useCallback(
    async (conceptId: string) => {
      if (inspectedDetails.has(conceptId)) return;

      const opEpoch = getActorEpoch ? getActorEpoch() : 0;
      const opActorId = user?.id ?? null;

      setInspectingConceptIds((prev) => new Set(prev).add(conceptId));

      try {
        const response = await api.getConcept(conceptId);
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

        setInspectedDetails((prev) => new Map(prev).set(conceptId, response.data));

        // Update search results with detailed definitions
        setSearchResults((prev) =>
          prev.map((item) =>
            item.id === conceptId
              ? mapConceptDetailToSearchResultViewModel(response.data, savedConceptIds.has(conceptId))
              : item
          )
        );
      } catch (err) {
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
        if (isLinguaActorAbortedError(err)) return;
      } finally {
        setInspectingConceptIds((prev) => {
          const next = new Set(prev);
          next.delete(conceptId);
          return next;
        });
      }
    },
    [api, inspectedDetails, savedConceptIds, user?.id, getActorEpoch, isCurrentActor]
  );

  // Explicit Save/Learn invocation via PUT /v1/library/concepts/{conceptId}
  const saveConcept = useCallback(
    async (conceptId: string) => {
      if (!isSavedStateReady || savingConceptIds.has(conceptId) || savedConceptIds.has(conceptId)) return;

      const opEpoch = getActorEpoch ? getActorEpoch() : 0;
      const opActorId = user?.id ?? null;

      setSavingConceptIds((prev) => new Set(prev).add(conceptId));
      setSaveError(null);

      try {
        const response = await api.saveConceptToLibrary(conceptId);
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

        if (response.data.isSaved) {
          setSavedConceptIds((prev) => new Set(prev).add(conceptId));

          // Update in-memory search results
          setSearchResults((prev) =>
            prev.map((item) => (item.id === conceptId ? { ...item, isSaved: true } : item))
          );
        }
      } catch (err) {
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
        if (isLinguaActorAbortedError(err)) return;

        const errMessage =
          err instanceof Error
            ? err.message
            : 'Không thể lưu từ vựng vào kho học. Vui lòng thử lại sau.';
        setSaveError({ conceptId, message: errMessage });
      } finally {
        setSavingConceptIds((prev) => {
          const next = new Set(prev);
          next.delete(conceptId);
          return next;
        });
      }
    },
    [api, savingConceptIds, savedConceptIds, isSavedStateReady, user?.id, getActorEpoch, isCurrentActor]
  );

  // Compute effective results:
  // If search query is present, use live searchResults.
  // If search query is empty and initialConcepts provided, convert them to ConceptSearchResultViewModel.
  const effectiveResults: readonly ConceptSearchResultViewModel[] = searchQuery.trim()
    ? searchResults.map((r) => ({
        ...r,
        isSaved: savedConceptIds.has(r.id),
      }))
    : (initialConcepts ?? []).map((c) => ({
        id: c.id,
        term: c.term,
        lemma: c.lemma,
        pos: c.pos,
        ipa: c.ipa,
        cefrLevel: c.cefrLevel,
        status: c.status,
        isDue: c.isDue,
        isSaved: savedConceptIds.has(c.id),
        primaryTranslationVi: c.primaryTranslationVi,
        definitions: c.definitions.map((d) => ({
          meaningVi: d.meaningVi,
          explanationEn: d.explanationEn,
          examples: d.examples?.map((ex) => ({ source: ex.source, target: ex.target })),
        })),
      }));

  return {
    searchQuery,
    setSearchQuery,
    clearSearch,
    isSearching,
    searchError,
    retrySearch,
    results: effectiveResults,
    savedConceptIds,
    isSaved: (id: string) => savedConceptIds.has(id),
    isSaving: (id: string) => savingConceptIds.has(id),
    saveConcept,
    saveError,
    clearSaveError: () => setSaveError(null),
    isInspecting: (id: string) => inspectingConceptIds.has(id),
    inspectConcept,
    inspectedDetails,
    isSavedStateReady,
    isReconciling,
    reconciliationError,
  };
}
