'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Button, InlineAlert, LoadingState } from '@lingua/ui';
import {
  isLanguageProfileReady,
  isLinguaActorAbortedError,
  isValidIanaTimeZone,
  mapApiErrorToUi,
  mapOnboardingAssessmentToViewModel,
  mapOnboardingLanguageProfileToViewModel,
  mapOnboardingProfileToViewModel,
  type ApiClient,
  type OnboardingAssessmentViewModel,
  type OnboardingLanguageProfileViewModel,
  type LearningGoal,
} from '@lingua/types';
import { getApiClient } from '../../lib/api/client';
import { useAuth } from '../auth/AuthContext';

export type OnboardingStage =
  | 'RESTORING_SESSION'
  | 'BOOTSTRAPPING_PROFILE'
  | 'PROFILE_REQUIRED'
  | 'LANGUAGE_PROFILE_REQUIRED'
  | 'ASSESSMENT_CHOICE'
  | 'ASSESSMENT_IN_PROGRESS'
  | 'ASSESSMENT_COMPLETE'
  | 'READY_FOR_TODAY';

export interface LiveOnboardingFlowProps {
  readonly apiClient?: ApiClient;
  readonly navigate?: (path: string) => void;
}

const learningGoals: readonly { value: LearningGoal; label: string }[] = [
  { value: 'communication', label: 'Giao tiếp' },
  { value: 'work', label: 'Công việc' },
  { value: 'travel', label: 'Du lịch' },
  { value: 'basics', label: 'Nền tảng' },
  { value: 'academic', label: 'Học thuật' },
];
const dailyMinuteChoices = [10, 20, 25, 30, 45] as const;

function detectBrowserTimeZone(): string {
  try {
    const candidate = typeof Intl === 'undefined' ? '' : Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidIanaTimeZone(candidate) ? candidate.trim() : '';
  } catch {
    return '';
  }
}

function supportedTimeZones(): string[] {
  try {
    const intlWithTimeZoneValues = Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    };
    return intlWithTimeZoneValues.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

function makeActionKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  throw new Error('Trình duyệt không hỗ trợ mã idempotency an toàn.');
}

function isUsableEnglishProfile(profile: OnboardingLanguageProfileViewModel): boolean {
  return isLanguageProfileReady(profile);
}

function etagFor(api: ApiClient, key: string): string | undefined {
  const getter = (api as ApiClient & { getLastEtag?: (resourceKey: string) => string | undefined }).getLastEtag;
  return getter?.call(api, key);
}

function makeAssessmentStorageKey(userId?: string | null): string {
  return userId ? `lingua:starting-level:active-assessment:${userId}` : 'lingua:starting-level:active-assessment';
}

/** Local storage is only a non-authoritative pointer used to resume a server session. */
function storedAssessmentId(userId?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(makeAssessmentStorageKey(userId));
  } catch {
    return null;
  }
}

function rememberAssessmentId(id: string, userId?: string | null): void {
  try {
    window.localStorage.setItem(makeAssessmentStorageKey(userId), id);
  } catch {
    // A storage restriction must not prevent the server-owned assessment flow.
  }
}

function forgetAssessmentId(userId?: string | null): void {
  try {
    window.localStorage.removeItem(makeAssessmentStorageKey(userId));
  } catch {
    // A storage restriction must not prevent the server-owned assessment flow.
  }
}

