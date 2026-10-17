'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  mapProfileToViewModel,
  type ApiClient,
  type UiErrorState,
  type UserProfileViewModel,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';
import { fetchWithActorCache, invalidateActorCacheForClient } from '../../lib/api/queryCache';

export type LearnerProfileStatus = 'loading' | 'success' | 'empty' | 'error';

export interface UseLearnerProfileOptions {
  readonly apiClient?: ApiClient;
  readonly initialProfile?: Partial<UserProfileViewModel>;
  readonly enabled?: boolean;
}

export interface LearnerProfileState {
  readonly status: LearnerProfileStatus;
  readonly profile: Partial<UserProfileViewModel> | undefined;
  readonly error: UiErrorState | null;
  retry(): void;
}

export function useLearnerProfile({
  apiClient: customApiClient,
  initialProfile,
  enabled = true,
}: UseLearnerProfileOptions = {}): LearnerProfileState {
  const auth = useOptionalAuth();
  const api = customApiClient ?? getApiClient();
  const isLiveEnabled =
    enabled &&
    !initialProfile &&
    (Boolean(customApiClient) || (api.transportKind === 'http' && auth?.authState === 'authenticated'));

  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<LearnerProfileStatus>(() => {
    if (initialProfile) return 'success';
    return isLiveEnabled ? 'loading' : 'empty';
  });
  const [profile, setProfile] = useState<Partial<UserProfileViewModel> | undefined>(initialProfile);
  const [error, setError] = useState<UiErrorState | null>(null);

  const loadSequenceRef = useRef(0);
  const previousActorRef = useRef<string | null>(auth?.user?.id ?? api.getCurrentActorId?.() ?? null);

  const actorEpoch = auth?.getActorEpoch?.() ?? api.getActorGeneration?.() ?? 0;
  const actorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
  const authState = auth?.authState;

  const isCurrent = useCallback((epoch: number, operationActorId: string | null) => {
    if (initialProfile) return true;
    if (auth?.isCurrentActor && !auth.isCurrentActor(epoch, operationActorId)) return false;
    if (!auth && api.getActorGeneration && api.getActorGeneration() !== epoch) return false;
    if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationActorId) return false;
    return true;
  }, [api, auth, initialProfile]);

  const clearActorState = useCallback(() => {
    loadSequenceRef.current += 1;
    setProfile(undefined);
    setError(null);
    setStatus(isLiveEnabled ? 'loading' : 'empty');
  }, [isLiveEnabled]);

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setStatus('success');
      return;
    }
    const currentActor = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
    if (previousActorRef.current !== currentActor) {
      clearActorState();
    }
    previousActorRef.current = currentActor;
  }, [api, auth?.user?.id, clearActorState, initialProfile]);

  useEffect(() => {
    if (initialProfile) return;
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
        const meResponse = await fetchWithActorCache(
          'me',
          actorKey,
          () => api.getMe(),
          30_000,
          api
        );
        if (!current()) return;
        const activeLanguage =
          meResponse.data.languageProfiles.find((item) => item.status === 'active') ??
          meResponse.data.languageProfiles[0];
        const profileQuery = activeLanguage ? { languageProfileId: activeLanguage.id } : undefined;
        const [brainResponse, progressResponse] = await Promise.all([
          fetchWithActorCache(
            `brain-summary:${profileQuery?.languageProfileId ?? 'default'}`,
            actorKey,
            () => api.getBrainSummary(profileQuery),
            30_000,
            api
          ),
          fetchWithActorCache(
            `progress:${profileQuery?.languageProfileId ?? 'default'}:week`,
            actorKey,
            () => api.getProgressOverview(profileQuery ? { ...profileQuery, window: 'week' } : { window: 'week' }),
            30_000,
            api
          ),
        ]);
        if (!current()) return;
        const mapped = mapProfileToViewModel(
          meResponse.data,
          brainResponse.data,
          progressResponse.data
        );
        setProfile(mapped);
        setStatus('success');
      } catch (cause) {
        if (!current() || isLinguaActorAbortedError(cause)) return;
        setProfile(undefined);
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
    initialProfile,
    isCurrent,
    isLiveEnabled,
    reloadToken,
  ]);

  const retry = useCallback(() => {
    invalidateActorCacheForClient(api, `${actorEpoch}:${actorId ?? 'anonymous'}`);
    setReloadToken((prev) => prev + 1);
  }, [actorEpoch, actorId, api]);

  return {
    status,
    profile,
    error,
    retry,
  };
}
