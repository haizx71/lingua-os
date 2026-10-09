'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  evaluateProductReadiness,
  isLinguaActorAbortedError,
  type ApiClient,
} from '@lingua/types';
import { useAuth } from '../features/auth/AuthContext';
import { getApiClient } from '../lib/api/client';

export type ReadinessStatus = 'loading' | 'unauthenticated' | 'ready' | 'not_ready' | 'error';

export interface ProductReadinessResult {
  readonly status: ReadinessStatus;
  readonly isReady: boolean;
  readonly timeZone: string | null;
  readonly activeLanguageProfileId: string | null;
  readonly error: Error | null;
  refetch(): Promise<void>;
}

interface ReadinessSnapshot extends Omit<ProductReadinessResult, 'refetch'> {
  readonly actorEpoch: number;
  readonly actorId: string | null;
}

interface ActiveReadinessOperation {
  readonly generation: number;
  readonly actorEpoch: number;
  readonly actorId: string | null;
  readonly controller: AbortController;
}

const READINESS_DEADLINE_MS = 45_000;
const READINESS_TIMEOUT_MESSAGE = 'Kiểm tra hồ sơ học tập đã quá thời gian chờ. Vui lòng thử lại.';

function snapshotFor(
  actorEpoch: number,
  actorId: string | null,
  status: ReadinessStatus,
  fields: Partial<Pick<ReadinessSnapshot, 'isReady' | 'timeZone' | 'activeLanguageProfileId' | 'error'>> = {}
): ReadinessSnapshot {
  return {
    actorEpoch,
    actorId,
    status,
    isReady: fields.isReady ?? false,
    timeZone: fields.timeZone ?? null,
    activeLanguageProfileId: fields.activeLanguageProfileId ?? null,
    error: fields.error ?? null,
  };
}

/**
 * Authoritative 6-point product readiness predicate:
 * 1. Resolved authenticated actor session.
 * 2. Valid learner bootstrap/profile with ID.
 * 3. Confirmed valid IANA timezone configured on learner profile.
 * 4. Active vi->en language profile present (status === 'active').
 * 5. Valid persisted goal (must belong to canonical LearningGoal registry).
 * 6. Valid persisted dailyMinutes numeric integer in 5..180 inclusive.
 *
 * Starting level estimate is explicitly OPTIONAL; unestimated learners are fully product-ready.
 */
