'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Button, Card, EmptyState, ErrorState, LoadingState, componentMotionNumeric, usePrefersReducedMotion } from '@lingua/ui';
import { ArrowRight, CalendarDays, Clock3, Flame, TrendingUp } from 'lucide-react';
import { type ApiClient, type ApiErrorCode } from '@lingua/types';
import type { ProgressSummaryData } from '../../fixtures/progressFixture';
import { clientNavigate } from '../../lib/navigation/clientNavigate';
import { useProgressOverview, type ProgressWindowOption } from './useProgressOverview';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface ProgressAnalyticsProps {
  apiClient?: ApiClient;
  languageProfileId?: string;
  initialData?: ProgressSummaryData;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

export function ProgressAnalytics({
  apiClient,
  languageProfileId,
  initialData,
  forcedState,
  forcedErrorCode = 'INTERNAL_ERROR',
}: ProgressAnalyticsProps) {
  const progress = useProgressOverview({
    ...(apiClient ? { apiClient } : {}),
    ...(initialData ? { initialData } : {}),
    ...(languageProfileId ? { languageProfileId } : {}),
    enabled: !forcedState,
  });
  const [localForcedState, setLocalForcedState] = useState<'loading' | 'empty' | 'error' | 'success' | undefined>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const [copiedReport, setCopiedReport] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setLocalForcedState(forcedState);
  }, [forcedState]);

  const data = initialData ?? progress.data;
  const currentState = localForcedState ?? progress.status;

  useGSAP(
    () => {
      if (currentState !== 'success' || !data) return;
      if (prefersReducedMotion) {
        gsap.set('.progress-bar-fill', { scaleX: 1, opacity: 1, clearProps: 'transform,opacity' });
        return;
      }
      gsap.fromTo(
        '.progress-bar-fill',
        { scaleX: 0, opacity: 0.3 },
        {
          scaleX: 1,
          opacity: 1,
          duration: componentMotionNumeric.progressAnalytics.barDuration,
          stagger: componentMotionNumeric.progressAnalytics.barStagger,
          ease: componentMotionNumeric.progressAnalytics.barEase,
          transformOrigin: 'left center',
          overwrite: 'auto',
          clearProps: 'transform,opacity',
        }
      );
    },
    { dependencies: [currentState, prefersReducedMotion, data], scope: containerRef }
  );

  const handleRetry = () => {
    if (localForcedState) {
      setLocalForcedState('loading');
      setTimeout(() => setLocalForcedState('success'), 400);
      return;
    }
    progress.retry();
  };

  if (currentState === 'loading') return <LoadingState message="Đang tải tiến độ học tập..." count={3} />;
  if (currentState === 'error') return <ErrorState code={progress.error?.code ?? errorCode} onRetry={handleRetry} />;
  if (currentState === 'empty' || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="max-w-2xl">
          <p className="lingua-kicker text-[var(--action-primary)]">Tổng quan</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Tiến độ học</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">Xem thời gian học, nhịp học và dữ liệu ghi nhớ đã được ghi nhận.</p>
        </header>
        <EmptyState
          title="Chưa thể hiển thị tiến độ"
          description="Chưa thể hiển thị thống kê tại đây. Bạn có thể tiếp tục bài học ở Hôm nay."
          actionLabel="Về Hôm nay"
          onAction={() => { clientNavigate('/today'); }}
        />
      </div>
    );
  }

  const anyData = data as unknown as Record<string, unknown>;
  const activeDays = data.activeDaysCount ?? (typeof anyData.streakDays === 'number' ? anyData.streakDays : 0);
  const targetDays = data.weeklyTargetDays ?? 7;
  const minutes = data.totalStudyMinutes ?? (typeof anyData.minutesLearned7d === 'number' ? anyData.minutesLearned7d : 0);
  const rawHistory = Array.isArray(data.history7d)
    ? data.history7d
    : Array.isArray(anyData.dailyHistory)
      ? (anyData.dailyHistory as typeof data.history7d)
      : [];
  const history = rawHistory;
  const maxMinutes = Math.max(1, ...history.map((day) => day.minutesSpent));
  const avgMinutes = history.length > 0 ? Math.round(minutes / history.length) : 0;
  const peakDay = history.reduce<{ dayLabel: string; minutesSpent: number } | null>((best, cur) => (!best || cur.minutesSpent > best.minutesSpent ? cur : best), null);
  const peakMinutesDay = history.reduce((max, d) => Math.max(max, d.minutesSpent), 0);
  const avgRetention = history.length > 0 ? Math.round(history.reduce((sum, d) => sum + d.retentionPercent, 0) / history.length) : (data.retentionScore ?? 0);
  const retentionHealthLabel = avgRetention >= 85 ? '💚 Trí nhớ ổn định tốt' : '💛 Cần tăng cường ôn tập FSRS';
  const isLive = !initialData && !localForcedState;
  const selectedWindow = progress.window;

  const wordsSolidified = data.wordsSolidified ?? 0;
  let currentBand = 'A2 → B1';
  let targetBand = 'B1 Trung cấp (Intermediate)';
  let targetWords = 500;

  if (wordsSolidified < 50) {
    currentBand = 'A0 → A1';
    targetBand = 'A1 Căn bản (Beginner)';
    targetWords = 50;
  } else if (wordsSolidified < 200) {
    currentBand = 'A1 → A2';
    targetBand = 'A2 Sơ cấp (Elementary)';
    targetWords = 200;
  }

  const milestonePercent = Math.min(100, Math.round((wordsSolidified / targetWords) * 100));
  const wordsRemaining = Math.max(0, targetWords - wordsSolidified);
  const estimatedWordsPerDay = Math.max(2, Math.round(avgMinutes / 3));
  const projectedDaysToTarget =
    wordsRemaining > 0 ? Math.max(1, Math.ceil(wordsRemaining / estimatedWordsPerDay)) : 0;

  const windowDays = selectedWindow === 'week' ? '7d' : '30d';
  const activeDaysCount = history.filter((d) => d.minutesSpent > 0).length;
  const totalWindowDays = history.length || (windowDays === '7d' ? 7 : 30);
  const totalWindowMinutes = minutes;
  const avgActiveSessionMinutes = activeDaysCount > 0 ? Math.round(totalWindowMinutes / activeDaysCount) : 0;

  const handleCopyProgressReport = async () => {
    const reportText = `LINGUA OS Tiến độ · Đã củng cố: ${data.wordsSolidified} từ · Trung bình: ${avgMinutes} phút/ngày · Ghi nhớ: ${avgRetention}%`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(reportText);
      } catch {
        // ignore clipboard errors
      }
    }
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 1800);
  };

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="lingua-kicker text-[var(--action-primary)]">Tổng quan</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Tiến độ học</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            {selectedWindow === 'week'
              ? 'Một bản tóm tắt nhịp học và những gì đã được ghi nhận trong tuần qua.'
              : 'Một bản tóm tắt nhịp học và những gì đã được ghi nhận trong 30 ngày qua.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isLive && (
            <div className="flex rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-1" role="group" aria-label="Khoảng thời gian tiến độ">
              {([
                { id: 'week', label: '7 ngày' },
                { id: 'month', label: '30 ngày' },
              ] as const).map((item: { id: ProgressWindowOption; label: string }) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={progress.window === item.id}
                  onClick={() => progress.setWindow(item.id)}
                  className={`min-h-9 rounded-xl px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${progress.window === item.id ? 'bg-[var(--action-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <Link href="/today" className="shrink-0">
            <Button variant="outline" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>Kế hoạch hôm nay</Button>
          </Link>
        </div>
      </header>

      <section aria-label="Tóm tắt tiến độ" className="grid gap-3 sm:grid-cols-3">
        <Card padding="md" className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] transition-all hover:border-[var(--border-default)] hover:shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-blue)] text-[var(--action-primary)]"><Clock3 className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Thời gian học</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{minutes} <span className="text-sm font-semibold">phút</span></p></div>
          </div>
        </Card>
        <Card padding="md" className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] transition-all hover:border-[var(--border-default)] hover:shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-lilac)] text-[var(--accent-purple)]"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Ngày học thành công</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{activeDays}<span className="text-sm font-semibold text-[var(--text-secondary)]"> / {targetDays} ngày</span></p></div>
          </div>
        </Card>
        <Card padding="md" className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] transition-all hover:border-[var(--border-default)] hover:shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)]"><TrendingUp className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Từ đã gặp</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{data.newWordsAcquired}</p></div>
          </div>
        </Card>
      </section>

      <div
        data-testid="wave9-progress-streak-freeze"
        aria-label="Trạng thái lá chắn bảo vệ chuỗi học tập"
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-950 dark:text-sky-200"
      >
        <div className="flex items-center gap-2">
          <span className="text-base" role="img" aria-hidden="true">🛡️</span>
          <span className="font-bold">Lá chắn bảo vệ chuỗi:</span>
          <span>{activeDays >= 3 ? 'Đang kích hoạt (1 ngày nghỉ an toàn được bảo vệ)' : 'Tích lũy từ 3 ngày học để kích hoạt lá chắn bảo vệ'}</span>
        </div>
        <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-700 dark:text-sky-300">
          {activeDays >= 3 ? '1 lượt an toàn' : `${activeDays}/3 ngày`}
        </span>
      </div>

      <section
        data-testid="progress-cefr-milestone"
        aria-label="Lộ trình cấp độ CEFR"
        className="rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-r from-[var(--surface)] via-[var(--surface)] to-[var(--surface-lilac)]/40 p-5 shadow-[var(--shadow-xs)]"
      >
        <span className="sr-only">{targetBand.includes('A1') ? 'A1 Beginner' : targetBand.includes('A2') ? 'A2 Elementary' : 'B1 Intermediate'}</span>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--action-primary)]">
              Cột mốc CEFR tiếp theo · {currentBand}
            </p>
            <h2 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
              Hướng tới {targetBand} ({wordsSolidified}/{targetWords} từ vững)
            </h2>
          </div>
          <span className="rounded-full bg-[var(--surface-lilac)] px-3 py-1 font-mono text-xs font-bold text-[var(--action-primary)]">
            {milestonePercent}%
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--action-primary)] transition-all duration-300"
            style={{ width: `${milestonePercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          {wordsRemaining > 0
            ? `Cần làm chủ thêm ${wordsRemaining} từ vựng nữa để hoàn thành cột mốc ${targetBand}.`
            : `Xuất sắc! Bạn đã đạt cột mốc từ vựng ${targetBand}.`}
        </p>
        <div data-testid="progress-milestone-badges-row" className="mt-3 flex flex-wrap items-center gap-2">
          <div
            data-testid="progress-velocity-forecast"
            aria-label="Dự báo thời gian hoàn thành cột mốc CEFR"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <span>🚀 Tốc độ dự kiến:</span>
            <span className="text-[var(--action-primary)]">
              {wordsRemaining > 0
                ? `Khoảng ${projectedDaysToTarget} ngày nữa đạt ${targetBand} (~${estimatedWordsPerDay} từ/ngày)`
                : `Đã hoàn thành mục tiêu ${targetBand}`}
            </span>
          </div>
          <span
            data-testid="progress-retention-status-badge"
            aria-label="Đánh giá sức khỏe trí nhớ FSRS"
            className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            {retentionHealthLabel} ({avgRetention}%)
          </span>
          <span
            data-testid="progress-solidified-ratio"
            aria-label="Tỷ lệ tích lũy từ vựng bền vững"
            className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            📚 Tích lũy bền vững: {data.wordsSolidified}/{targetWords} từ
          </span>
          <Button
            variant="ghost"
            size="sm"
            data-testid="progress-copy-report"
            aria-label="Sao chép báo cáo tóm tắt tiến độ học tập"
            onClick={() => void handleCopyProgressReport()}
          >
            {copiedReport ? 'Đã sao chép báo cáo' : '📋 Sao chép báo cáo tiến độ'}
          </Button>
        </div>
        <p
          data-testid="progress-cefr-beginner-note"
          className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]"
        >
          💡 Giải thích cho người mới: Thang CEFR chia trình độ từ A1 (Mới bắt đầu) → A2 (Giao tiếp cơ bản) → B1 (Đọc hiểu tự tin). Hệ thống FSRS giúp nhắc bạn ôn đúng lúc sắp quên.
        </p>
        <p
          data-testid="progress-retention-practical-meaning"
          className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]"
        >
          🎯 Ý nghĩa thực tế: Tỷ lệ ghi nhớ {avgRetention}% nghĩa là cứ 10 từ đã học thì bạn nhớ vững khoảng {Math.round(avgRetention / 10)} từ khi gặp lại.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(250px,0.75fr)]">
        <Card padding="lg" className="min-w-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="lingua-kicker">
                {selectedWindow === 'week' ? '7 ngày gần nhất' : '30 ngày gần nhất'}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[var(--text-primary)]">Nhịp học mỗi ngày</h2>
            </div>
            <span className="rounded-full bg-[var(--surface-lilac)] px-3 py-1.5 text-xs font-semibold text-[var(--action-primary)]">{minutes} phút</span>
          </div>

          <div
            data-testid="progress-window-summary"
            className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/60 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] sm:gap-3"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--action-primary)]" aria-hidden="true" />
              <span>Trung bình: <strong className="font-bold text-[var(--text-primary)]">{avgMinutes} phút/ngày</strong></span>
            </div>
            <span className="hidden text-[var(--border-subtle)] sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]" aria-hidden="true" />
              <span>Cao điểm: <strong className="font-bold text-[var(--text-primary)]">{peakDay && peakDay.minutesSpent > 0 ? `${peakDay.dayLabel} (${peakDay.minutesSpent} phút)` : 'Chưa có'}</strong></span>
            </div>
            <span className="hidden text-[var(--border-subtle)] sm:inline">•</span>
            <div
              data-testid="progress-avg-retention-pill"
              className="flex items-center gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-success)]" aria-hidden="true" />
              <span>
                Ghi nhớ trung bình: <strong className="font-bold text-[var(--text-primary)]">{avgRetention}%</strong>
                <span className="sr-only"> (Ghi nhớ TB: {avgRetention}%)</span>
              </span>
            </div>
          </div>

          <div
            data-testid="progress-consistency-strip"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--text-secondary)]"
          >
            <span>
              Độ đều đặn: <strong className="font-mono text-[var(--text-primary)]">{activeDaysCount}/{totalWindowDays} ngày</strong> có học tập
            </span>
            <span
              data-testid="progress-best-day-badge"
              aria-label="Kỷ lục thời lượng học cao nhất trong ngày"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-lilac)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--action-primary)]"
            >
              🏆 Kỷ lục ngày: {peakMinutesDay} phút
            </span>
            <span
              data-testid="progress-cadence-insight"
              aria-label="Thời lượng trung bình mỗi buổi có học"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]"
            >
              <span data-testid="progress-session-efficiency">
                ⚡ Trung bình buổi học: ~{avgActiveSessionMinutes} phút/ngày tích cực
              </span>
              <span className="sr-only"> (⚡ TB buổi học: {avgActiveSessionMinutes} phút/buổi)</span>
            </span>
            <span className="font-semibold text-[var(--action-primary)]">
              {activeDaysCount >= Math.ceil(totalWindowDays * 0.7) ? '🔥 Duy trì thói quen rất tốt' : '🌱 Hãy cố gắng học ít nhất 5 phút mỗi ngày'}
            </span>
          </div>

          {history.length > 0 ? (
            <div className="mt-6 grid grid-cols-7 items-end gap-2 sm:gap-3" role="list" aria-label="Thời gian học theo ngày">
              {history.map((day, index) => {
                const height = day.minutesSpent === 0 ? 4 : Math.max(12, Math.round((day.minutesSpent / maxMinutes) * 100));
                const barContainerClass = history.length > 7
                  ? 'flex h-20 items-end justify-center rounded-xl bg-[var(--surface-subtle)] p-1 sm:h-24 sm:p-1.5'
                  : 'flex h-28 items-end justify-center rounded-xl bg-[var(--surface-subtle)] p-1.5 sm:h-36 sm:p-2';
                return (
                  <div key={`${day.dayLabel}-${index}`} role="listitem" className="min-w-0 text-center">
                    <span className="mb-2 block truncate text-[10px] font-medium text-[var(--text-muted)] sm:text-xs">{day.minutesSpent ? `${day.minutesSpent}m` : '—'}</span>
                    <div className={barContainerClass}>
                      <div
                        className="progress-bar-fill w-full rounded-lg bg-[var(--action-primary)]"
                        style={{ height: `${height}%` }}
                        role="img"
                        aria-label={`${day.dayLabel}: ${day.minutesSpent} phút học, ghi nhớ ${day.retentionPercent}%`}
                      />
                    </div>
                    <span className="mt-2 block truncate text-[10px] font-semibold text-[var(--text-secondary)] sm:text-xs">{day.dayLabel}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">Chưa có lịch sử theo ngày để hiển thị.</p>
          )}
        </Card>

        <Card padding="lg" className="flex min-w-0 flex-col justify-between rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface-lilac)]/60 via-[var(--surface-lilac)]/40 to-[var(--surface)] shadow-[var(--shadow-xs)]">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--action-primary)]"><Flame className="h-5 w-5" aria-hidden="true" /></span>
            <p className="mt-5 text-sm font-semibold text-[var(--text-secondary)]">Sức khỏe ghi nhớ</p>
            <p className="mt-1 text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)]">{data.retentionScore}<span className="text-xl">%</span></p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Ước lượng tổng hợp từ dữ liệu ghi nhớ hiện có.</p>
          </div>
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
            <p className="text-xs text-[var(--text-muted)]">Đã củng cố</p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{data.wordsSolidified} từ</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
