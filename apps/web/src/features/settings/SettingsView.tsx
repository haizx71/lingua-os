'use client';

import React, { useState } from 'react';
import {
  Card,
  Button,
  InlineAlert,
  Badge,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@lingua/ui';
import {
  Settings,
  Shield,
  Bell,
  Moon,
  Sun,
  Volume2,
  Sliders,
  Check,
  Save,
} from 'lucide-react';
import { PERSISTENCE_GAPS, type ApiErrorCode } from '@lingua/types';

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

export function SettingsView({
  initialSettings,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSaveSettings,
}: SettingsViewProps) {
  const [dailyMinutes, setDailyMinutes] = useState<number>(
    initialSettings?.dailyTargetMinutes ?? 25
  );
  const [newWordsBudget, setNewWordsBudget] = useState<number>(
    initialSettings?.newWordsBudgetPerDay ?? 4
  );
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(
    initialSettings?.theme ?? 'light'
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    initialSettings?.reducedMotion ?? false
  );
  const [audioAutoplay, setAudioAutoplay] = useState<boolean>(
    initialSettings?.audioAutoplay ?? true
  );

  const [savedNotification, setSavedNotification] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const handleSave = () => {
    const updated: UserSettingsData = {
      dailyTargetMinutes: dailyMinutes,
      newWordsBudgetPerDay: newWordsBudget,
      theme,
      reducedMotion,
      audioAutoplay,
    };
    if (onSaveSettings) {
      onSaveSettings(updated);
    }
    setSavedNotification('Đã lưu tùy chọn cục bộ. Các mục máy chủ chưa được đồng bộ.');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => {
      setCurrentState('success');
    }, 400);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang nạp cài đặt hệ thống..." count={3} />;
  }

  if (currentState === 'error') {
    return <ErrorState code={errorCode} onRetry={handleRetry} />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <header>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
          Preferences & Account
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Cài đặt hệ thống
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Tùy chỉnh thời gian học mỗi ngày, ngôn ngữ và tùy chọn trợ năng.
        </p>
      </header>

      {savedNotification && (
        <InlineAlert variant="success" title="Thành công">
          {savedNotification}
        </InlineAlert>
      )}

      {/* Learning Goal Settings */}
      <Card variant="default" padding="lg" className="space-y-5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Mục tiêu học tập hàng ngày
        </h2>

        {/* Daily Target Minutes */}
        <div className="space-y-2 py-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Thời lượng học mỗi ngày
                </span>
                <Badge variant="neutral" size="sm">NOT_YET_PERSISTED</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Thời gian Today Engine phân bổ cho các hoạt động
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--action-primary)]">
              {dailyMinutes} phút / ngày
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {[10, 20, 25, 45].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDailyMinutes(mins)}
                className={`py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  dailyMinutes === mins
                    ? 'bg-[var(--status-info-bg)] border-[var(--action-primary)] text-[var(--action-primary)]'
                    : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                }`}
              >
                {mins} phút
              </button>
            ))}
          </div>
        </div>

        {/* New Words Budget */}
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Ngân sách từ mới mỗi ngày
                </span>
                <Badge variant="neutral" size="sm">DEFERRED</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Giới hạn số concept mới để tránh quá tải trí nhớ
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--action-primary)]">
              {newWordsBudget} từ mới / ngày
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {[2, 4, 6, 8].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setNewWordsBudget(count)}
                className={`py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  newWordsBudget === count
                    ? 'bg-[var(--status-info-bg)] border-[var(--action-primary)] text-[var(--action-primary)]'
                    : 'bg-[var(--surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                }`}
              >
                {count} từ
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Interface & Accessibility Preferences */}
      <Card variant="default" padding="lg" className="space-y-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Giao diện & Trợ năng (A11y)
        </h3>

        {/* Theme selector */}
        <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Chế độ hiển thị
              </span>
              <Badge variant="neutral" size="sm">LOCAL_ONLY</Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Giao diện tối ưu độ tương phản WCAG 2.2 AA
            </p>
          </div>
          <div className="flex items-center gap-1 bg-[var(--surface-subtle)] p-1 rounded-xl border border-[var(--border-subtle)]">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  theme === t
                    ? 'bg-[var(--surface)] text-[var(--action-primary)] font-bold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t === 'light' ? 'Sáng' : t === 'dark' ? 'Tối' : 'Hệ thống'}
              </button>
            ))}
          </div>
        </div>

        {/* Reduced motion toggle */}
        <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Giảm chuyển động (Reduced Motion)
              </span>
              <Badge variant="neutral" size="sm">LOCAL_ONLY</Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Tắt tất cả hiệu ứng hoạt hình và chuyển cảnh
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              reducedMotion ? 'bg-[var(--action-primary)] justify-end' : 'bg-[var(--border-default)] justify-start'
            }`}
          >
            <div className="bg-[var(--surface)] w-4 h-4 rounded-full shadow-md transform" />
          </button>
        </div>

        {/* Audio Autoplay */}
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Tự động phát âm thanh trong Review
              </span>
              <Badge variant="neutral" size="sm">LOCAL_ONLY</Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Phát âm từ vựng ngay khi lật thẻ
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={audioAutoplay}
            onClick={() => setAudioAutoplay(!audioAutoplay)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              audioAutoplay ? 'bg-[var(--action-primary)] justify-end' : 'bg-[var(--border-default)] justify-start'
            }`}
          >
            <div className="bg-[var(--surface)] w-4 h-4 rounded-full shadow-md transform" />
          </button>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="md"
          leftIcon={<Save className="w-4 h-4" />}
          onClick={handleSave}
        >
          Lưu cài đặt
        </Button>
      </div>
    </div>
  );
}