function TimeZoneSetupField({
  timeZone,
  detectedAutomatically,
  onChange,
  onRetryDetection,
}: {
  readonly timeZone: string;
  readonly detectedAutomatically: boolean;
  readonly onChange: (value: string) => void;
  readonly onRetryDetection: () => void;
}) {
  const options = useMemo(supportedTimeZones, []);

  if (detectedAutomatically) {
    return (
      <p role="status" className="text-sm text-[var(--text-secondary)]" data-testid="detected-timezone">
        Múi giờ thiết bị được nhận diện tự động: <strong>{timeZone}</strong>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="time-zone" className="text-sm font-medium">Múi giờ</label>
      {options.length > 0 ? (
        <select
          id="time-zone"
          value={timeZone}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-3"
        >
          <option value="">Chọn múi giờ</option>
          {timeZone && !options.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input
          id="time-zone"
          value={timeZone}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-3"
          autoComplete="off"
        />
      )}
      <Button type="button" variant="outline" onClick={onRetryDetection}>
        Thử nhận diện lại
      </Button>
    </div>
  );
}

function AssessmentAudioPlayer({ src }: { readonly src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setAudioError(null);
    if (audioRef.current) {
      try {
        audioRef.current.pause?.();
      } catch {
        // Safe for test environments without HTMLMediaElement implementation
      }
      try {
        audioRef.current.currentTime = 0;
      } catch {
        // Safe for test environments
      }
    }
  }, [src]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      try {
        el.pause?.();
      } catch {
        // Safe for test environments
      }
      setIsPlaying(false);
    } else {
      try {
        const result = el.play?.();
        if (result !== undefined && typeof result.then === 'function') {
          setIsPlaying(true);
          result.catch(() => {
              setAudioError('Không thể phát âm thanh. Vui lòng kiểm tra kết nối mạng.');
              setIsPlaying(false);
            });
        } else {
          setIsPlaying(true);
        }
      } catch {
        setAudioError('Không thể phát âm thanh. Vui lòng kiểm tra kết nối mạng.');
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="space-y-2" data-testid="assessment-audio-player">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setIsPlaying(false)}
        onError={() => setAudioError('Không thể tải đoạn âm thanh.')}
        preload="metadata"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Tạm dừng đoạn âm thanh bài nghe' : 'Phát đoạn âm thanh bài nghe'}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        >
          <span aria-hidden="true">{isPlaying ? '⏸' : '▶'}</span>
          <span>{isPlaying ? 'Tạm dừng âm thanh' : 'Phát âm thanh bài nghe'}</span>
        </button>
      </div>
      {audioError && (
        <InlineAlert variant="warning" title="Âm thanh chưa sẵn sàng">
          {audioError}
        </InlineAlert>
      )}
    </div>
  );
}

export function LiveOnboardingFlow({ apiClient, navigate }: LiveOnboardingFlowProps) {
  const auth = useAuth();
  const { authState, user, getActorEpoch, isCurrentActor } = auth;
  const userId = user?.id ?? null;
  const api = useMemo(() => apiClient ?? getApiClient(), [apiClient]);
  const [stage, setStage] = useState<OnboardingStage>('RESTORING_SESSION');
  const [languageProfile, setLanguageProfile] = useState<OnboardingLanguageProfileViewModel | null>(null);
  const [archivedLanguageProfile, setArchivedLanguageProfile] = useState<OnboardingLanguageProfileViewModel | null>(null);
  const [pausedLanguageProfile, setPausedLanguageProfile] = useState<OnboardingLanguageProfileViewModel | null>(null);
  const [timeZone, setTimeZone] = useState('');
  const [timeZoneNeedsPersistence, setTimeZoneNeedsPersistence] = useState(false);
  const [timeZoneDetectedAutomatically, setTimeZoneDetectedAutomatically] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(null);
  const [assessment, setAssessment] = useState<OnboardingAssessmentViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const languageProfileCreateKey = useRef<string | null>(null);
  const assessmentStartKey = useRef<string | null>(null);
  const assessmentAnswerKeys = useRef(new Map<string, string>());
  const profileSetupMutationInFlight = useRef(false);

  const beginActorOperation = () => {
    const epoch = getActorEpoch ? getActorEpoch() : 0;
    const actorId = user?.id ?? null;
    return {
      isCurrent: () => (isCurrentActor ? isCurrentActor(epoch, actorId) : true),
      epoch,
      actorId,
    };
  };

  const goToday = () => {
    setStage('READY_FOR_TODAY');
    if (navigate) navigate('/today');
    else if (typeof window !== 'undefined') window.location.assign('/today');
  };

  const loadBootstrap = async () => {
    const op = beginActorOperation();
    setError(null);
    setStage('BOOTSTRAPPING_PROFILE');
    try {
      const meResponse = await api.getMe();
      if (!op.isCurrent()) return false;
      const profile = mapOnboardingProfileToViewModel(meResponse.data);
      const languages = await api.listMyLanguageProfiles();
      if (!op.isCurrent()) return false;
      const profiles = languages.data.map(mapOnboardingLanguageProfileToViewModel);
      const usable = profiles.find(isUsableEnglishProfile) ?? null;
      const paused = profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'paused') ?? null;
      const archived = profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'archived') ?? null;
      setDisplayName(profile.displayName ?? '');
      const hasValidStoredTimeZone = isValidIanaTimeZone(meResponse.data.timeZone);
      const detectedTimeZone = hasValidStoredTimeZone ? '' : detectBrowserTimeZone();
      setTimeZone(hasValidStoredTimeZone ? (meResponse.data.timeZone ?? '') : detectedTimeZone);
      setTimeZoneNeedsPersistence(!hasValidStoredTimeZone);
      setTimeZoneDetectedAutomatically(!hasValidStoredTimeZone && Boolean(detectedTimeZone));
      setLanguageProfile(usable);
      setPausedLanguageProfile(paused);
      setArchivedLanguageProfile(archived);
      if (!hasValidStoredTimeZone && (usable || paused || archived)) {
        setStage('PROFILE_REQUIRED');
      } else if (paused) {
        setStage('LANGUAGE_PROFILE_REQUIRED');
      } else if (archived && !usable) {
        setStage('LANGUAGE_PROFILE_REQUIRED');
      } else if (!usable) {
        setStage('LANGUAGE_PROFILE_REQUIRED');
      } else if (usable.startingLevelEstimate) {
        setStage('READY_FOR_TODAY');
      } else {
        const assessmentId = storedAssessmentId(op.actorId);
        const hasAssessmentIntent =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('mode') === 'assessment';
        if (!assessmentId) {
          setStage(hasAssessmentIntent ? 'ASSESSMENT_CHOICE' : 'READY_FOR_TODAY');
        } else {
          try {
            const resumedRes = await api.getStartingLevelAssessment(assessmentId);
            if (!op.isCurrent()) return false;
            const resumed = mapOnboardingAssessmentToViewModel(resumedRes.data);
            setAssessment(resumed);
            if (resumed.status === 'completed' || resumed.status === 'abandoned') {
              forgetAssessmentId(op.actorId);
              setStage('ASSESSMENT_COMPLETE');
            } else {
              setStage('ASSESSMENT_IN_PROGRESS');
            }
          } catch (cause) {
            if (!op.isCurrent()) return false;
            const mapped = mapApiErrorToUi(cause);
            if (mapped.code === 'NOT_FOUND') {
              forgetAssessmentId(op.actorId);
              setStage(hasAssessmentIntent ? 'ASSESSMENT_CHOICE' : 'READY_FOR_TODAY');
            } else {
              throw cause;
            }
          }
        }
      }
      return true;
    } catch (cause) {
      if (!op.isCurrent() || isLinguaActorAbortedError(cause)) {
        return false;
      }
      setError(mapApiErrorToUi(cause).message);
      setStage('BOOTSTRAPPING_PROFILE');
      return false;
    }
  };

  useEffect(() => {
    languageProfileCreateKey.current = null;
    assessmentStartKey.current = null;
    assessmentAnswerKeys.current.clear();
    profileSetupMutationInFlight.current = false;
    if (authState === 'authenticated') {
      setLanguageProfile(null);
      setPausedLanguageProfile(null);
      setArchivedLanguageProfile(null);
      setAssessment(null);
      setDisplayName('');
      setTimeZone('');
      setGoal(null);
      setDailyMinutes(null);
      setError(null);
      setBusy(false);
      setTimeZoneNeedsPersistence(false);
      setTimeZoneDetectedAutomatically(false);
      void loadBootstrap();
    } else if (authState === 'unauthenticated') {
      setStage('RESTORING_SESSION');
      setLanguageProfile(null);
      setPausedLanguageProfile(null);
      setArchivedLanguageProfile(null);
      setAssessment(null);
      setDisplayName('');
      setTimeZone('');
      setGoal(null);
      setDailyMinutes(null);
      setError(null);
      setBusy(false);
      setTimeZoneNeedsPersistence(false);
      setTimeZoneDetectedAutomatically(false);
    }
  }, [authState, userId]);

  const persistTimeZoneIfNeeded = async (op: ReturnType<typeof beginActorOperation>): Promise<boolean> => {
    if (!timeZoneNeedsPersistence) return true;
    const normalizedTimeZone = timeZone.trim();
    if (!isValidIanaTimeZone(normalizedTimeZone)) {
      setError('Không nhận diện được múi giờ thiết bị. Hãy chọn múi giờ của bạn rồi thử lại.');
      return false;
    }
    const etag = etagFor(api, 'me');
    if (!etag) {
      setError('Phiên hồ sơ đã cũ. Hãy tải lại để nhận phiên bản mới trước khi lưu.');
      return false;
    }
    const response = await api.updateMe({
      body: { timeZone: normalizedTimeZone, ...(displayName.trim() ? { displayName: displayName.trim() } : {}) },
      headers: { 'If-Match': etag },
    });
    if (!op.isCurrent()) return false;
    if (!isValidIanaTimeZone(response.data.timeZone)) {
      setError('Máy chủ chưa xác nhận được múi giờ hợp lệ. Hãy tải lại hồ sơ rồi thử lại.');
      return false;
    }
    setTimeZone(response.data.timeZone ?? '');
    setDisplayName(response.data.displayName ?? '');
    setTimeZoneNeedsPersistence(false);
    setTimeZoneDetectedAutomatically(false);
    return true;
  };

  const retryTimeZoneDetection = () => {
    const detected = detectBrowserTimeZone();
    if (!detected) {
      setTimeZoneDetectedAutomatically(false);
      setError('Không thể nhận diện múi giờ trên thiết bị này. Hãy chọn múi giờ thủ công để tiếp tục.');
      return;
    }
    setTimeZone(detected);
    setTimeZoneDetectedAutomatically(true);
    setError(null);
  };

  const updateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || profileSetupMutationInFlight.current) return;
    profileSetupMutationInFlight.current = true;
    const op = beginActorOperation();
    setBusy(true);
    setError(null);
    try {
      if (!(await persistTimeZoneIfNeeded(op))) return;
      if (!op.isCurrent()) return;
      const languages = await api.listMyLanguageProfiles();
      if (!op.isCurrent()) return;
      const profiles = languages.data.map(mapOnboardingLanguageProfileToViewModel);
      const active = profiles.find(isUsableEnglishProfile) ?? null;
      const paused = profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'paused') ?? null;
      const archived = profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'archived') ?? null;
      setLanguageProfile(active);
      setPausedLanguageProfile(paused);
      setArchivedLanguageProfile(archived);
      if (paused) setStage('LANGUAGE_PROFILE_REQUIRED');
      else if (archived && !active) setStage('LANGUAGE_PROFILE_REQUIRED');
      else if (!active) setStage('LANGUAGE_PROFILE_REQUIRED');
      else if (active.startingLevelEstimate) setStage('READY_FOR_TODAY');
      else setStage('ASSESSMENT_CHOICE');
    } catch (cause) {
      if (!op.isCurrent() || isLinguaActorAbortedError(cause)) return;
      const mapped = mapApiErrorToUi(cause);
      setError(mapped.code === 'PRECONDITION_FAILED' ? 'Hồ sơ vừa thay đổi. Đã tải lại dữ liệu mới; hãy xác nhận lại rồi lưu.' : mapped.message);
      if (mapped.code === 'PRECONDITION_FAILED') {
        const refreshed = await loadBootstrap();
        if (!op.isCurrent()) return;
        if (refreshed) {
          setError('Hồ sơ vừa thay đổi. Đã tải dữ liệu mới; hãy kiểm tra lại rồi thực hiện một lần lưu có chủ ý.');
        }
      }
    } finally {
      if (op.isCurrent()) {
        setBusy(false);
        profileSetupMutationInFlight.current = false;
      }
    }
  };

  const createLanguageProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || profileSetupMutationInFlight.current) return;
    const op = beginActorOperation();
    if (!goal || dailyMinutes === null) {
      setError('Hãy chọn mục tiêu và thời lượng học trước khi tạo hồ sơ.');
      return;
    }
    profileSetupMutationInFlight.current = true;
    setBusy(true);
    setError(null);
    const timezoneWasPendingAtStart = timeZoneNeedsPersistence;
    try {
      if (!(await persistTimeZoneIfNeeded(op))) return;
      if (!op.isCurrent()) return;
      const response = await api.createMyLanguageProfile({
        body: { nativeLanguageCode: 'vi', targetLanguageCode: 'en', goal, dailyMinutes },
        headers: { 'Idempotency-Key': languageProfileCreateKey.current ?? (languageProfileCreateKey.current = makeActionKey()) },
      });
      if (!op.isCurrent()) return;
      const createdProfile = mapOnboardingLanguageProfileToViewModel(response.data);
      setLanguageProfile(createdProfile);
      setArchivedLanguageProfile(null);
      setStage(createdProfile.startingLevelEstimate ? 'READY_FOR_TODAY' : 'ASSESSMENT_CHOICE');
    } catch (cause) {
      if (!op.isCurrent() || isLinguaActorAbortedError(cause)) return;
      const mapped = mapApiErrorToUi(cause);
      if (mapped.code === 'PRECONDITION_FAILED' && timezoneWasPendingAtStart) {
        const refreshed = await loadBootstrap();
        if (!op.isCurrent()) return;
        setError(refreshed
          ? 'Hồ sơ vừa thay đổi. Đã tải dữ liệu mới; hãy kiểm tra lại rồi tiếp tục thiết lập.'
          : 'Hồ sơ vừa thay đổi. Hãy tải lại để nhận dữ liệu mới trước khi tiếp tục.');
        return;
      }
      if (mapped.code === 'CONFLICT') {
        try {
          const languages = await api.listMyLanguageProfiles();
          if (!op.isCurrent()) return;
          const profiles = languages.data.map(mapOnboardingLanguageProfileToViewModel);
          const active = profiles.find(isUsableEnglishProfile) ?? null;
          const paused = profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'paused') ?? null;
          const archived = profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'archived') ?? null;
          if (active) {
            setLanguageProfile(active);
            setPausedLanguageProfile(null);
            setArchivedLanguageProfile(null);
            setStage(active.startingLevelEstimate ? 'READY_FOR_TODAY' : 'ASSESSMENT_CHOICE');
            return;
          }
          if (paused) {
            setPausedLanguageProfile(paused);
            setArchivedLanguageProfile(null);
            setStage('LANGUAGE_PROFILE_REQUIRED');
            return;
          }
          if (archived) {
            setArchivedLanguageProfile(archived);
            setPausedLanguageProfile(null);
            setStage('LANGUAGE_PROFILE_REQUIRED');
            return;
          }
        } catch {
          // If profile discovery fails, fall through to error display
        }
      }
      if (!op.isCurrent()) return;
      setError(mapped.message);
    } finally {
      if (op.isCurrent()) {
        setBusy(false);
        profileSetupMutationInFlight.current = false;
      }
    }
  };

  const resumePausedProfile = async () => {
    if (!pausedLanguageProfile || busy) return;
    const op = beginActorOperation();
    const etag = pausedLanguageProfile.etag;
    if (!etag) {
      setError('Hồ sơ tiếng Anh đang tạm dừng nhưng phiên bản ETag để tiếp tục chưa có trong phản hồi. Không tạo hồ sơ thứ hai.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.updateMyLanguageProfile({
        languageProfileId: pausedLanguageProfile.id,
        body: { status: 'active' },
        headers: { 'If-Match': etag },
      });
      if (!op.isCurrent()) return;
      const restored = mapOnboardingLanguageProfileToViewModel(response.data);
      setLanguageProfile(restored);
      setPausedLanguageProfile(null);
      setArchivedLanguageProfile(null);
      setStage(restored.startingLevelEstimate ? 'READY_FOR_TODAY' : 'ASSESSMENT_CHOICE');
    } catch (cause) {
      if (!op.isCurrent() || isLinguaActorAbortedError(cause)) return;
      const mapped = mapApiErrorToUi(cause);
      if (mapped.code === 'PRECONDITION_FAILED') {
        // Discard the stale child token. Refetch only; never retry the mutation.
        setPausedLanguageProfile(null);
        const refreshed = await loadBootstrap();
        if (!op.isCurrent()) return;
        if (refreshed) {
          setError('Hồ sơ vừa thay đổi. Đã tải dữ liệu mới; hãy kiểm tra lại rồi tiếp tục nếu vẫn cần.');
        }
      } else {
        setError(mapped.message);
      }
    } finally {
      if (op.isCurrent()) {
        setBusy(false);
      }
    }
  };

  const reactivateArchivedProfile = async () => {
    if (!archivedLanguageProfile || busy) return;
    const op = beginActorOperation();
    const etag = archivedLanguageProfile.etag;
    if (!etag) {
      setError('Hồ sơ tiếng Anh đã được lưu trữ nhưng phiên bản ETag để khôi phục chưa có trong phản hồi. Không tạo hồ sơ thứ hai.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.updateMyLanguageProfile({
        languageProfileId: archivedLanguageProfile.id,
        body: { status: 'active' },
        headers: { 'If-Match': etag },
      });
      if (!op.isCurrent()) return;
      const restored = mapOnboardingLanguageProfileToViewModel(response.data);
      setLanguageProfile(restored);
      setPausedLanguageProfile(null);
      setArchivedLanguageProfile(null);
      setStage(restored.startingLevelEstimate ? 'READY_FOR_TODAY' : 'ASSESSMENT_CHOICE');
    } catch (cause) {
      if (!op.isCurrent() || isLinguaActorAbortedError(cause)) return;
      const mapped = mapApiErrorToUi(cause);
      if (mapped.code === 'PRECONDITION_FAILED') {
        // Discard the stale child token. Refetch only; never retry the mutation.
        setArchivedLanguageProfile(null);
        const refreshed = await loadBootstrap();
        if (!op.isCurrent()) return;
        if (refreshed) {
          setError('Hồ sơ vừa thay đổi. Đã tải dữ liệu mới; hãy kiểm tra lại rồi khôi phục nếu vẫn cần.');
        }
      } else {
        setError(mapped.message);
      }
    } finally {
      if (op.isCurrent()) {
        setBusy(false);
      }
    }
  };

  const startAssessment = async () => {
    if (!languageProfile) return;
    const op = beginActorOperation();
    setBusy(true);
    setError(null);
    try {
      const key = assessmentStartKey.current ?? (assessmentStartKey.current = makeActionKey());
      const response = await api.startStartingLevelAssessment({
        body: { languageProfileId: languageProfile.id },
        headers: { 'Idempotency-Key': key },
      });
      if (!op.isCurrent()) return;
      const startedAssessment = mapOnboardingAssessmentToViewModel(response.data);
      setAssessment(startedAssessment);
      if (startedAssessment.status === 'completed' || startedAssessment.status === 'abandoned') {
        forgetAssessmentId(op.actorId);
        setStage('ASSESSMENT_COMPLETE');
      } else {
        rememberAssessmentId(startedAssessment.id, op.actorId);
        setStage('ASSESSMENT_IN_PROGRESS');
      }
    } catch (cause) {
      if (!op.isCurrent() || isLinguaActorAbortedError(cause)) return;
      setError(mapApiErrorToUi(cause).message);
    } finally {
      if (op.isCurrent()) {
        setBusy(false);
      }
    }
  };

  const submitAnswer = async (selectedOptionId?: string) => {
    if (!assessment?.currentItem) return;
    const op = beginActorOperation();
    const key = assessmentAnswerKeys.current.get(assessment.currentItem.id) ?? makeActionKey();
    assessmentAnswerKeys.current.set(assessment.currentItem.id, key);
    setBusy(true);
    setError(null);
    try {
      const response = await api.submitStartingLevelResponse({
        assessmentId: assessment.id,
        body: selectedOptionId
          ? { itemId: assessment.currentItem.id, selectedOptionId, responseTimeMs: 0 }
          : { itemId: assessment.currentItem.id, skipped: true, responseTimeMs: 0 },
        headers: { 'Idempotency-Key': key },
      });
      if (!op.isCurrent()) return;
      const submittedAssessment = mapOnboardingAssessmentToViewModel(response.data);
      setAssessment(submittedAssessment);
      if (submittedAssessment.status === 'completed' || submittedAssessment.status === 'abandoned') {
        forgetAssessmentId(op.actorId);
        setStage('ASSESSMENT_COMPLETE');
      } else {
        rememberAssessmentId(submittedAssessment.id, op.actorId);
        setStage('ASSESSMENT_IN_PROGRESS');
      }
    } catch (cause) {
      if (!op.isCurrent() || isLinguaActorAbortedError(cause)) return;
      setError(mapApiErrorToUi(cause).message);
    } finally {
      if (op.isCurrent()) {
        setBusy(false);
      }
    }
  };

  const showBlockingError = error !== null && (stage === 'BOOTSTRAPPING_PROFILE' || stage === 'RESTORING_SESSION');
  if (authState !== 'authenticated') return <InlineAlert variant="info" title="Cần đăng nhập">Hãy đăng nhập để bắt đầu thiết lập lộ trình.</InlineAlert>;
  if (showBlockingError) {
    return <div className="space-y-4 max-w-xl mx-auto"><InlineAlert variant="danger" title="Chưa thể tiếp tục">{error}</InlineAlert><Button variant="outline" onClick={() => void loadBootstrap()}>Tải lại</Button></div>;
  }
  if (stage === 'RESTORING_SESSION' || stage === 'BOOTSTRAPPING_PROFILE') return <LoadingState message="Đang khôi phục phiên và nạp hồ sơ học tập..." count={3} />;
  if (stage === 'PROFILE_REQUIRED') {
    return (
      <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Hoàn tất hồ sơ người học</h1>
          <p className="text-sm text-[var(--text-secondary)]">Múi giờ giúp hệ thống xác định đúng ngày học của bạn.</p>
        </header>
        {error && <InlineAlert variant="danger" title="Chưa thể tiếp tục">{error}</InlineAlert>}
        <form className="space-y-4" onSubmit={updateProfile}>
          <div className="space-y-2">
            <label htmlFor="display-name" className="text-sm font-medium">Tên hiển thị (tùy chọn)</label>
            <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-3" />
          </div>
          <TimeZoneSetupField
            timeZone={timeZone}
            detectedAutomatically={timeZoneDetectedAutomatically}
            onChange={setTimeZone}
            onRetryDetection={retryTimeZoneDetection}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Đang lưu...' : timeZoneDetectedAutomatically ? 'Tiếp tục thiết lập' : 'Lưu múi giờ và tiếp tục'}
          </Button>
        </form>
      </Card>
    );
  }
  if (stage === 'LANGUAGE_PROFILE_REQUIRED') {
    if (pausedLanguageProfile) {
      const canResume = Boolean(pausedLanguageProfile.etag);
      return (
        <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">
          <header>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Hồ sơ tiếng Anh đang tạm dừng</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Hồ sơ học tập của bạn đang tạm dừng. Hãy tiếp tục lộ trình học để mở lại không gian học tập.
            </p>
          </header>
          {error && <InlineAlert variant="danger" title="Chưa thể tiếp tục">{error}</InlineAlert>}
          <Button
            variant="primary"
            onClick={() => void resumePausedProfile()}
            disabled={busy || !canResume}
          >
            {busy ? 'Đang kích hoạt lại...' : canResume ? 'Tiếp tục lộ trình tiếng Anh' : 'Chưa có phiên bản để tiếp tục'}
          </Button>
        </Card>
      );
    }
    if (archivedLanguageProfile) {
      const canReactivate = Boolean(archivedLanguageProfile.etag);
      return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5"><header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Hồ sơ tiếng Anh đã lưu trữ</h1><p className="text-sm text-[var(--text-secondary)]">Hồ sơ cũ vẫn giữ lịch sử học tập. Không tạo hồ sơ thứ hai; hãy khôi phục đúng hồ sơ này khi phiên bản đồng bộ đã sẵn sàng.</p></header>{error && <InlineAlert variant="danger" title="Chưa thể khôi phục">{error}</InlineAlert>}<Button variant="primary" onClick={() => void reactivateArchivedProfile()} disabled={busy || !canReactivate}>{busy ? 'Đang khôi phục...' : canReactivate ? 'Khôi phục hồ sơ tiếng Anh' : 'Chưa có phiên bản để khôi phục'}</Button></Card>;
    }
    return (
      <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Thiết lập hồ sơ tiếng Anh</h1>
          <p className="text-sm text-[var(--text-secondary)]">Bạn học tiếng Anh với hỗ trợ tiếng Việt.</p>
        </header>
        {error && <InlineAlert variant="danger" title="Chưa thể tạo hồ sơ">{error}</InlineAlert>}
        <form className="space-y-5" onSubmit={createLanguageProfile}>
          {timeZoneNeedsPersistence && (
            <>
              <div className="space-y-2">
                <label htmlFor="display-name" className="text-sm font-medium">Tên hiển thị (tùy chọn)</label>
                <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-3" />
              </div>
              <TimeZoneSetupField
                timeZone={timeZone}
                detectedAutomatically={timeZoneDetectedAutomatically}
                onChange={setTimeZone}
                onRetryDetection={retryTimeZoneDetection}
              />
            </>
          )}
          <fieldset>
            <legend className="text-sm font-medium mb-2">Chọn mục tiêu học tập</legend>
            <div className="grid grid-cols-2 gap-2">
              {learningGoals.map((item) => (
                <button key={item.value} type="button" aria-pressed={goal === item.value} onClick={() => setGoal(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${goal === item.value ? 'border-[var(--action-primary)] bg-[var(--status-info-bg)]' : 'border-[var(--border-subtle)]'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium mb-2">Thời lượng mỗi ngày</legend>
            <div className="flex flex-wrap gap-2">
              {dailyMinuteChoices.map((minutes) => (
                <button key={minutes} type="button" aria-pressed={dailyMinutes === minutes} onClick={() => setDailyMinutes(minutes)} className={`rounded-xl border px-3 py-3 text-sm ${dailyMinutes === minutes ? 'border-[var(--action-primary)] bg-[var(--status-info-bg)]' : 'border-[var(--border-subtle)]'}`}>
                  {minutes} phút
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Đang tạo...' : 'Tạo hồ sơ tiếng Anh'}</Button>
        </form>
      </Card>
    );
  }
  if (stage === 'ASSESSMENT_CHOICE') return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">{error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}<header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Đánh giá trình độ khởi điểm</h1><p className="text-sm text-[var(--text-secondary)]">Bài đánh giá là tùy chọn. Bạn có thể bắt đầu hoặc tiếp tục mà không bị gán mức A0 khi bỏ qua.</p></header><div className="flex flex-wrap gap-3"><Button variant="primary" onClick={() => void startAssessment()} disabled={busy}>{busy ? 'Đang chuẩn bị...' : 'Bắt đầu đánh giá'}</Button><Button variant="outline" onClick={goToday}>Bỏ qua đánh giá</Button></div></Card>;
  if (stage === 'ASSESSMENT_IN_PROGRESS' && assessment?.currentItem) {
    const item = assessment.currentItem;
    return (
      <Card variant="elevated" padding="lg" className="max-w-2xl mx-auto space-y-5">
        {error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}
        <header>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Đánh giá trình độ khởi điểm</h1>
          <p className="text-sm text-[var(--text-secondary)]">Câu hỏi hiện tại do máy chủ quyết định.</p>
        </header>

        {item.textSnippet && (
          <div
            data-testid="assessment-text-snippet"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4 text-sm leading-relaxed text-[var(--text-secondary)] italic whitespace-pre-wrap"
          >
            {item.textSnippet}
          </div>
        )}

        {item.audioUrl && (
          <AssessmentAudioPlayer src={item.audioUrl} />
        )}

        <h2 className="text-lg font-semibold">{item.prompt}</h2>
        <div className="grid gap-3">
          {item.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => void submitAnswer(option.id)}
              disabled={busy}
              className="rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              {option.text}
            </button>
          ))}
        </div>
        {item.allowSkip && (
          <Button variant="outline" onClick={() => void submitAnswer()} disabled={busy}>
            Bỏ qua câu này
          </Button>
        )}
      </Card>
    );
  }
  if (stage === 'ASSESSMENT_COMPLETE') {
    const estimate = assessment?.result;
    return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">{error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}<header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Starting Level Estimate</h1><p className="text-sm text-[var(--text-secondary)]">Đây là ước lượng để cá nhân hóa lộ trình, không phải chứng chỉ.</p></header>{estimate ? <div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-2xl font-bold">{estimate.level.code}</p><p>Độ tin cậy: {estimate.confidenceBand}</p><p className="text-sm text-[var(--text-secondary)]">{estimate.evidenceCount} bằng chứng</p></div> : <p className="text-sm text-[var(--text-secondary)]">Chưa có ước lượng vì bài đánh giá đã bỏ qua hoặc bị dừng.</p>}<Button variant="primary" onClick={goToday}>Tiếp tục tới Today</Button></Card>;
  }
  return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">{error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}<h1 className="text-2xl font-bold text-[var(--text-primary)]">Sẵn sàng bắt đầu</h1><p className="text-sm text-[var(--text-secondary)]">Hồ sơ học tập đã sẵn sàng.</p><Button variant="primary" onClick={goToday}>Tới Today</Button></Card>;
}
