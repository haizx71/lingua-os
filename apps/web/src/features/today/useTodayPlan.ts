'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  isValidIanaTimeZone,
  type ApiClient,
  type OperationQuery,
  type TodayPlanDto,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { getApiClient } from '../../lib/api/client';
import { invalidateActorCacheForClient } from '../../lib/api/queryCache';
import {
  mapTodayPlanToViewModel,
  type TodayPlanViewModel,
} from './adapters';

export interface UseTodayPlanOptions {
  readonly apiClient?: ApiClient;
  readonly initialPlan?: TodayPlanViewModel | TodayPlanDto;
  readonly query?: OperationQuery<'getTodayPlan'>;
  readonly skipInitialFetch?: boolean;
}

export interface TodayPlanState {
  readonly plan: TodayPlanViewModel | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly isSetupRequired: boolean;
  readonly timeZone: string | null;
  readonly completingActivityIds: ReadonlySet<string>;
  readonly isCompleting: (activityId: string) => boolean;
  readonly completeActivity: (activityId: string, durationSeconds?: number) => Promise<void>;
  readonly actionError: Error | null;
  readonly clearActionError: () => void;
  readonly alertMessage: string | null;
  readonly clearAlertMessage: () => void;
  readonly refetch: () => Promise<void>;
}

