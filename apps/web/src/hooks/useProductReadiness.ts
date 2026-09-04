'use client';

import { useCallback, useEffect, useState } from 'react';
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
export function useProductReadiness(customApiClient?: ApiClient): ProductReadinessResult {
  const auth = useAuth();
  const { authState, user, isConfigured, getActorEpoch, isCurrentActor } = auth;
  const api = customApiClient ?? getApiClient();

  const [status, setStatus] = useState<ReadinessStatus>(
    !isConfigured || authState === 'unauthenticated' ? 'unauthenticated' : 'loading'
  );
  const [isReady, setIsReady] = useState(false);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [activeLanguageProfileId, setActiveLanguageProfileId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const checkReadiness = useCallback(async () => {
    const opEpoch = getActorEpoch ? getActorEpoch() : 0;
    const opActorId = user?.id ?? null;

    if (!isConfigured || authState === 'unauthenticated') {
      setStatus('unauthenticated');
      setIsReady(false);
      setTimeZone(null);
      setActiveLanguageProfileId(null);
      setError(null);
      return;
    }

    if (authState === 'loading') {
      setStatus('loading');
      setIsReady(false);
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const meResponse = await api.getMe();
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
      const languagesResponse = await api.listMyLanguageProfiles();
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;

      const evaluation = evaluateProductReadiness({
        actorId: user?.id,
        meProfile: meResponse.data,
        languageProfiles: languagesResponse.data,
      });

      setTimeZone(evaluation.timeZone);
      setActiveLanguageProfileId(evaluation.activeLanguageProfileId);
      setIsReady(evaluation.isReady);
      setStatus(evaluation.isReady ? 'ready' : 'not_ready');
    } catch (err) {
      if (isCurrentActor && !isCurrentActor(opEpoch, opActorId)) return;
      if (isLinguaActorAbortedError(err)) {
        // Silently discard obsolete response from prior actor lifecycle (DEF-03 / ACTOR-STATE-001)
        return;
      }
      const errObj = err instanceof Error ? err : new Error('Không thể kiểm tra trạng thái hồ sơ');
      setError(errObj);
      setStatus('error');
      setIsReady(false);
    }
  }, [api, authState, isConfigured, user?.id, getActorEpoch, isCurrentActor]);

  useEffect(() => {
    void checkReadiness();
  }, [checkReadiness, user?.id]);

  return {
    status,
    isReady,
    timeZone,
    activeLanguageProfileId,
    error,
    refetch: checkReadiness,
  };
}
