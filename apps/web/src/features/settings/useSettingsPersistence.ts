'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  type ApiClient,
  type LearningGoal,
  type UiErrorState,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';
import { fetchWithActorCache, invalidateActorCacheForClient } from '../../lib/api/queryCache';

export interface UseSettingsPersistenceOptions {
  readonly apiClient?: ApiClient;
  readonly enabled?: boolean;
}

export interface SettingsPersistenceState {
  readonly isLive: boolean;
  readonly isHydrating: boolean;
  readonly isSaving: boolean;
  readonly persistedDailyMinutes: number | null;
  readonly persistedGoal: LearningGoal | null;
  readonly saveError: UiErrorState | null;
  setDailyMinutes(dailyMinutes: number): void;
  saveDailyMinutes(dailyMinutes: number): Promise<boolean>;
  saveSettings(dailyMinutes: number): Promise<boolean>;
}

export function useSettingsPersistence({
  apiClient: customApiClient,
  enabled = true,
}: UseSettingsPersistenceOptions = {}): SettingsPersistenceState {
  const auth = useOptionalAuth();
  const api = customApiClient ?? getApiClient();
  const isLive = enabled && (Boolean(customApiClient) || api.transportKind === 'http');

  const [isHydrating, setIsHydrating] = useState<boolean>(() => isLive);
  const [isSaving, setIsSaving] = useState(false);
  const [persistedDailyMinutes, setPersistedDailyMinutes] = useState<number | null>(null);
  const [persistedGoal, setPersistedGoal] = useState<LearningGoal | null>(null);
  const [languageProfileId, setLanguageProfileId] = useState<string | null>(null);
  const [languageEtag, setLanguageEtag] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<UiErrorState | null>(null);

  const isDirtyRef = useRef(false);
  const sequenceRef = useRef(0);
  const actorEpoch = auth?.getActorEpoch?.() ?? api.getActorGeneration?.() ?? 0;
  const actorId = auth?.user?.id ?? api.getCurrentActorId?.() ?? null;
  const authState = auth?.authState;

  const isCurrent = useCallback((epoch: number, operationActorId: string | null) => {
    if (auth?.isCurrentActor && !auth.isCurrentActor(epoch, operationActorId)) return false;
    if (!auth && api.getActorGeneration && api.getActorGeneration() !== epoch) return false;
    if (!auth && api.getCurrentActorId && api.getCurrentActorId() !== operationActorId) return false;
    return true;
  }, [api, auth]);

  useEffect(() => {
    if (!isLive) {
      setIsHydrating(false);
      return;
    }
    if (auth && authState !== 'authenticated') {
      setIsHydrating(false);
      return;
    }

    const seq = ++sequenceRef.current;
    const epoch = actorEpoch;
    const currentActorId = actorId;
    let cancelled = false;
    setIsHydrating(true);

    void (async () => {
      try {
        const actorKey = `${epoch}:${currentActorId ?? 'anonymous'}`;
        const me = await fetchWithActorCache(
          'me',
          actorKey,
          () => api.getMe(),
          30_000,
          api
        );
        if (cancelled || seq !== sequenceRef.current || !isCurrent(epoch, currentActorId)) return;
        const active =
          me.data.languageProfiles.find((item) => item.status === 'active') ??
          me.data.languageProfiles[0];
        if (active) {
          setLanguageProfileId(active.id);
          setLanguageEtag(active.etag);
          if (!isDirtyRef.current) {
            setPersistedDailyMinutes(active.dailyMinutes);
          }
          setPersistedGoal(active.goal);
        }
      } catch {
        // Non-blocking initial settings hydration.
      } finally {
        if (!cancelled && seq === sequenceRef.current) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actorEpoch, actorId, api, auth, authState, isCurrent, isLive]);

  const setDailyMinutes = useCallback((dailyMinutes: number) => {
    isDirtyRef.current = true;
    setPersistedDailyMinutes(dailyMinutes);
  }, []);

  const saveDailyMinutes = useCallback(async (dailyMinutes: number): Promise<boolean> => {
    if (!isLive) {
      return false;
    }
    const seq = ++sequenceRef.current;
    const epoch = actorEpoch;
    const currentActorId = actorId;
    setIsSaving(true);
    setSaveError(null);

    let currentProfileId = languageProfileId;
    let currentEtag = languageEtag;

    // Guard: If languageProfileId or languageEtag is missing, hydrate from getMe() first
    if (!currentProfileId || !currentEtag) {
      try {
        const actorKey = `${epoch}:${currentActorId ?? 'anonymous'}`;
        const me = await fetchWithActorCache(
          'me',
          actorKey,
          () => api.getMe(),
          30_000,
          api
        );
        if (seq !== sequenceRef.current || !isCurrent(epoch, currentActorId)) {
          setIsSaving(false);
          return false;
        }
        const active =
          me.data.languageProfiles.find((item) => item.status === 'active') ??
          me.data.languageProfiles[0];
        if (active) {
          currentProfileId = active.id;
          currentEtag = active.etag;
          setLanguageProfileId(active.id);
          setLanguageEtag(active.etag);
          if (!isDirtyRef.current) {
            setPersistedDailyMinutes(active.dailyMinutes);
          }
          setPersistedGoal(active.goal);
        }
      } catch (cause) {
        if (seq !== sequenceRef.current || !isCurrent(epoch, currentActorId) || isLinguaActorAbortedError(cause)) {
          setIsSaving(false);
          return false;
        }
        setSaveError(mapApiErrorToUi(cause));
        setIsSaving(false);
        return false;
      }
    }

    if (!currentProfileId || !currentEtag) {
      setIsSaving(false);
      return false;
    }

    try {
      const updated = await api.updateMyLanguageProfile({
        languageProfileId: currentProfileId,
        body: { dailyMinutes },
        headers: { 'If-Match': currentEtag },
      });
      if (seq !== sequenceRef.current || !isCurrent(epoch, currentActorId)) return false;
      invalidateActorCacheForClient(api);
      setLanguageEtag(updated.data.etag);
      setPersistedDailyMinutes(updated.data.dailyMinutes);
      setPersistedGoal(updated.data.goal);
      setIsSaving(false);
      return true;
    } catch (cause) {
      if (seq !== sequenceRef.current || !isCurrent(epoch, currentActorId) || isLinguaActorAbortedError(cause)) {
        setIsSaving(false);
        return false;
      }
      setSaveError(mapApiErrorToUi(cause));
      setIsSaving(false);
      return false;
    }
  }, [actorEpoch, actorId, api, isCurrent, isLive, languageEtag, languageProfileId]);

  return {
    isLive,
    isHydrating,
    isSaving,
    persistedDailyMinutes,
    persistedGoal,
    saveError,
    setDailyMinutes,
    saveDailyMinutes,
    saveSettings: saveDailyMinutes,
  };
}
