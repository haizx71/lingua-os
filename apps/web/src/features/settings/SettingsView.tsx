'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, ErrorState, InlineAlert, LoadingState } from '@lingua/ui';
import { Save } from 'lucide-react';
import { PERSISTENCE_GAPS, type ApiClient, type ApiErrorCode } from '@lingua/types';
import { AccountSecurityCard } from './AccountSecurityCard';
import { useSettingsPersistence } from './useSettingsPersistence';

type ThemeMode = 'light' | 'dark' | 'system';

export const SETTINGS_PERSISTENCE = Object.freeze({
  dailyTargetMinutes: 'NOT_YET_PERSISTED',
  newWordsBudgetPerDay: PERSISTENCE_GAPS.newConceptBudget,
  theme: PERSISTENCE_GAPS.theme,
  reducedMotion: PERSISTENCE_GAPS.reducedMotion,
  audioAutoplay: PERSISTENCE_GAPS.audioAutoplay,
} as const);

export interface UserSettingsData {
  dailyTargetMinutes: number;
  newWordsBudgetPerDay: number;
  theme: ThemeMode;
  reducedMotion: boolean;
  audioAutoplay: boolean;
  defaultSpeechRate?: 1 | 0.75;
  preferredReminderTime?: 'off' | '07:30' | '12:30' | '20:00' | '21:30';
  preferredAccent?: 'en-US' | 'en-GB';
  dailyReviewCap?: 20 | 50 | 100;
}

export interface SettingsViewProps {
  apiClient?: ApiClient;
  initialSettings?: Partial<UserSettingsData>;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onSaveSettings?: (settings: UserSettingsData) => void;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getStoredUserSettings(): {
  newWordsBudgetPerDay?: number;
  reducedMotion?: boolean;
  audioAutoplay?: boolean;
  defaultSpeechRate?: 1 | 0.75;
  preferredReminderTime?: 'off' | '07:30' | '12:30' | '20:00' | '21:30';
  preferredAccent?: 'en-US' | 'en-GB';
  dailyReviewCap?: 20 | 50 | 100;
} {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('lingua-user-settings-v1');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore invalid JSON in localStorage
  }
  return {};
}

