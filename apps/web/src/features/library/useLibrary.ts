'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  mapLibraryItemToViewModel,
  type ApiClient,
  type LibraryItemViewModel,
  type LibraryItemsResponseDto,
  type UiErrorState,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';

export type LibraryStatus = 'loading' | 'success' | 'empty' | 'error';

export interface UseLibraryOptions {
  readonly apiClient?: ApiClient;
  readonly initialItems?: readonly LibraryItemViewModel[];
  readonly enabled?: boolean;
}

export interface LibraryState {
  readonly status: LibraryStatus;
  readonly items: readonly LibraryItemViewModel[];
  readonly error: UiErrorState | null;
  readonly mutationError: UiErrorState | null;
  readonly busyKeys: ReadonlySet<string>;
  retry(): void;
  remove(item: LibraryItemViewModel): Promise<void>;
}

function assertPage(response: LibraryItemsResponseDto): void {
  const value = response as unknown as { data?: unknown; meta?: Record<string, unknown> };
  if (!Array.isArray(value.data) || !value.meta
    || typeof value.meta.requestId !== 'string' || !value.meta.requestId
    || value.meta.apiVersion !== '1.0'
    || typeof value.meta.hasMore !== 'boolean'
    || !(typeof value.meta.nextCursor === 'string' || value.meta.nextCursor === null)
    || !Number.isInteger(value.meta.pageSize)
    || (value.meta.pageSize as number) < 0 || (value.meta.pageSize as number) > 100
    || value.data.length > 100
    || value.meta.pageSize !== value.data.length
    || (value.meta.hasMore && (!value.meta.nextCursor || value.meta.nextCursor.length > 512))
    || (!value.meta.hasMore && value.meta.nextCursor !== null)) {
    throw new Error('Invalid Library pagination metadata');
  }
}

export function useLibrary({ apiClient: customApiClient, initialItems, enabled = true }: UseLibraryOptions = {}): LibraryState {
  const auth = useOptionalAuth();
  const api = customApiClient ?? getApiClient();
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<LibraryStatus>(initialItems ? (initialItems.length ? 'success' : 'empty') : 'loading');
  const [items, setItems] = useState<readonly LibraryItemViewModel[]>(initialItems ?? []);
  const [error, setError] = useState<UiErrorState | null>(null);
  const [mutationError, setMutationError] = useState<UiErrorState | null>(null);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const loadSequenceRef = useRef(0);
  const removeSequenceRef = useRef(0);
  const previousActorRef = useRef<string | null>(auth?.user?.id ?? api.getCurrentActorId?.() ?? null);
  const busyRef = useRef(new Map<string, number>());

  const actorEpoch = auth?.getActorEpoch?.() ?? api.getActorGeneration?.() ?? 0;
  const actorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
  const authState = auth?.authState;

  const isCurrent = useCallback((epoch: number, operationActorId: string | null) => {
    if (initialItems) return true;
    if (auth?.isCurrentActor && !auth.isCurrentActor(epoch, operationActorId)) return false;
    if (!auth && api.getActorGeneration && api.getActorGeneration() !== epoch) return false;
    if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationActorId) return false;
    return true;
  }, [api, auth, initialItems]);

  const clearActorState = useCallback(() => {
    loadSequenceRef.current += 1;
    removeSequenceRef.current += 1;
    busyRef.current.clear();
    setItems([]);
    setError(null);
    setMutationError(null);
    setBusyKeys(new Set());
    setStatus('loading');
  }, []);

  useEffect(() => {
    if (initialItems) return;
    const current = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
    if (previousActorRef.current !== current) clearActorState();
    previousActorRef.current = current;
  }, [api, auth?.user?.id, clearActorState, initialItems]);

  useEffect(() => {
    if (initialItems || !enabled) return;
    if (auth && authState !== 'authenticated') {
      clearActorState();
      return;
    }
    const sequence = ++loadSequenceRef.current;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    let cancelled = false;
    const current = () => !cancelled && sequence === loadSequenceRef.current
      && isCurrent(operationEpoch, operationActorId);
    setStatus('loading');
    setItems([]);
    setError(null);
    setMutationError(null);

    void (async () => {
      const collected: LibraryItemViewModel[] = [];
      const cursors = new Set<string>();
      const identities = new Set<string>();
      let cursor: string | undefined;
      try {
        for (;;) {
          const response = await api.listLibraryItems(cursor ? { cursor } : undefined);
          if (!current()) return;
          assertPage(response);
          for (const dto of response.data) {
            const item = mapLibraryItemToViewModel(dto);
            const identity = `${item.itemType}:${item.id}`;
            if (identities.has(identity)) throw new Error('Duplicate Library identity');
            identities.add(identity);
            collected.push(item);
          }
          if (!response.meta.hasMore) break;
          const next = response.meta.nextCursor;
          if (!next || cursors.has(next)) throw new Error('Cyclic Library cursor');
          cursors.add(next);
          cursor = next;
        }
        if (!current()) return;
        setItems(collected);
        setStatus(collected.length ? 'success' : 'empty');
      } catch (cause) {
        if (!current() || isLinguaActorAbortedError(cause)) return;
        setItems([]);
        setError(mapApiErrorToUi(cause));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      if (sequence === loadSequenceRef.current) loadSequenceRef.current += 1;
    };
  }, [actorEpoch, actorId, api, auth, authState, clearActorState, enabled, initialItems, isCurrent, reloadToken]);

  const remove = useCallback(async (item: LibraryItemViewModel) => {
    const key = `${item.itemType}:${item.id}`;
    if (busyRef.current.has(key)) return;
    const token = ++removeSequenceRef.current;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    busyRef.current.set(key, token);
    setBusyKeys(new Set(busyRef.current.keys()));
    setMutationError(null);
    try {
      const response = item.itemType === 'concept'
        ? await api.removeConceptFromLibrary(item.id)
        : item.itemType === 'sentence'
          ? await api.removeSentenceFromLibrary(item.id)
          : await api.removeContentFromLibrary(item.id);
      if (!isCurrent(operationEpoch, operationActorId)) return;
      if (response.data.id !== item.id || response.data.itemType !== item.itemType || response.data.isSaved) {
        throw new Error('Library removal response mismatch');
      }
      setItems((current) => current.filter((candidate) => !(candidate.id === item.id && candidate.itemType === item.itemType)));
    } catch (cause) {
      if (!isCurrent(operationEpoch, operationActorId) || isLinguaActorAbortedError(cause)) return;
      setMutationError(mapApiErrorToUi(cause));
    } finally {
      if (isCurrent(operationEpoch, operationActorId) && busyRef.current.get(key) === token) {
        busyRef.current.delete(key);
        setBusyKeys(new Set(busyRef.current.keys()));
      }
    }
  }, [actorEpoch, actorId, api, isCurrent]);

  return {
    status,
    items,
    error,
    mutationError,
    busyKeys,
    retry: () => setReloadToken((value) => value + 1),
    remove,
  };
}
