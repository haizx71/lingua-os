'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Button, InlineAlert, LoadingState } from '@lingua/ui';
import {
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

function makeActionKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  throw new Error('Trình duyệt không hỗ trợ mã idempotency an toàn.');
}

function isUsableEnglishProfile(profile: OnboardingLanguageProfileViewModel): boolean {
  return profile.nativeLanguageCode === 'vi' && profile.targetLanguageCode === 'en' && profile.status === 'active';
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

export function LiveOnboardingFlow({ apiClient, navigate }: LiveOnboardingFlowProps) {
  const { authState, user } = useAuth();
  const userId = user?.id ?? null;
  const api = useMemo(() => apiClient ?? getApiClient(), [apiClient]);
  const [stage, setStage] = useState<OnboardingStage>('RESTORING_SESSION');
  const [languageProfile, setLanguageProfile] = useState<OnboardingLanguageProfileViewModel | null>(null);
  const [archivedLanguageProfile, setArchivedLanguageProfile] = useState<OnboardingLanguageProfileViewModel | null>(null);
  const [timeZone, setTimeZone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(null);
  const [assessment, setAssessment] = useState<OnboardingAssessmentViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const languageProfileCreateKey = useRef<string | null>(null);
  const assessmentStartKey = useRef<string | null>(null);
  const assessmentAnswerKeys = useRef(new Map<string, string>());

  const goToday = () => {
    setStage('READY_FOR_TODAY');
    if (navigate) navigate('/today');
    else if (typeof window !== 'undefined') window.location.assign('/today');
  };

  const loadBootstrap = async () => {
    setError(null);
    setStage('BOOTSTRAPPING_PROFILE');
    try {
      const meResponse = await api.getMe();
      const profile = mapOnboardingProfileToViewModel(meResponse.data);
      setDisplayName(profile.displayName ?? '');
      setTimeZone(profile.timeZone ?? '');
      const languages = await api.listMyLanguageProfiles();
      const profiles = languages.data.map(mapOnboardingLanguageProfileToViewModel);
      const usable = profiles.find(isUsableEnglishProfile) ?? null;
      const archived = profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'archived') ?? null;
      setLanguageProfile(usable);
      setArchivedLanguageProfile(archived);
      if (!meResponse.data.timeZone) {
        const suggested = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
        setTimeZone(suggested);
        setStage('PROFILE_REQUIRED');
      } else if (!usable) {
        setStage('LANGUAGE_PROFILE_REQUIRED');
      } else if (usable.startingLevelEstimate) {
        setStage('READY_FOR_TODAY');
      } else {
        const assessmentId = storedAssessmentId(userId);
        if (!assessmentId) {
          setStage('ASSESSMENT_CHOICE');
        } else {
          try {
            const resumed = mapOnboardingAssessmentToViewModel((await api.getStartingLevelAssessment(assessmentId)).data);
            setAssessment(resumed);
            if (resumed.status === 'completed' || resumed.status === 'abandoned') {
              forgetAssessmentId(userId);
              setStage('ASSESSMENT_COMPLETE');
            } else {
              setStage('ASSESSMENT_IN_PROGRESS');
            }
          } catch (cause) {
            const mapped = mapApiErrorToUi(cause);
            if (mapped.code === 'NOT_FOUND') {
              forgetAssessmentId(userId);
              setStage('ASSESSMENT_CHOICE');
            } else {
              throw cause;
            }
          }
        }
      }
      return true;
    } catch (cause) {
      setError(mapApiErrorToUi(cause).message);
      setStage('BOOTSTRAPPING_PROFILE');
      return false;
    }
  };

  useEffect(() => {
    if (authState === 'authenticated') void loadBootstrap();
    else if (authState === 'unauthenticated') setStage('RESTORING_SESSION');
  }, [authState]);

  const updateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTimeZone = timeZone.trim();
    if (!normalizedTimeZone) {
      setError('Hãy chọn và xác nhận múi giờ để tiếp tục.');
      return;
    }
    const etag = etagFor(api, 'me');
    if (!etag) {
      setError('Phiên hồ sơ đã cũ. Hãy tải lại để nhận phiên bản mới trước khi lưu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.updateMe({
        body: { timeZone: normalizedTimeZone, ...(displayName.trim() ? { displayName: displayName.trim() } : {}) },
        headers: { 'If-Match': etag },
      });
      const languages = await api.listMyLanguageProfiles();
      const profiles = languages.data.map(mapOnboardingLanguageProfileToViewModel);
      const active = profiles.find(isUsableEnglishProfile) ?? null;
      setLanguageProfile(active);
      setArchivedLanguageProfile(profiles.find((item) => item.nativeLanguageCode === 'vi' && item.targetLanguageCode === 'en' && item.status === 'archived') ?? null);
      if (!active) setStage('LANGUAGE_PROFILE_REQUIRED');
      else if (active.startingLevelEstimate) setStage('READY_FOR_TODAY');
      else setStage('ASSESSMENT_CHOICE');
    } catch (cause) {
      const mapped = mapApiErrorToUi(cause);
      setError(mapped.code === 'PRECONDITION_FAILED' ? 'Hồ sơ vừa thay đổi. Đã tải lại dữ liệu mới; hãy xác nhận lại rồi lưu.' : mapped.message);
      if (mapped.code === 'PRECONDITION_FAILED') {
        await loadBootstrap();
        setError('Hồ sơ vừa thay đổi. Đã tải dữ liệu mới; hãy kiểm tra lại rồi thực hiện một lần lưu có chủ ý.');
      }
    } finally {
      setBusy(false);
    }
  };

  const createLanguageProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!goal || dailyMinutes === null) {
      setError('Hãy chọn mục tiêu và thời lượng học trước khi tạo hồ sơ.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.createMyLanguageProfile({
        body: { nativeLanguageCode: 'vi', targetLanguageCode: 'en', goal, dailyMinutes },
        headers: { 'Idempotency-Key': languageProfileCreateKey.current ?? (languageProfileCreateKey.current = makeActionKey()) },
      });
      const createdProfile = mapOnboardingLanguageProfileToViewModel(response.data);
      setLanguageProfile(createdProfile);
      setArchivedLanguageProfile(null);
      setStage(createdProfile.startingLevelEstimate ? 'READY_FOR_TODAY' : 'ASSESSMENT_CHOICE');
    } catch (cause) {
      setError(mapApiErrorToUi(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const reactivateArchivedProfile = async () => {
    if (!archivedLanguageProfile || busy) return;
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
      const restored = mapOnboardingLanguageProfileToViewModel(response.data);
      setLanguageProfile(restored);
      setArchivedLanguageProfile(null);
      setStage(restored.startingLevelEstimate ? 'READY_FOR_TODAY' : 'ASSESSMENT_CHOICE');
    } catch (cause) {
      const mapped = mapApiErrorToUi(cause);
      if (mapped.code === 'PRECONDITION_FAILED') {
        // Discard the stale child token. Refetch only; never retry the mutation.
        setArchivedLanguageProfile(null);
        if (await loadBootstrap()) {
          setError('Hồ sơ vừa thay đổi. Đã tải dữ liệu mới; hãy kiểm tra lại rồi khôi phục nếu vẫn cần.');
        }
      } else {
        setError(mapped.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const startAssessment = async () => {
    if (!languageProfile) return;
    setBusy(true);
    setError(null);
    try {
      const key = assessmentStartKey.current ?? (assessmentStartKey.current = makeActionKey());
      const response = await api.startStartingLevelAssessment({
        body: { languageProfileId: languageProfile.id },
        headers: { 'Idempotency-Key': key },
      });
      const startedAssessment = mapOnboardingAssessmentToViewModel(response.data);
      setAssessment(startedAssessment);
      if (startedAssessment.status === 'completed' || startedAssessment.status === 'abandoned') {
        forgetAssessmentId(userId);
        setStage('ASSESSMENT_COMPLETE');
      } else {
        rememberAssessmentId(startedAssessment.id, userId);
        setStage('ASSESSMENT_IN_PROGRESS');
      }
    } catch (cause) {
      setError(mapApiErrorToUi(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (selectedOptionId?: string) => {
    if (!assessment?.currentItem) return;
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
      const submittedAssessment = mapOnboardingAssessmentToViewModel(response.data);
      setAssessment(submittedAssessment);
      if (submittedAssessment.status === 'completed' || submittedAssessment.status === 'abandoned') {
        forgetAssessmentId(userId);
        setStage('ASSESSMENT_COMPLETE');
      } else {
        rememberAssessmentId(submittedAssessment.id, userId);
        setStage('ASSESSMENT_IN_PROGRESS');
      }
    } catch (cause) {
      setError(mapApiErrorToUi(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const showBlockingError = error !== null && (stage === 'BOOTSTRAPPING_PROFILE' || stage === 'RESTORING_SESSION');
  if (authState !== 'authenticated') return <InlineAlert variant="info" title="Cần đăng nhập">Hãy đăng nhập để bắt đầu thiết lập lộ trình.</InlineAlert>;
  if (showBlockingError) {
    return <div className="space-y-4 max-w-xl mx-auto"><InlineAlert variant="danger" title="Chưa thể tiếp tục">{error}</InlineAlert><Button variant="outline" onClick={() => void loadBootstrap()}>Tải lại</Button></div>;
  }
  if (stage === 'RESTORING_SESSION' || stage === 'BOOTSTRAPPING_PROFILE') return <LoadingState message="Đang khôi phục phiên và nạp hồ sơ học tập..." count={3} />;
  if (stage === 'PROFILE_REQUIRED') {
    return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5"><header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Xác nhận hồ sơ người học</h1><p className="text-sm text-[var(--text-secondary)]">Múi giờ giúp hệ thống xác định đúng ngày học của bạn.</p></header>{error && <InlineAlert variant="danger" title="Hồ sơ vừa thay đổi">{error}</InlineAlert>}<form className="space-y-4" onSubmit={updateProfile}><div className="space-y-2"><label htmlFor="display-name" className="text-sm font-medium">Tên hiển thị (tùy chọn)</label><input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-3" /></div><div className="space-y-2"><label htmlFor="time-zone" className="text-sm font-medium">Múi giờ</label><input id="time-zone" required value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="w-full rounded-xl border border-[var(--border-subtle)] px-3 py-3" /></div><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Xác nhận múi giờ'}</Button></form></Card>;
  }
  if (stage === 'LANGUAGE_PROFILE_REQUIRED') {
    if (archivedLanguageProfile) {
      const canReactivate = Boolean(archivedLanguageProfile.etag);
      return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5"><header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Hồ sơ tiếng Anh đã lưu trữ</h1><p className="text-sm text-[var(--text-secondary)]">Hồ sơ cũ vẫn giữ lịch sử học tập. Không tạo hồ sơ thứ hai; hãy khôi phục đúng hồ sơ này khi phiên bản đồng bộ đã sẵn sàng.</p></header>{error && <InlineAlert variant="danger" title="Chưa thể khôi phục">{error}</InlineAlert>}<Button variant="primary" onClick={() => void reactivateArchivedProfile()} disabled={busy || !canReactivate}>{busy ? 'Đang khôi phục...' : canReactivate ? 'Khôi phục hồ sơ tiếng Anh' : 'Chưa có phiên bản để khôi phục'}</Button></Card>;
    }
    return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5"><header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Thiết lập hồ sơ tiếng Anh</h1><p className="text-sm text-[var(--text-secondary)]">Bạn học tiếng Anh với hỗ trợ tiếng Việt.</p></header>{error && <InlineAlert variant="danger" title="Chưa thể tạo hồ sơ">{error}</InlineAlert>}<form className="space-y-5" onSubmit={createLanguageProfile}><fieldset><legend className="text-sm font-medium mb-2">Chọn mục tiêu học tập</legend><div className="grid grid-cols-2 gap-2">{learningGoals.map((item) => <button key={item.value} type="button" aria-pressed={goal === item.value} onClick={() => setGoal(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${goal === item.value ? 'border-[var(--action-primary)] bg-[var(--status-info-bg)]' : 'border-[var(--border-subtle)]'}`}>{item.label}</button>)}</div></fieldset><fieldset><legend className="text-sm font-medium mb-2">Thời lượng mỗi ngày</legend><div className="flex flex-wrap gap-2">{dailyMinuteChoices.map((minutes) => <button key={minutes} type="button" aria-pressed={dailyMinutes === minutes} onClick={() => setDailyMinutes(minutes)} className={`rounded-xl border px-3 py-3 text-sm ${dailyMinutes === minutes ? 'border-[var(--action-primary)] bg-[var(--status-info-bg)]' : 'border-[var(--border-subtle)]'}`}>{minutes} phút</button>)}</div></fieldset><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Đang tạo...' : 'Tạo hồ sơ tiếng Anh'}</Button></form></Card>;
  }
  if (stage === 'ASSESSMENT_CHOICE') return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">{error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}<header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Đánh giá trình độ khởi điểm</h1><p className="text-sm text-[var(--text-secondary)]">Bài đánh giá là tùy chọn. Bạn có thể bắt đầu hoặc tiếp tục mà không bị gán mức A0 khi bỏ qua.</p></header><div className="flex flex-wrap gap-3"><Button variant="primary" onClick={() => void startAssessment()} disabled={busy}>{busy ? 'Đang chuẩn bị...' : 'Bắt đầu đánh giá'}</Button><Button variant="outline" onClick={goToday}>Bỏ qua đánh giá</Button></div></Card>;
  if (stage === 'ASSESSMENT_IN_PROGRESS' && assessment?.currentItem) {
    return <Card variant="elevated" padding="lg" className="max-w-2xl mx-auto space-y-5">{error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}<header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Đánh giá trình độ khởi điểm</h1><p className="text-sm text-[var(--text-secondary)]">Câu hỏi hiện tại do máy chủ quyết định.</p></header><h2 className="text-lg font-semibold">{assessment.currentItem.prompt}</h2><div className="grid gap-3">{assessment.currentItem.options.map((option) => <button key={option.id} type="button" onClick={() => void submitAnswer(option.id)} disabled={busy} className="rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]">{option.text}</button>)}</div>{assessment.currentItem.allowSkip && <Button variant="outline" onClick={() => void submitAnswer()} disabled={busy}>Bỏ qua câu này</Button>}</Card>;
  }
  if (stage === 'ASSESSMENT_COMPLETE') {
    const estimate = assessment?.result;
    return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">{error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}<header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Starting Level Estimate</h1><p className="text-sm text-[var(--text-secondary)]">Đây là ước lượng để cá nhân hóa lộ trình, không phải chứng chỉ.</p></header>{estimate ? <div className="rounded-xl bg-[var(--surface-subtle)] p-4"><p className="text-2xl font-bold">{estimate.level.code}</p><p>Độ tin cậy: {estimate.confidenceBand}</p><p className="text-sm text-[var(--text-secondary)]">{estimate.evidenceCount} bằng chứng</p></div> : <p className="text-sm text-[var(--text-secondary)]">Chưa có ước lượng vì bài đánh giá đã bỏ qua hoặc bị dừng.</p>}<Button variant="primary" onClick={goToday}>Tiếp tục tới Today</Button></Card>;
  }
  return <Card variant="elevated" padding="lg" className="max-w-xl mx-auto space-y-5">{error && <InlineAlert variant="danger" title="Cần kiểm tra lại">{error}</InlineAlert>}<h1 className="text-2xl font-bold text-[var(--text-primary)]">Sẵn sàng bắt đầu</h1><p className="text-sm text-[var(--text-secondary)]">Hồ sơ học tập đã sẵn sàng.</p><Button variant="primary" onClick={goToday}>Tới Today</Button></Card>;
}