export function useProductReadiness(customApiClient?: ApiClient, enabled = true): ProductReadinessResult {
  const auth = useAuth();
  const { authState, user, isConfigured, actorEpoch, getActorEpoch, isCurrentActor } = auth;
  const actorId = user?.id ?? null;

  const apiResolution = useMemo(() => {
    if (customApiClient) return { api: customApiClient, error: null as Error | null };
    if (!isConfigured || authState !== 'authenticated') return { api: null, error: null as Error | null };

    try {
      return { api: getApiClient(), error: null as Error | null };
    } catch (error) {
      return {
        api: null,
        error: error instanceof Error ? error : new Error('Live API configuration is incomplete.'),
      };
    }
  }, [authState, customApiClient, isConfigured]);
  const api = apiResolution.api;
  const apiResolutionError = apiResolution.error;

  const [snapshot, setSnapshot] = useState<ReadinessSnapshot>(() => snapshotFor(
    actorEpoch,
    actorId,
    !isConfigured || authState === 'unauthenticated' ? 'unauthenticated' : 'loading'
  ));
  const generationRef = useRef(0);
  const activeOperationRef = useRef<ActiveReadinessOperation | null>(null);

  const cancelActiveOperation = useCallback(() => {
    generationRef.current += 1;
    const activeOperation = activeOperationRef.current;
    activeOperationRef.current = null;
    activeOperation?.controller.abort();
  }, []);

  const checkReadiness = useCallback(async () => {
    cancelActiveOperation();

    if (!enabled) {
      setSnapshot({ ...snapshotFor(actorEpoch, actorId, 'ready'), isReady: true });
      return;
    }

    if (!isConfigured || authState === 'unauthenticated') {
      setSnapshot(snapshotFor(actorEpoch, actorId, 'unauthenticated'));
      return;
    }

    if (authState === 'loading') {
      setSnapshot(snapshotFor(actorEpoch, actorId, 'loading'));
      return;
    }

    if (apiResolutionError || !api) {
      setSnapshot(snapshotFor(
        actorEpoch,
        actorId,
        'error',
        { error: apiResolutionError ?? new Error('Live API configuration is incomplete.') }
      ));
      return;
    }

    const generation = generationRef.current;
    const controller = new AbortController();
    const operation: ActiveReadinessOperation = { generation, actorEpoch, actorId, controller };
    activeOperationRef.current = operation;
    setSnapshot(snapshotFor(actorEpoch, actorId, 'loading'));

    const isLatestOperation = (): boolean => {
      const activeOperation = activeOperationRef.current;
      if (
        activeOperation?.generation !== generation ||
        activeOperation.actorEpoch !== actorEpoch ||
        activeOperation.actorId !== actorId
      ) return false;
      if (isCurrentActor) return isCurrentActor(actorEpoch, actorId);
      return getActorEpoch() === actorEpoch;
    };

    let didTimeout = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new Error(READINESS_TIMEOUT_MESSAGE));
      }, READINESS_DEADLINE_MS);
    });

    const readProfile = (async () => {
      const meResponse = await api.getMe({ signal: controller.signal });
      if (!isLatestOperation() || controller.signal.aborted) return;

      const evaluation = evaluateProductReadiness({
        actorId,
        meProfile: meResponse.data,
        languageProfiles: Array.isArray(meResponse.data.languageProfiles)
          ? meResponse.data.languageProfiles
          : [],
      });
      if (!isLatestOperation() || controller.signal.aborted) return;

      setSnapshot(snapshotFor(
        actorEpoch,
        actorId,
        evaluation.isReady ? 'ready' : 'not_ready',
        {
          isReady: evaluation.isReady,
          timeZone: evaluation.timeZone,
          activeLanguageProfileId: evaluation.activeLanguageProfileId,
        }
      ));
    })();

    try {
      await Promise.race([readProfile, deadline]);
    } catch (err) {
      if (!isLatestOperation()) return;
      if (isCurrentActor && !isCurrentActor(actorEpoch, actorId)) return;
      if (didTimeout) {
        setSnapshot(snapshotFor(actorEpoch, actorId, 'error', { error: new Error(READINESS_TIMEOUT_MESSAGE) }));
      } else if (controller.signal.aborted || isLinguaActorAbortedError(err)) {
        return;
      } else {
        const error = err instanceof Error ? err : new Error('Không thể kiểm tra trạng thái hồ sơ');
        setSnapshot(snapshotFor(actorEpoch, actorId, 'error', { error }));
      }
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      if (activeOperationRef.current?.generation === generation) activeOperationRef.current = null;
    }
  }, [
    actorEpoch,
    actorId,
    api,
    apiResolutionError,
    authState,
    cancelActiveOperation,
    enabled,
    getActorEpoch,
    isConfigured,
    isCurrentActor,
  ]);

  useEffect(() => {
    void checkReadiness();
    return cancelActiveOperation;
  }, [cancelActiveOperation, checkReadiness]);

  const snapshotMatchesCurrentActor = snapshot.actorEpoch === actorEpoch && snapshot.actorId === actorId;
  let visibleSnapshot: ReadinessSnapshot;
  if (!enabled) {
    visibleSnapshot = snapshotFor(actorEpoch, actorId, 'ready', { isReady: true });
  } else if (!isConfigured || authState === 'unauthenticated') {
    visibleSnapshot = snapshotFor(actorEpoch, actorId, 'unauthenticated');
  } else if (authState === 'loading' || !snapshotMatchesCurrentActor) {
    visibleSnapshot = snapshotFor(actorEpoch, actorId, 'loading');
  } else {
    visibleSnapshot = snapshot;
  }

  return {
    status: visibleSnapshot.status,
    isReady: visibleSnapshot.isReady,
    timeZone: visibleSnapshot.timeZone,
    activeLanguageProfileId: visibleSnapshot.activeLanguageProfileId,
    error: visibleSnapshot.error,
    refetch: checkReadiness,
  };
}
