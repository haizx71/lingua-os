'use client';

import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  componentMotionNumeric,
  usePrefersReducedMotion,
} from '@lingua/ui';
import { Calendar, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import type { ApiErrorCode, ProgressSummaryViewModel, UiErrorState } from '@lingua/types';
import type { ProgressSummaryData } from '../../fixtures/progressFixture';
import { useProgress, type ProgressLoadStatus, type ProgressWindow } from './useProgress';

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP);

export interface ProgressAnalyticsProps {
  /** Story/test-only presentation override. Production callers should omit this. */
  initialData?: ProgressSummaryData;
  /** Story/test-only state override. Production callers should omit this. */
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

interface ProgressViewProps {
  readonly data: ProgressSummaryViewModel | null;
  readonly status: ProgressLoadStatus;
  readonly error: UiErrorState | null;
  readonly window: ProgressWindow;
  setWindow(window: ProgressWindow): void;
  retry(): void;
}

export function ProgressAnalytics(props: ProgressAnalyticsProps) {
  if (props.initialData !== undefined || props.forcedState !== undefined) {
    return <ControlledProgressAnalytics {...props} />;
  }
  return <LiveProgressAnalytics />;
}

function LiveProgressAnalytics() {
  const progress = useProgress();
  return <ProgressView {...progress} />;
}

function ControlledProgressAnalytics({
  initialData,
  forcedState,
  forcedErrorCode = 'INTERNAL_ERROR',
}: ProgressAnalyticsProps) {
  const [timeWindow, setWindow] = useState<ProgressWindow>('7d');
  const status = forcedState ?? (initialData ? 'success' : 'empty');
  const error: UiErrorState | null =
    status === 'error'
      ? {
          code: forcedErrorCode,
          message: 'Không thể tải dữ liệu tiến độ.',
          retryable: true,
        }
      : null;
  return (
    <ProgressView
      data={initialData ?? null}
      status={status}
      error={error}
      window={timeWindow}
      setWindow={setWindow}
      retry={() => undefined}
    />
  );
}

function ProgressView({ data, status, error, window: timeWindow, setWindow, retry }: ProgressViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (status !== 'success' || !data) return;
      if (prefersReducedMotion) {
        gsap.set('.analytics-bar-fill', { scaleX: 1, opacity: 1, clearProps: 'transform,opacity' });
        return;
      }
      gsap.fromTo(
        '.analytics-bar-fill',
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
    { dependencies: [timeWindow, status, data, prefersReducedMotion], scope: containerRef }
  );

  if (status === 'loading') {
    return <LoadingState message="Đang tổng hợp bằng chứng học tập..." count={4} />;
  }
  if (status === 'error') {
    return <ErrorState code={error?.code ?? 'INTERNAL_ERROR'} onRetry={error?.retryable ? retry : undefined} />;
  }
  if (status === 'empty' || !data) {
    return (
      <EmptyState
        title="Chưa có bằng chứng tiến độ"
        description="Sau khi hoàn thành hoạt động Today, Reader hoặc Review, dữ liệu thực tế sẽ xuất hiện tại đây."
        actionLabel="Mở Today"
        onAction={() => {
          window.location.href = '/today';
        }}
      />
    );
  }

  const maxMinutes = Math.max(1, ...data.history7d.map((point) => point.minutesSpent));

  return (
    <div ref={containerRef} className="max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
            Learning Evidence
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Tiến độ học thực tế
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Chỉ hiển thị dữ liệu đã được backend ghi nhận; không dùng XP, điểm thưởng hoặc số liệu demo.
          </p>
        </div>
        <div className="flex self-start rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-1 sm:self-auto">
          {(['7d', '30d'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setWindow(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                timeWindow === value
                  ? 'bg-[var(--surface)] font-semibold text-[var(--action-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {value === '7d' ? '7 ngày' : '30 ngày'}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Ngày đạt mục tiêu" value={`${data.activeDaysCount}/${data.weeklyTargetDays}`} icon={<Calendar className="h-4 w-4" />} />
        <MetricCard label="Thời gian hoàn thành" value={`${data.totalStudyMinutes} phút`} icon={<Clock className="h-4 w-4" />} />
        <MetricCard label="Khái niệm đã tiếp xúc" value={String(data.newWordsAcquired)} icon={<Sparkles className="h-4 w-4" />} />
        <MetricCard label="Khái niệm đã củng cố" value={String(data.wordsSolidified)} icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <Card variant="default" padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Sức khỏe trí nhớ hiện tại</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Tỷ lệ memory item đang active và chưa quá hạn tại thời điểm tổng hợp.
            </p>
          </div>
          <Badge variant="success" size="md">{data.retentionScore}%</Badge>
        </div>
      </Card>

      <Card variant="default" padding="lg" className="space-y-5">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">Hoạt động theo ngày</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Cột là số phút hoàn thành thực tế. Phần trăm là tỷ lệ Review đúng trong ngày, không phải Memory Health.
          </p>
        </div>
        <div className="space-y-3">
          {data.history7d.map((point, index) => {
            const width = Math.round((point.minutesSpent / maxMinutes) * 100);
            return (
              <div key={`${point.dayLabel}-${index}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">{point.dayLabel}</span>
                  <span className="text-[var(--text-primary)]">
                    {point.minutesSpent} phút · Review đúng {point.retentionPercent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
                  <div
                    className="analytics-bar-fill h-full rounded-full bg-[var(--action-primary)] will-change-transform"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card variant="default" padding="md" className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
        <span className="text-[var(--action-primary)]">{icon}</span>
        {label}
      </div>
      <div className="text-xl font-bold text-[var(--text-primary)]">{value}</div>
    </Card>
  );
}
