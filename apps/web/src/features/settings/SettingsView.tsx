'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, ErrorState, InlineAlert, LoadingState } from '@lingua/ui';
import { Save } from 'lucide-react';
import { PERSISTENCE_GAPS, type ApiErrorCode } from '@lingua/types';
import { AccountSecurityCard } from './AccountSecurityCard';

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
  initialSettings?: Partial<UserSettingsData>;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onSaveSettings?: (settings: UserSettingsData) => void;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function SettingsView({ initialSettings, forcedState = 'success', forcedErrorCode = 'INTERNAL_ERROR', onSaveSettings }: SettingsViewProps) {
  const [dailyMinutes, setDailyMinutes] = useState<number>(initialSettings?.dailyTargetMinutes ?? 25);
  const [newWordsBudget, setNewWordsBudget] = useState<number>(initialSettings?.newWordsBudgetPerDay ?? 4);
  const [theme, setTheme] = useState<ThemeMode>(initialSettings?.theme ?? 'light');
  const [reducedMotion, setReducedMotion] = useState<boolean>(initialSettings?.reducedMotion ?? false);
  const [audioAutoplay, setAudioAutoplay] = useState<boolean>(initialSettings?.audioAutoplay ?? true);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('lingua-theme');
    if (isThemeMode(storedTheme)) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };

    window.localStorage.setItem('lingua-theme', theme);
    applyTheme();

    if (theme !== 'system') return undefined;
    const onChange = () => applyTheme();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const handleSave = () => {
    const updated: UserSettingsData = { dailyTargetMinutes: dailyMinutes, newWordsBudgetPerDay: newWordsBudget, theme, reducedMotion, audioAutoplay };
    onSaveSettings?.(updated);
    setSavedNotification('Đã lưu cài đặt trên thiết bị này.');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { setSavedNotification(null); saveTimerRef.current = null; }, 3000);
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

  const Switch = ({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) => (
    <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onClick} className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${checked ? 'justify-end bg-[var(--action-primary)]' : 'justify-start bg-[var(--border-default)]'}`}>
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="min-w-0">
        <h1 className="text-[28px] font-black leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-4xl">Cài đặt</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">Tùy chỉnh trải nghiệm học và quản lý tài khoản của bạn.</p>
      </header>

      {savedNotification && <InlineAlert variant="success" title="Đã lưu">{savedNotification}</InlineAlert>}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <AccountSecurityCard />
          <Card padding="lg" className="min-w-0 rounded-[26px] bg-[var(--surface-warm)]">
            <h2 className="text-lg font-black tracking-[-0.02em] text-[var(--text-primary)]">Mục tiêu mỗi ngày</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Điều chỉnh nhịp học để phù hợp với thời gian và sức học của bạn.</p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card padding="lg" className="min-w-0 rounded-[26px]">
            <div className="flex min-w-0 flex-col gap-5">
              <section className="min-w-0 border-b border-[var(--border-subtle)] pb-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-[var(--text-primary)]">Thời lượng học mỗi ngày</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Thời gian dành cho kế hoạch học trong ngày.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-blue)] px-3 py-1.5 text-xs font-extrabold text-[var(--action-primary)]">{dailyMinutes} phút / ngày</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[10, 20, 25, 45].map((mins) => <button key={mins} type="button" onClick={() => setDailyMinutes(mins)} className={optionClass(dailyMinutes === mins)}>{mins} phút</button>)}</div>
              </section>

              <section className="min-w-0">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-[var(--text-primary)]">Từ mới mỗi ngày</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Giới hạn lượng từ mới để tránh học quá tải.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--accent-teal-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-teal-strong)]">{newWordsBudget} từ / ngày</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[2, 4, 6, 8].map((count) => <button key={count} type="button" onClick={() => setNewWordsBudget(count)} className={optionClass(newWordsBudget === count)}>{count} từ</button>)}</div>
              </section>
            </div>
          </Card>

          <Card padding="lg" className="min-w-0 rounded-[26px]">
            <h3 className="text-lg font-black tracking-[-0.02em] text-[var(--text-primary)]">Giao diện & Trợ năng</h3>

            <div className="mt-5 space-y-1">
              <div className="border-b border-[var(--border-subtle)] py-4">
                <span className="text-sm font-bold text-[var(--text-primary)]">Chế độ hiển thị</span>
                <div className="mt-3 grid grid-cols-3 gap-2">{(['light', 'dark', 'system'] as const).map((t) => <button key={t} type="button" onClick={() => setTheme(t)} className={optionClass(theme === t)}>{t === 'light' ? 'Sáng' : t === 'dark' ? 'Tối' : 'Hệ thống'}</button>)}</div>
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

          <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-[0_12px_34px_rgba(33,45,78,0.16)] md:static md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <Button className="w-full md:w-auto" variant="primary" size="md" leftIcon={<Save className="h-4 w-4" />} onClick={handleSave}>Lưu cài đặt</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
