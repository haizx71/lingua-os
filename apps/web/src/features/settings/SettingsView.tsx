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
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }, [initialSettings?.audioAutoplay, initialSettings?.newWordsBudgetPerDay, initialSettings?.reducedMotion]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    }
  }, [reducedMotion]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const handleSave = () => {
    const updated: UserSettingsData = { dailyTargetMinutes: dailyMinutes, newWordsBudgetPerDay: newWordsBudget, theme, reducedMotion, audioAutoplay };
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          'lingua-user-settings-v1',
          JSON.stringify({
            newWordsBudgetPerDay: newWordsBudget,
            reducedMotion,
            audioAutoplay,
          })
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
        Giao diện được lưu trên thiết bị này. Mục tiêu học, ngân sách từ mới, giảm chuyển động và tự phát âm chưa được lưu lâu dài.
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
            </div>
          </Card>

          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-[var(--shadow-card)] md:static md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 md:shadow-none">
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
