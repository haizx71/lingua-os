'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Button, Card, EmptyState, ErrorState, LoadingState, componentMotionNumeric, usePrefersReducedMotion } from '@lingua/ui';
import { ArrowRight, CalendarDays, Clock3, Flame, TrendingUp } from 'lucide-react';
import { type ApiErrorCode } from '@lingua/types';
import type { ProgressSummaryData } from '../../fixtures/progressFixture';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface ProgressAnalyticsProps {
  initialData?: ProgressSummaryData;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

export function ProgressAnalytics({
  initialData,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
}: ProgressAnalyticsProps) {
  const [data] = useState<ProgressSummaryData | undefined>(initialData);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (currentState !== 'success') return;
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
    { dependencies: [currentState, prefersReducedMotion], scope: containerRef }
  );

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => setCurrentState('success'), 400);
  };

  if (currentState === 'loading') return <LoadingState message="Đang tải tiến độ học tập..." count={3} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;
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
          onAction={() => { window.location.href = '/today'; }}
        />
      </div>
    );
  }

  const activeDays = data.activeDaysCount;
  const targetDays = data.weeklyTargetDays;
  const minutes = data.totalStudyMinutes;
  const history = data.history7d;
  const maxMinutes = Math.max(1, ...history.map((day) => day.minutesSpent));

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="lingua-kicker text-[var(--action-primary)]">Tổng quan</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Tiến độ học</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">Một bản tóm tắt nhịp học và những gì đã được ghi nhận trong tuần qua.</p>
        </div>
        <Link href="/today" className="shrink-0">
          <Button variant="outline" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>Kế hoạch hôm nay</Button>
        </Link>
      </header>

      <section aria-label="Tóm tắt tiến độ" className="grid gap-3 sm:grid-cols-3">
        <Card padding="md" className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-blue)] text-[var(--action-primary)]"><Clock3 className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Thời gian học</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{minutes} <span className="text-sm font-semibold">phút</span></p></div>
          </div>
        </Card>
        <Card padding="md" className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-lilac)] text-[var(--accent-purple)]"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Ngày học thành công</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{activeDays}<span className="text-sm font-semibold text-[var(--text-secondary)]"> / {targetDays} ngày</span></p></div>
          </div>
        </Card>
        <Card padding="md" className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)]"><TrendingUp className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Từ đã gặp</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{data.newWordsAcquired}</p></div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(250px,0.75fr)]">
        <Card padding="lg" className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="lingua-kicker">7 ngày gần nhất</p><h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[var(--text-primary)]">Nhịp học mỗi ngày</h2></div>
            <span className="rounded-full bg-[var(--surface-lilac)] px-3 py-1.5 text-xs font-semibold text-[var(--action-primary)]">{minutes} phút</span>
          </div>
          {history.length > 0 ? (
            <div className="mt-6 grid grid-cols-7 items-end gap-2 sm:gap-3" role="list" aria-label="Thời gian học theo ngày">
              {history.map((day, index) => {
                const height = day.minutesSpent === 0 ? 4 : Math.max(12, Math.round((day.minutesSpent / maxMinutes) * 100));
                return (
                  <div key={`${day.dayLabel}-${index}`} role="listitem" className="min-w-0 text-center">
                    <span className="mb-2 block truncate text-[10px] font-medium text-[var(--text-muted)] sm:text-xs">{day.minutesSpent ? `${day.minutesSpent}m` : '—'}</span>
                    <div className="flex h-28 items-end justify-center rounded-xl bg-[var(--surface-subtle)] p-1.5 sm:h-36 sm:p-2">
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

        <Card padding="lg" className="flex min-w-0 flex-col justify-between bg-[var(--surface-lilac)]">
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