export function useTodayPlan({
  apiClient: customApiClient,
  initialPlan,
  query,
  skipInitialFetch = false,
}: UseTodayPlanOptions = {}): TodayPlanState {
  const authContext = useOptionalAuth();
  const authState = authContext?.authState ?? 'unauthenticated';
  const user = authContext?.user ?? null;
  const isConfigured = authContext?.isConfigured ?? false;
  const getActorEpoch = authContext?.getActorEpoch;
  const isCurrentActor = authContext?.isCurrentActor;
  const api = customApiClient ?? getApiClient();

  const [plan, setPlan] = useState<TodayPlanViewModel | null>(() => {
    if (!initialPlan) return null;
    if ('progressPercent' in initialPlan) return initialPlan;
    return mapTodayPlanToViewModel(initialPlan);
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (initialPlan || skipInitialFetch) return false;
    // Live loading state when configured or when custom client is explicitly provided
    if (isConfigured && authState === 'authenticated') return true;
    if (customApiClient) return true;
    return false;
  });
  const [error, setError] = useState<Error | null>(null);
  const [completingActivityIds, setCompletingActivityIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [actionError, setActionError] = useState<Error | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [activeTimeZone, setActiveTimeZone] = useState<string | null>(() => {
    if (initialPlan && 'timeZone' in initialPlan && isValidIanaTimeZone(initialPlan.timeZone)) {
      return initialPlan.timeZone;
    }
    return null;
  });

  const sequenceRef = useRef(0);
  const prevActorIdRef = useRef<string | null>(null);

  const queryLanguageProfileId = query?.languageProfileId;
  const queryDate = query?.date;
  const normalizedQuery = useMemo<OperationQuery<'getTodayPlan'> | undefined>(() => {
    if (!queryLanguageProfileId && !queryDate) return undefined;
    return {
      ...(queryLanguageProfileId ? { languageProfileId: queryLanguageProfileId } : {}),
      ...(queryDate ? { date: queryDate } : {}),
    };
  }, [queryLanguageProfileId, queryDate]);

  // ACTOR LIFECYCLE: Reset state cleanly only when a genuine actor transition occurs
  useEffect(() => {
    const currentActorId = user?.id ?? null;
    if (prevActorIdRef.current !== null && prevActorIdRef.current !== currentActorId) {
      setPlan(null);
      setError(null);
      setActionError(null);
      setAlertMessage(null);
      setIsSetupRequired(false);
      setActiveTimeZone(null);
      setCompletingActivityIds(new Set());
      // Invalidate all pending in-flight requests from prior actor
      sequenceRef.current++;
    }
    prevActorIdRef.current = currentActorId;
  }, [user?.id]);

  // Load authoritative Today plan from backend
  const loadPlan = useCallback(async () => {
    const shouldFetch =
      (isConfigured && authState === 'authenticated') ||
      (!isConfigured && Boolean(customApiClient));

    if (!shouldFetch) {
      if (authState !== 'loading') {
        setIsLoading(false);
      }
      return;
    }

    const opEpoch = getActorEpoch ? getActorEpoch() : 0;
    const opActorId = user?.id ?? null;
    const seq = ++sequenceRef.current;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Authoritative timezone resolution from persisted profile
      let effectiveTz: string | null = null;

      // Retrieve authoritative learner profile from backend
      const meResponse = await api.getMe();
      if (seq !== sequenceRef.current) return;
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

      const storedTz = meResponse.data?.timeZone?.trim() || null;
      if (storedTz && isValidIanaTimeZone(storedTz)) {
        effectiveTz = storedTz;
      }

      // 2. Missing timezone guard: FAIL CLOSED
      // Today planning day boundaries belong to backend + persisted learner timezone semantics.
      // MUST NOT call getTodayPlan without a valid persisted profile timezone.
      if (!effectiveTz) {
        if (seq !== sequenceRef.current) return;
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

        setIsLoading(false);
        setIsSetupRequired(true);
        setActiveTimeZone(null);
        setPlan(null);
        setError(null);
        return;
      }

      // 3. Stored authoritative timezone confirmed
      setIsSetupRequired(false);
      setActiveTimeZone(effectiveTz);

      // Backend reads persisted profile timezone according to frozen contract.
      // Query contains only contract-valid fields (languageProfileId?, date?).
      const response = await api.getTodayPlan(normalizedQuery);

      // Guard: Stale same-actor requests must not overwrite newer requests
      if (seq !== sequenceRef.current) return;
      // Guard: Stale actor requests must not mutate active actor state
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

      // Server-authoritative plan projection
      setPlan(mapTodayPlanToViewModel(response.data));
      setIsLoading(false);
    } catch (err) {
      if (seq !== sequenceRef.current) return;
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
      if (isLinguaActorAbortedError(err)) {
        // Silently discard aborted operations across actor boundaries
        return;
      }

      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      setIsLoading(false);
    }
  }, [
    api,
    authState,
    isConfigured,
    user?.id,
    getActorEpoch,
    isCurrentActor,
    normalizedQuery,
    customApiClient,
  ]);

  useEffect(() => {
    if (!skipInitialFetch) {
      void loadPlan();
    }
  }, [loadPlan, skipInitialFetch]);

  // Complete an owned activity via POST /v1/today/{planId}/activities/{activityId}/complete
  const completeActivity = useCallback(
    async (activityId: string, durationSeconds?: number) => {
      if (!plan) return;
      const currentPlanId = plan.id;

      // Prevent duplicate in-flight completion for the same activity
      if (completingActivityIds.has(activityId)) return;

      const opEpoch = getActorEpoch ? getActorEpoch() : 0;
      const opActorId = user?.id ?? null;

      setCompletingActivityIds((prev) => new Set(prev).add(activityId));
      setActionError(null);

      try {
        const idempotencyKey =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-000000000001';

        const response = await api.completeTodayActivity({
          planId: currentPlanId,
          activityId,
          body: durationSeconds !== undefined ? { durationSeconds } : {},
          headers: { 'Idempotency-Key': idempotencyKey },
        });

        // Guard: Stale actor completion response must not mutate new actor state
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

        // Authoritative update strictly from server response
        invalidateActorCacheForClient(api);
        setPlan(mapTodayPlanToViewModel(response.data.plan));
        setAlertMessage(`Đã hoàn thành hoạt động: ${response.data.activity.title}`);
      } catch (err) {
        if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
        if (isLinguaActorAbortedError(err)) return;

        // On failure: Retain current server state without fake completion
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setActionError(errorObj);
      } finally {
        if (!isCurrentActor || isCurrentActor(opEpoch, opActorId)) {
          setCompletingActivityIds((prev) => {
            const next = new Set(prev);
            next.delete(activityId);
            return next;
          });
        }
      }
    },
    [api, plan, completingActivityIds, user?.id, getActorEpoch, isCurrentActor]
  );

  const isCompleting = useCallback(
    (activityId: string) => completingActivityIds.has(activityId),
    [completingActivityIds]
  );

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  const clearAlertMessage = useCallback(() => {
    setAlertMessage(null);
  }, []);

  return {
    plan,
    isLoading,
    error,
    isSetupRequired,
    timeZone: activeTimeZone,
    completingActivityIds,
    isCompleting,
    completeActivity,
    actionError,
    clearActionError,
    alertMessage,
    clearAlertMessage,
    refetch: loadPlan,
  };
}
