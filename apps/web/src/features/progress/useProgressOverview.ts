'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  mapProgressToViewModel,
  type ApiClient,
  type ProgressSummaryViewModel,
  type UiErrorState,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';
import { fetchWithActorCache, invalidateActorCacheForClient } from '../../lib/api/queryCache';

export type ProgressStatus = 'loading' | 'success' | 'empty' | 'error';
export type ProgressWindowOption = 'week' | 'month';

export interface UseProgressOverviewOptions {
  readonly apiClient?: ApiClient;
  readonly initialData?: ProgressSummaryViewModel;
  readonly languageProfileId?: string;
  readonly window?: ProgressWindowOption;
  readonly enabled?: boolean;
}

export interface ProgressOverviewState {
  readonly status: ProgressStatus;
  readonly data: ProgressSummaryViewModel | undefined;
  readonly window: ProgressWindowOption;
  readonly error: UiErrorState | null;
  setWindow(next: ProgressWindowOption): void;
  retry(): void;
}

export function useProgressOverview({
  apiClient: customApiClient,
  initialData,
  languageProfileId,
  window: initialWindow = 'week',
  enabled = true,
}: UseProgressOverviewOptions = {}): ProgressOverviewState {
  const auth = useOptionalAuth();
  const api = customApiClient ?? getApiClient();
  const isLiveEnabled =
    enabled &&
    !initialData &&
    (Boolean(customApiClient) || (api.transportKind === 'http' && auth?.authState === 'authenticated'));

  const [windowOption, setWindowOption] = useState<ProgressWindowOption>(initialWindow);
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<ProgressStatus>(() => {
    if (initialData) return 'success';
    return isLiveEnabled ? 'loading' : 'empty';
  });
  const [data, setData] = useState<ProgressSummaryViewModel | undefined>(initialData);
  const [error, setError] = useState<UiErrorState | null>(null);

  const loadSequenceRef = useRef(0);
  const previousActorRef = useRef<string | null>(auth?.user?.id ?? api.getCurrentActorId?.() ?? null);

  const actorEpoch = auth?.getActorEpoch?.() ?? api.getActorGeneration?.() ?? 0;
  const actorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
  const authState = auth?.authState;

  const isCurrent = useCallback((epoch: number, operationActorId: string | null) => {
    if (initialData) return true;
    if (auth?.isCurrentActor && !auth.isCurrentActor(epoch, operationActorId)) return false;
    if (!auth && api.getActorGeneration && api.getActorGeneration() !== epoch) return false;
    if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationActorId) return false;
    return true;
  }, [api, auth, initialData]);

  const clearActorState = useCallback(() => {
    loadSequenceRef.current += 1;
    setData(undefined);
    setError(null);
    setStatus(isLiveEnabled ? 'loading' : 'empty');
  }, [isLiveEnabled]);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setStatus('success');
      return;
    }
    const currentActor = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
    if (previousActorRef.current !== currentActor) {
      clearActorState();
    }
    previousActorRef.current = currentActor;
  }, [api, auth?.user?.id, clearActorState, initialData]);

  useEffect(() => {
    if (initialData) return;
    if (!isLiveEnabled) {
      setStatus('empty');
      return;
    }
    if (!customApiClient && auth && authState === 'loading') {
      setStatus('loading');
      return;
    }
    if (!customApiClient && (!auth || authState !== 'authenticated')) {
      clearActorState();
      setStatus('empty');
      return;
    }

    const sequence = ++loadSequenceRef.current;
    const operationEpoch = actorEpoch;
    const operationActorId = actorId;
    let cancelled = false;
    const current = () =>
      !cancelled &&
      sequence === loadSequenceRef.current &&
      isCurrent(operationEpoch, operationActorId);

    setStatus('loading');
    setError(null);

    void (async () => {
      try {
        const actorKey = `${operationEpoch}:${operationActorId ?? 'anonymous'}`;
        const cacheKey = `progress:${languageProfileId ?? 'default'}:${windowOption}`;
        const response = await fetchWithActorCache(
          cacheKey,
          actorKey,
          () =>
            api.getProgressOverview({
              ...(languageProfileId ? { languageProfileId } : {}),
              window: windowOption,
            }),
          30_000,
          api
        );
        if (!current()) return;
        const mapped = mapProgressToViewModel(response.data);
        setData(mapped);
        setStatus('success');
      } catch (cause) {
        if (!current() || isLinguaActorAbortedError(cause)) return;
        setData(undefined);
        setError(mapApiErrorToUi(cause));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (sequence === loadSequenceRef.current) loadSequenceRef.current += 1;
    };
  }, [
    actorEpoch,
    actorId,
    api,
    auth,
    authState,
    clearActorState,
    customApiClient,
    initialData,
    isCurrent,
    isLiveEnabled,
    languageProfileId,
    reloadToken,
    windowOption,
  ]);

  const retry = useCallback(() => {
    invalidateActorCacheForClient(api, `${actorEpoch}:${actorId ?? 'anonymous'}`);
    setReloadToken((prev) => prev + 1);
  }, [actorEpoch, actorId, api]);

  return {
    status,
    data,
    window: windowOption,
    error,
    setWindow: setWindowOption,
    retry,
  };
}
