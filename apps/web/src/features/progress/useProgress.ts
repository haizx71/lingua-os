'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isLinguaActorAbortedError,
  mapApiErrorToUi,
  mapProgressToViewModel,
  type ApiClient,
  type ProgressSummaryViewModel,
  type UiErrorState,
} from '@lingua/types';
import { getApiClient } from '../../lib/api/client';
import { useAuth } from '../auth/AuthContext';

export type ProgressWindow = '7d' | '30d';
export type ProgressLoadStatus = 'loading' | 'success' | 'empty' | 'error';

export interface UseProgressResult {
  readonly status: ProgressLoadStatus;
  readonly data: ProgressSummaryViewModel | null;
  readonly error: UiErrorState | null;
  readonly window: ProgressWindow;
  setWindow(window: ProgressWindow): void;
  retry(): void;
}

export function useProgress(api: ApiClient = getApiClient()): UseProgressResult {
  const auth = useAuth();
  const [window, setWindow] = useState<ProgressWindow>('7d');
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<Pick<UseProgressResult, 'status' | 'data' | 'error'>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const requestRef = useRef(0);

  const actorId = auth.userIdentity?.id ?? null;
  const actorEpoch = auth.actorEpoch;
  const query = useMemo(
    () => ({ window: window === '7d' ? ('week' as const) : ('month' as const) }),
    [window]
  );

  useEffect(() => {
    const requestId = ++requestRef.current;
    let cancelled = false;
    const current = () =>
      !cancelled
      && requestId === requestRef.current
      && auth.isCurrentActor(actorEpoch, actorId);

    if (auth.authState !== 'authenticated') {
      setState(
        auth.authState === 'loading'
          ? { status: 'loading', data: null, error: null }
          : {
              status: 'error',
              data: null,
              error: {
                code: 'UNAUTHENTICATED',
                message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
                retryable: false,
              },
            }
      );
      return () => {
        cancelled = true;
      };
    }

    setState({ status: 'loading', data: null, error: null });
    void api
      .getProgressOverview(query)
      .then((response) => {
        if (!current()) return;
        const data = mapProgressToViewModel(response.data);
        const hasEvidence =
          data.totalStudyMinutes > 0
          || data.newWordsAcquired > 0
          || data.wordsSolidified > 0
          || data.activeDaysCount > 0
          || data.history7d.some((point) => point.retentionPercent > 0);
        setState({ status: hasEvidence ? 'success' : 'empty', data, error: null });
      })
      .catch((error) => {
        if (!current() || isLinguaActorAbortedError(error)) return;
        setState({ status: 'error', data: null, error: mapApiErrorToUi(error) });
      });

    return () => {
      cancelled = true;
      requestRef.current += 1;
    };
  }, [api, auth, actorEpoch, actorId, query, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  return {
    ...state,
    window,
    setWindow,
    retry,
  };
}
