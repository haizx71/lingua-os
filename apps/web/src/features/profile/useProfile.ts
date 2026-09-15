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
import { getApiClient } from '../../lib/api/client';
import { useAuth } from '../auth/AuthContext';

export type ProfileLoadStatus = 'loading' | 'success' | 'empty' | 'error';

export interface UseProfileResult {
  readonly status: ProfileLoadStatus;
  readonly profile: UserProfileViewModel | null;
  readonly error: UiErrorState | null;
  retry(): void;
}

export function useProfile(api: ApiClient = getApiClient()): UseProfileResult {
  const auth = useAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<Omit<UseProfileResult, 'retry'>>({
    status: 'loading',
    profile: null,
    error: null,
  });
  const requestRef = useRef(0);
  const actorId = auth.userIdentity?.id ?? null;
  const actorEpoch = auth.actorEpoch;
  const authState = auth.authState;
  const isCurrentActor = auth.isCurrentActor;

  useEffect(() => {
    const requestId = ++requestRef.current;
    let cancelled = false;
    const current = () =>
      !cancelled
      && requestId === requestRef.current
      && isCurrentActor(actorEpoch, actorId);

    if (authState !== 'authenticated') {
      setState(
        authState === 'loading'
          ? { status: 'loading', profile: null, error: null }
          : {
              status: 'error',
              profile: null,
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

    setState({ status: 'loading', profile: null, error: null });
    void Promise.all([
      api.getMe(),
      api.getBrainSummary(),
      api.getProgressOverview({ window: 'month' }),
    ])
      .then(([me, brain, progress]) => {
        if (!current()) return;
        const activeLanguage =
          me.data.languageProfiles.find((item) => item.status === 'active')
          ?? me.data.languageProfiles[0];
        if (!activeLanguage) {
          setState({ status: 'empty', profile: null, error: null });
          return;
        }
        if (
          brain.data.languageProfileId !== activeLanguage.id
          || progress.data.languageProfileId !== activeLanguage.id
        ) {
          throw new Error('Profile aggregates returned mismatched language profiles');
        }
        setState({
          status: 'success',
          profile: mapProfileToViewModel(me.data, brain.data, progress.data),
          error: null,
        });
      })
      .catch((error) => {
        if (!current() || isLinguaActorAbortedError(error)) return;
        setState({ status: 'error', profile: null, error: mapApiErrorToUi(error) });
      });

    return () => {
      cancelled = true;
      requestRef.current += 1;
    };
  }, [api, actorEpoch, actorId, authState, isCurrentActor, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);
  return { ...state, retry };
}
