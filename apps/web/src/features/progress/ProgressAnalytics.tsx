'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Button,
  Card,
  Badge,
  LoadingState,
  EmptyState,
  ErrorState,
  componentMotionNumeric,
  usePrefersReducedMotion,
} from '@lingua/ui';
import {
  TrendingUp,
  Calendar,
  Award,
  Clock,
  BookOpen,
  RotateCcw,
  Volume2,
  Search,
} from 'lucide-react';
import { type ApiErrorCode } from '@lingua/types';
import { defaultProgressSummary, type ProgressSummaryData } from '../../fixtures/progressFixture';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface ProgressAnalyticsProps {
  initialData?: ProgressSummaryData;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

export function ProgressAnalytics({
  initialData = defaultProgressSummary,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
}: ProgressAnalyticsProps) {
  const [data] = useState<ProgressSummaryData>(initialData);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const [timeWindow, setTimeWindow] = useState<'7d' | '30d'>('7d');
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (currentState !== 'success') return;
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
    { dependencies: [timeWindow, currentState, prefersReducedMotion], scope: containerRef }
  );

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => setCurrentState('success'), 400);
  };

  if (currentState === 'loading') return <LoadingState message="Đang phân tích đường cong ghi nhớ và dữ liệu tiến độ..." count={4} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;
  if (currentState === 'empty') {
    return (
      <EmptyState
        title="Chưa có dữ liệu tiến độ"
        description="Hãy hoàn thành bài học đầu tiên hôm nay để hệ thống tổng hợp báo cáo tiến độ học tập cho bạn."
        actionLabel="Học ngay hôm nay"
        onAction={() => { window.location.href = '/today'; }}
      />
    );
  }

  const activities = [
    { id: 'fsrs', icon: RotateCcw, iconColor: 'text-[var(--status-warning)]', bar: 'bg-[var(--status-warning)]', title: 'Ôn tập thông minh (FSRS)', text: timeWindow === '7d' ? '45 phút (28%)' : '180 phút (28%)', value: 28 },
    { id: 'reader', icon: BookOpen, iconColor: 'text-[var(--action-primary)]', bar: 'bg-[var(--action-primary)]', title: 'Đọc hiểu ngữ cảnh (Reader)', text: timeWindow === '7d' ? '60 phút (38%)' : '245 phút (38%)', value: 38 },
    { id: 'listening', icon: Volume2, iconColor: 'text-[var(--accent-purple)]', bar: 'bg-[var(--accent-purple)]', title: 'Luyện nghe phản xạ câu', text: timeWindow === '7d' ? '30 phút (19%)' : '125 phút (19%)', value: 19 },
    { id: 'dict', icon: Search, iconColor: 'text-[var(--status-success)]', bar: 'bg-[var(--status-success)]', title: 'Khám phá từ mới & Tra từ điển', text: timeWindow === '7d' ? '25 phút (15%)' : '90 phút (15%)', value: 15 },
  ];

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-5xl space-y-6">
      <header className="relative overflow-hidden rounded-[28px] border border-[#dfe9f4] bg-gradient-to-br from-[var(--surface-blue)] via-white to-[var(--accent-teal-soft)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/70" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="lingua-kicker text-[var(--action-primary)]">Learning Evidence & Trends</span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--text-primary)] sm:text-3xl">Tiến độ học thực tế</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Đo sự tiến bộ bằng bằng chứng ghi nhớ thực tế, không dựa trên XP hay điểm thưởng ảo.</p>
          </div>
          <div className="flex items-center gap-1 self-start rounded-2xl border border-[var(--border-subtle)] bg-white/75 p-1 shadow-sm sm:self-auto">
            {(['7d', '30d'] as const).map((windowKey) => (
              <button
                key={windowKey}
                type="button"
                onClick={() => setTimeWindow(windowKey)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${timeWindow === windowKey ? 'bg-[var(--action-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'}`}
              >
                {windowKey === '7d' ? '7 ngày' : '30 ngày'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card variant="default" padding="md" className="relative overflow-hidden">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-blue)] text-[var(--action-primary)]"><TrendingUp className="h-5 w-5" /></span><div><div className="text-xs font-semibold text-[var(--text-muted)]">Từ mới đã tiếp nạp</div><div className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-[var(--action-primary)]">+{data.newWordsAcquired}</div></div></div>
          <p className="mt-3 text-xs text-[var(--text-secondary)]">Qua các bài đọc Reader</p>
        </Card>
        <Card variant="default" padding="md">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success)]"><Award className="h-5 w-5" /></span><div><div className="text-xs font-semibold text-[var(--text-muted)]">Từ đã củng cố</div><div className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-[var(--status-success)]">+{data.wordsSolidified}</div></div></div>
          <p className="mt-3 text-xs text-[var(--text-secondary)]">Đạt chuẩn trí nhớ dài hạn</p>
        </Card>
        <Card variant="default" padding="md">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-warm)] text-[var(--status-warning)]"><Calendar className="h-5 w-5" /></span><div><div className="text-xs font-semibold text-[var(--text-muted)]">Ngày học thành công</div><div className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{data.activeDaysCount}/{data.weeklyTargetDays}</div></div></div>
          <p className="mt-3 text-xs text-[var(--text-secondary)]">Đạt mục tiêu học hàng ngày</p>
        </Card>
      </section>

      <Card variant="default" padding="lg" className="overflow-hidden">
        <div className="grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
          <div className="mx-auto text-center">
            <div className="relative flex h-44 w-44 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--accent-teal) ${Math.min(100, data.retentionScore) * 3.6}deg, #e9ece8 0deg)` }}>
              <div className="absolute inset-[13px] rounded-full bg-white shadow-[inset_0_0_0_1px_var(--border-subtle)]" />
              <div className="relative z-10"><div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Retention</div><div className="mt-1 text-4xl font-black tracking-[-0.06em] text-[var(--text-primary)]">{data.retentionScore}%</div><div className="mt-1 text-xs font-semibold text-[var(--accent-teal-strong)]">Memory health</div></div>
            </div>
            <span className="mt-3 inline-flex rounded-full bg-[var(--surface-blue)] px-3 py-1 text-xs font-extrabold text-[var(--action-primary)]">CEFR • A2</span>
          </div>

          <div>
            <div className="lingua-kicker text-[var(--accent-teal-strong)]">Năng lực hiện tại</div>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">Ước lượng khởi điểm: A2 Elementary</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Độ tin cậy: Vừa • Dựa trên 582 bằng chứng tiếp xúc và tỷ lệ nhớ {data.retentionScore}%.</p>
            <div className="mt-5 grid grid-cols-6 gap-2">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => {
                const isCurrent = lvl === 'A2';
                const isCompleted = lvl === 'A1';
                return <div key={lvl} className={`rounded-xl border p-2.5 text-center text-xs font-bold ${isCurrent ? 'border-[var(--action-primary)] bg-[var(--surface-blue)] text-[var(--action-primary)]' : isCompleted ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)]' : 'border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-muted)]'}`}><div>{lvl}</div><div className="mt-0.5 text-[9px] font-medium">{isCurrent ? 'Hiện tại' : isCompleted ? 'Đã đạt' : 'Mục tiêu'}</div></div>;
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2"><Badge variant="success" size="md">Tỷ lệ duy trì: {data.retentionScore}%</Badge><Link href="/onboarding"><Button variant="outline" size="sm">Kiểm tra lại</Button></Link></div>
          </div>
        </div>
      </Card>

      <Card variant="default" padding="lg" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="lingua-kicker">Learning mix</div><h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold text-[var(--text-primary)]"><Clock className="h-4 w-4 text-[var(--action-primary)]" />Thời gian học theo hoạt động</h2></div><span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">{timeWindow === '7d' ? '160 phút tuần này' : '640 phút / 30 ngày'}</span></div>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><Icon className={`h-4 w-4 shrink-0 ${activity.iconColor}`} /><span className="truncate font-semibold text-[var(--text-secondary)]">{activity.title}</span></span><span className="shrink-0 font-extrabold text-[var(--text-primary)]">{activity.text}</span></div>
                <div role="progressbar" aria-valuenow={activity.value} aria-valuemin={0} aria-valuemax={100} aria-label={`${activity.title}: ${activity.text}`} className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className={`analytics-bar-fill h-full rounded-full will-change-transform ${activity.bar}`} style={{ width: `${activity.value}%` }} /></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