function Switch({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onClick}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${checked ? 'justify-end bg-[var(--action-primary)]' : 'justify-start bg-[var(--border-default)]'}`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

export function SettingsView({
  apiClient,
  initialSettings,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSaveSettings,
}: SettingsViewProps) {
  const persistence = useSettingsPersistence({
    ...(apiClient ? { apiClient } : {}),
    enabled: forcedState === 'success' && !initialSettings,
  });
  const [dailyMinutes, setDailyMinutes] = useState<number>(initialSettings?.dailyTargetMinutes ?? 25);
  const [newWordsBudget, setNewWordsBudget] = useState<number>(() => {
    if (initialSettings?.newWordsBudgetPerDay !== undefined) return initialSettings.newWordsBudgetPerDay;
    const stored = getStoredUserSettings();
    return typeof stored.newWordsBudgetPerDay === 'number' ? stored.newWordsBudgetPerDay : 4;
  });
  const [theme, setTheme] = useState<ThemeMode>(initialSettings?.theme ?? 'light');
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (initialSettings?.reducedMotion !== undefined) return initialSettings.reducedMotion;
    const stored = getStoredUserSettings();
    return typeof stored.reducedMotion === 'boolean' ? stored.reducedMotion : false;
  });
  const [audioAutoplay, setAudioAutoplay] = useState<boolean>(() => {
    if (initialSettings?.audioAutoplay !== undefined) return initialSettings.audioAutoplay;
    const stored = getStoredUserSettings();
    return typeof stored.audioAutoplay === 'boolean' ? stored.audioAutoplay : true;
  });
  const [defaultSpeechRate, setDefaultSpeechRate] = useState<1 | 0.75>(() => {
    if (initialSettings?.defaultSpeechRate !== undefined) return initialSettings.defaultSpeechRate;
    const stored = getStoredUserSettings();
    return stored.defaultSpeechRate === 0.75 || stored.defaultSpeechRate === 1 ? stored.defaultSpeechRate : 1;
  });
  const [preferredReminderTime, setPreferredReminderTime] = useState<
    'off' | '07:30' | '12:30' | '20:00' | '21:30'
  >(() => {
    if (initialSettings?.preferredReminderTime !== undefined) return initialSettings.preferredReminderTime;
    const stored = getStoredUserSettings();
    const val = stored.preferredReminderTime;
    if (val === '07:30' || val === '12:30' || val === '20:00' || val === '21:30') {
      return val;
    }
    return 'off';
  });
  const [preferredAccent, setPreferredAccent] = useState<'en-US' | 'en-GB'>(() => {
    if (initialSettings?.preferredAccent !== undefined) return initialSettings.preferredAccent;
    const stored = getStoredUserSettings();
    return stored.preferredAccent === 'en-GB' ? 'en-GB' : 'en-US';
  });
  const [dailyReviewCap, setDailyReviewCap] = useState<20 | 50 | 100>(() => {
    if (initialSettings?.dailyReviewCap !== undefined) return initialSettings.dailyReviewCap;
    const stored = getStoredUserSettings();
    return stored.dailyReviewCap === 20 || stored.dailyReviewCap === 50 || stored.dailyReviewCap === 100
      ? stored.dailyReviewCap
      : 50;
  });
  const [savedNotification, setSavedNotification] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (!isDirtyRef.current && persistence.persistedDailyMinutes !== null && !initialSettings?.dailyTargetMinutes) {
      setDailyMinutes(persistence.persistedDailyMinutes);
    }
  }, [initialSettings?.dailyTargetMinutes, persistence.persistedDailyMinutes]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('lingua-theme');
    if (isThemeMode(storedTheme)) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    const applyTheme = () => {
      const dark = theme === 'dark' || (theme === 'system' && Boolean(media?.matches));
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };

    window.localStorage.setItem('lingua-theme', theme);
    applyTheme();

    if (theme !== 'system' || !media) return undefined;
    const onChange = () => applyTheme();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('lingua-user-settings-v1');
      if (stored) {
        const parsed = JSON.parse(stored) as {
          newWordsBudgetPerDay?: number;
          reducedMotion?: boolean;
          audioAutoplay?: boolean;
          defaultSpeechRate?: 1 | 0.75;
          preferredReminderTime?: 'off' | '07:30' | '12:30' | '20:00' | '21:30';
          preferredAccent?: 'en-US' | 'en-GB';
          dailyReviewCap?: 20 | 50 | 100;
        };
        if (initialSettings?.newWordsBudgetPerDay === undefined && typeof parsed.newWordsBudgetPerDay === 'number') {
          setNewWordsBudget(parsed.newWordsBudgetPerDay);
        }
        if (initialSettings?.reducedMotion === undefined && typeof parsed.reducedMotion === 'boolean') {
          setReducedMotion(parsed.reducedMotion);
        }
        if (initialSettings?.audioAutoplay === undefined && typeof parsed.audioAutoplay === 'boolean') {
          setAudioAutoplay(parsed.audioAutoplay);
        }
        if (initialSettings?.defaultSpeechRate === undefined && (parsed.defaultSpeechRate === 0.75 || parsed.defaultSpeechRate === 1)) {
          setDefaultSpeechRate(parsed.defaultSpeechRate);
        }
        if (
          initialSettings?.preferredReminderTime === undefined &&
          (parsed.preferredReminderTime === 'off' ||
            parsed.preferredReminderTime === '07:30' ||
            parsed.preferredReminderTime === '12:30' ||
            parsed.preferredReminderTime === '20:00' ||
            parsed.preferredReminderTime === '21:30')
        ) {
          setPreferredReminderTime(parsed.preferredReminderTime);
        }
        if (initialSettings?.preferredAccent === undefined && parsed.preferredAccent === 'en-GB') {
          setPreferredAccent('en-GB');
        }
        if (
          initialSettings?.dailyReviewCap === undefined &&
          (parsed.dailyReviewCap === 20 || parsed.dailyReviewCap === 50 || parsed.dailyReviewCap === 100)
        ) {
          setDailyReviewCap(parsed.dailyReviewCap);
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }, [initialSettings?.audioAutoplay, initialSettings?.dailyReviewCap, initialSettings?.defaultSpeechRate, initialSettings?.newWordsBudgetPerDay, initialSettings?.preferredAccent, initialSettings?.preferredReminderTime, initialSettings?.reducedMotion]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    }
  }, [reducedMotion]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const handleResetDefaults = () => {
    setDefaultSpeechRate(1);
    setPreferredReminderTime('off');
    setPreferredAccent('en-US');
    setDailyReviewCap(50);
    setReducedMotion(false);
    setAudioAutoplay(true);
  };

  const handleSave = () => {
    const updated: UserSettingsData = {
      dailyTargetMinutes: dailyMinutes,
      newWordsBudgetPerDay: newWordsBudget,
      theme,
      reducedMotion,
      audioAutoplay,
      defaultSpeechRate,
      ...(preferredReminderTime !== 'off' ? { preferredReminderTime } : {}),
      ...(preferredAccent !== 'en-US' ? { preferredAccent } : {}),
      ...(dailyReviewCap !== 50 ? { dailyReviewCap } : {}),
    };
    if (typeof window !== 'undefined') {
      try {
        const storedSettingsPayload: Record<string, unknown> = {
          newWordsBudgetPerDay: newWordsBudget,
          reducedMotion,
          audioAutoplay,
        };
        if (defaultSpeechRate !== 1) {
          storedSettingsPayload.defaultSpeechRate = defaultSpeechRate;
        }
        if (preferredReminderTime !== 'off') {
          storedSettingsPayload.preferredReminderTime = preferredReminderTime;
        }
        if (preferredAccent !== 'en-US') {
          storedSettingsPayload.preferredAccent = preferredAccent;
        }
        if (dailyReviewCap !== 50) {
          storedSettingsPayload.dailyReviewCap = dailyReviewCap;
        }
        window.localStorage.setItem(
          'lingua-user-settings-v1',
          JSON.stringify(storedSettingsPayload)
        );
      } catch {
        // Ignore localStorage write error
      }
    }
    onSaveSettings?.(updated);
    setSavedNotification('Giao diện đã được lưu trên thiết bị. Các tùy chọn còn lại hiện chỉ áp dụng trong phiên này.');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { setSavedNotification(null); saveTimerRef.current = null; }, 3000);

    if (persistence.isLive) {
      void persistence.saveDailyMinutes(dailyMinutes).then((persisted) => {
        if (persisted) {
          setSavedNotification('Thời lượng học mỗi ngày đã được đồng bộ lên máy chủ và giao diện đã được lưu trên thiết bị.');
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => { setSavedNotification(null); saveTimerRef.current = null; }, 3000);
        }
      });
    }
  };

  const handleRetry = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setCurrentState('loading');
    retryTimerRef.current = setTimeout(() => { setCurrentState('success'); retryTimerRef.current = null; }, 400);
  };

  if (currentState === 'loading') return <LoadingState message="Đang nạp cài đặt..." count={3} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;

  const optionClass = (active: boolean) => `min-h-11 rounded-2xl border px-3 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active
    ? 'border-[var(--action-primary)]/25 bg-[var(--surface-blue)] text-[var(--action-primary)]'
    : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'}`;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="min-w-0">
        <p className="lingua-kicker text-[var(--action-primary)]">Tài khoản</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Cài đặt</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">Tùy chỉnh trải nghiệm học và quản lý tài khoản của bạn.</p>
      </header>

      {savedNotification && <InlineAlert variant="success" title="Đã lưu">{savedNotification}</InlineAlert>}
      {persistence.saveError && <InlineAlert variant="danger" title="Không thể lưu thời lượng học">{persistence.saveError.message}</InlineAlert>}
      <InlineAlert variant="info" title="Lưu tùy chọn">
        <p>Giao diện được lưu trên thiết bị này. Mục tiêu học, ngân sách từ mới, giảm chuyển động và tự phát âm chưa được lưu lâu dài.</p>
        <p
          data-testid="settings-storage-reassurance"
          className="mt-1 text-xs text-[var(--text-secondary)]"
        >
          💾 Yên tâm: Các tùy chọn giọng đọc, tốc độ nghe và cỡ chữ vẫn được giữ tự động trên trình duyệt của máy này.
        </p>
      </InlineAlert>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <AccountSecurityCard />
          <Card padding="lg" className="min-w-0 bg-[var(--surface-lilac)]">
            <h2 className="text-lg font-bold tracking-[-0.02em] text-[var(--text-primary)]">Mục tiêu học mỗi ngày</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Điều chỉnh nhịp học để phù hợp với thời gian và sức học của bạn.</p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card padding="lg" className="min-w-0">
            <div className="flex min-w-0 flex-col gap-5">
              <section className="min-w-0 border-b border-[var(--border-subtle)] pb-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-[var(--text-primary)]">Thời lượng học mỗi ngày</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Thời gian dành cho kế hoạch học trong ngày.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-blue)] px-3 py-1.5 text-xs font-extrabold text-[var(--action-primary)]">{dailyMinutes} phút / ngày</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[10, 20, 25, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        isDirtyRef.current = true;
                        setDailyMinutes(mins);
                        persistence.setDailyMinutes(mins);
                      }}
                      className={optionClass(dailyMinutes === mins)}
                    >
                      {mins} phút
                    </button>
                  ))}
                </div>
              </section>

              <section className="min-w-0">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-[var(--text-primary)]">Ngân sách từ mới mỗi ngày</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Giới hạn lượng từ mới để tránh học quá tải.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--accent-teal-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-teal-strong)]">{newWordsBudget} từ mới / ngày</span>
                </div>
                <p
                  data-testid="settings-budget-beginner-note"
                  className="mt-1 text-xs text-[var(--text-muted)]"
                >
                  💡 Giải thích: Số lượng từ tiếng Anh mới tối đa bạn muốn học thêm mỗi ngày (chỉ tiêu học tập, không phải chi phí tiền bạc).
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[2, 4, 6, 8].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setNewWordsBudget(count)}
                      className={optionClass(newWordsBudget === count)}
                    >
                      {count} từ
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </Card>

          <Card padding="lg" className="min-w-0">
            <h3 className="text-lg font-bold tracking-[-0.02em] text-[var(--text-primary)]">Giao diện & trợ năng</h3>

            <div className="mt-5 space-y-1">
              <div className="border-b border-[var(--border-subtle)] py-4">
                <span className="text-sm font-bold text-[var(--text-primary)]">Chế độ hiển thị</span>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={optionClass(theme === t)}
                    >
                      {t === 'light' ? 'Sáng' : t === 'dark' ? 'Tối' : 'Hệ thống'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-4">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-[var(--text-primary)]">Giảm chuyển động</span>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Giảm hiệu ứng hoạt hình và chuyển cảnh.</p>
                </div>
                <Switch checked={reducedMotion} onClick={() => setReducedMotion(!reducedMotion)} label="Giảm chuyển động" />
              </div>

              <div className="flex min-w-0 items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-[var(--text-primary)]">Tự động phát âm trong Ôn tập</span>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Phát âm từ ngay khi lật thẻ.</p>
                </div>
                <Switch checked={audioAutoplay} onClick={() => setAudioAutoplay(!audioAutoplay)} label="Tự động phát âm trong Ôn tập" />
              </div>

              <div
                data-testid="settings-speech-rate-group"
                className="mt-2 flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="block text-sm font-medium text-[var(--text-primary)]">
                    Tốc độ phát âm mặc định (Reader & Ôn tập)
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">
                    Chọn 0.75x nếu bạn là người mới cần nghe rõ từng âm tiết
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={defaultSpeechRate === 1 ? 'primary' : 'outline'}
                    data-testid="settings-speech-rate-1"
                    onClick={() => setDefaultSpeechRate(1)}
                  >
                    1.0x Bình thường
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={defaultSpeechRate === 0.75 ? 'primary' : 'outline'}
                    data-testid="settings-speech-rate-slow"
                    onClick={() => setDefaultSpeechRate(0.75)}
                  >
                    🐢 0.75x Chậm
                  </Button>
                </div>
              </div>

              <div
                data-testid="settings-reminder-time-selector"
                role="group"
                aria-label="Chọn giờ nhắc nhở học tập hàng ngày"
                className="space-y-2 border-t border-[var(--border-subtle)] pt-4"
              >
                <span className="block text-sm font-bold text-[var(--text-primary)]">
                  Khung giờ nhắc học hàng ngày
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: 'off', label: 'Tắt nhắc' },
                      { value: '07:30', label: '07:30 Sáng' },
                      { value: '12:30', label: '12:30 Trưa' },
                      { value: '20:00', label: '20:00 Tối' },
                      { value: '21:30', label: '21:30 Đêm' },
                    ] as const
                  ).map((opt) => {
                    const active = preferredReminderTime === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`settings-reminder-${opt.value}`}
                        aria-pressed={active}
                        onClick={() => setPreferredReminderTime(opt.value)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? 'bg-[var(--action-primary)] text-white'
                            : 'border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                data-testid="settings-accent-selector"
                role="group"
                aria-label="Chọn giọng phát âm tiếng Anh"
                className="space-y-2 border-t border-[var(--border-subtle)] pt-4"
              >
                <span className="block text-sm font-bold text-[var(--text-primary)]">
                  Giọng phát âm ưu tiên (Chuẩn Anh-Mỹ hoặc Anh-Anh)
                </span>
                <div
                  data-testid="wave9-settings-accent-selector"
                  aria-label="Chọn giọng phát âm mẫu: Anh-Mỹ hoặc Anh-Anh"
                  className="flex flex-wrap gap-2"
                >
                  {(
                    [
                      { value: 'en-US', label: '🇺🇸 Anh - Mỹ (en-US)' },
                      { value: 'en-GB', label: '🇬🇧 Anh - Anh (en-GB)' },
                    ] as const
                  ).map((opt) => {
                    const active = preferredAccent === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`settings-accent-${opt.value}`}
                        aria-pressed={active}
                        onClick={() => setPreferredAccent(opt.value)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? 'bg-[var(--action-primary)] text-white'
                            : 'border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                data-testid="settings-review-cap-selector"
                role="group"
                aria-label="Giới hạn số thẻ ôn tập tối đa mỗi ngày"
                className="space-y-2 border-t border-[var(--border-subtle)] pt-4"
              >
                <span className="block text-sm font-bold text-[var(--text-primary)]">
                  Giới hạn thẻ ôn tập FSRS mỗi ngày (Nhịp nhắc thông minh vừa sức)
                </span>
                <div className="flex flex-wrap gap-2">
                  {([20, 50, 100] as const).map((cap) => {
                    const active = dailyReviewCap === cap;
                    return (
                      <button
                        key={cap}
                        type="button"
                        data-testid={`settings-review-cap-${cap}`}
                        aria-pressed={active}
                        onClick={() => setDailyReviewCap(cap)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? 'bg-[var(--action-primary)] text-white'
                            : 'border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {cap} thẻ/ngày
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-end gap-2 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-[var(--shadow-card)] md:static md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="settings-reset-defaults"
              aria-label="Khôi phục tùy chọn thiết bị về mặc định"
              onClick={handleResetDefaults}
            >
              Khôi phục mặc định
            </Button>
            <Button
              className="w-full md:w-auto"
              variant="primary"
              size="md"
              leftIcon={<Save className="h-4 w-4" />}
              disabled={persistence.isSaving}
              onClick={() => { void handleSave(); }}
            >
              Lưu cài đặt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
