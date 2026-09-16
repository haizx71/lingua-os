'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, InlineAlert, Badge, LoadingState, ErrorState } from '@lingua/ui';
import { Save } from 'lucide-react';
import { PERSISTENCE_GAPS, type ApiErrorCode } from '@lingua/types';
import { AccountSecurityCard } from './AccountSecurityCard';

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
  theme: 'light' | 'dark' | 'system';
  reducedMotion: boolean;
  audioAutoplay: boolean;
}

export interface SettingsViewProps {
  initialSettings?: Partial<UserSettingsData>;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onSaveSettings?: (settings: UserSettingsData) => void;
}

export function SettingsView({ initialSettings, forcedState = 'success', forcedErrorCode = 'INTERNAL_ERROR', onSaveSettings }: SettingsViewProps) {
  const [dailyMinutes, setDailyMinutes] = useState<number>(initialSettings?.dailyTargetMinutes ?? 25);
  const [newWordsBudget, setNewWordsBudget] = useState<number>(initialSettings?.newWordsBudgetPerDay ?? 4);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialSettings?.theme ?? 'light');
  const [reducedMotion, setReducedMotion] = useState<boolean>(initialSettings?.reducedMotion ?? false);
  const [audioAutoplay, setAudioAutoplay] = useState<boolean>(initialSettings?.audioAutoplay ?? true);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const handleSave = () => {
    const updated: UserSettingsData = { dailyTargetMinutes: dailyMinutes, newWordsBudgetPerDay: newWordsBudget, theme, reducedMotion, audioAutoplay };
    onSaveSettings?.(updated);
    setSavedNotification('Đã lưu tùy chọn cục bộ. Các mục máy chủ chưa được đồng bộ.');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { setSavedNotification(null); saveTimerRef.current = null; }, 3000);
  };

  const handleRetry = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setCurrentState('loading');
    retryTimerRef.current = setTimeout(() => { setCurrentState('success'); retryTimerRef.current = null; }, 400);
  };

  if (currentState === 'loading') return <LoadingState message="Đang nạp cài đặt hệ thống..." count={3} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;

  const optionClass = (active: boolean) => `min-h-11 rounded-2xl border px-3 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active
    ? 'border-[var(--action-primary)]/25 bg-[var(--surface-blue)] text-[var(--action-primary)]'
    : 'border-[var(--border-subtle)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'}`;

  const Switch = ({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) => (
    <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onClick} className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${checked ? 'justify-end bg-[var(--action-primary)]' : 'justify-start bg-[var(--border-default)]'}`}>
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="min-w-0">
        <div className="lingua-kicker text-[var(--action-primary)]">Preferences & Account</div>
        <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-4xl">Cài đặt hệ thống</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">Tùy chỉnh việc học và quản lý bảo mật tài khoản LINGUA OS.</p>
      </header>

      {savedNotification && <InlineAlert variant="success" title="Thành công">{savedNotification}</InlineAlert>}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <AccountSecurityCard />
          <Card padding="lg" className="min-w-0 rounded-[26px] bg-[var(--surface-warm)]">
            <div className="lingua-kicker text-[#9b773f]">Learning rhythm</div>
            <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-[var(--text-primary)]">Mục tiêu mỗi ngày</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Các lựa chọn dưới đây chỉ thay đổi trải nghiệm cục bộ khi backend chưa có persistence tương ứng.</p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card padding="lg" className="min-w-0 rounded-[26px]">
            <div className="flex min-w-0 flex-col gap-5">
              <section className="min-w-0 border-b border-[var(--border-subtle)] pb-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-extrabold text-[var(--text-primary)]">Thời lượng học mỗi ngày</h2><Badge variant="neutral" size="sm">NOT_YET_PERSISTED</Badge></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Thời gian Today Engine phân bổ cho các hoạt động.</p></div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-blue)] px-3 py-1.5 text-xs font-extrabold text-[var(--action-primary)]">{dailyMinutes} phút / ngày</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[10, 20, 25, 45].map((mins) => <button key={mins} type="button" onClick={() => setDailyMinutes(mins)} className={optionClass(dailyMinutes === mins)}>{mins} phút</button>)}</div>
              </section>

              <section className="min-w-0">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-extrabold text-[var(--text-primary)]">Ngân sách từ mới mỗi ngày</h2><Badge variant="neutral" size="sm">DEFERRED</Badge></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Giới hạn concept mới để tránh quá tải trí nhớ.</p></div>
                  <span className="shrink-0 rounded-full bg-[var(--accent-teal-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-teal-strong)]">{newWordsBudget} từ / ngày</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[2, 4, 6, 8].map((count) => <button key={count} type="button" onClick={() => setNewWordsBudget(count)} className={optionClass(newWordsBudget === count)}>{count} từ</button>)}</div>
              </section>
            </div>
          </Card>

          <Card padding="lg" className="min-w-0 rounded-[26px]">
            <div className="lingua-kicker text-[var(--accent-teal-strong)]">Accessibility</div>
            <h3 className="mt-1 text-lg font-black tracking-[-0.02em] text-[var(--text-primary)]">Giao diện & Trợ năng</h3>

            <div className="mt-5 space-y-1">
              <div className="border-b border-[var(--border-subtle)] py-4">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-[var(--text-primary)]">Chế độ hiển thị</span><Badge variant="neutral" size="sm">LOCAL_ONLY</Badge></div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Giao diện tối ưu độ tương phản WCAG 2.2 AA.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">{(['light', 'dark', 'system'] as const).map((t) => <button key={t} type="button" onClick={() => setTheme(t)} className={optionClass(theme === t)}>{t === 'light' ? 'Sáng' : t === 'dark' ? 'Tối' : 'Hệ thống'}</button>)}</div>
              </div>

              <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-4">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-[var(--text-primary)]">Giảm chuyển động</span><Badge variant="neutral" size="sm">LOCAL_ONLY</Badge></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Giảm hiệu ứng hoạt hình và chuyển cảnh.</p></div>
                <Switch checked={reducedMotion} onClick={() => setReducedMotion(!reducedMotion)} label="Giảm chuyển động" />
              </div>

              <div className="flex min-w-0 items-center justify-between gap-4 py-4">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-[var(--text-primary)]">Tự động phát âm thanh trong Review</span><Badge variant="neutral" size="sm">LOCAL_ONLY</Badge></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Phát âm từ vựng ngay khi lật thẻ.</p></div>
                <Switch checked={audioAutoplay} onClick={() => setAudioAutoplay(!audioAutoplay)} label="Tự động phát âm thanh trong Review" />
              </div>
            </div>
          </Card>

          <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 rounded-[22px] border border-[var(--border-subtle)] bg-white/90 p-2 shadow-[0_12px_34px_rgba(33,45,78,0.16)] backdrop-blur-xl md:static md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
            <Button className="w-full md:w-auto" variant="primary" size="md" leftIcon={<Save className="h-4 w-4" />} onClick={handleSave}>Lưu cài đặt</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
