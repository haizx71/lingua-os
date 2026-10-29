'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, EmptyState, ErrorState, InlineAlert, LoadingState, Progress } from '@lingua/ui';
import { ArrowRight, BookOpen, CheckCircle2, Headphones, RotateCcw, Sparkles, Sun } from 'lucide-react';
import {
  isApiErrorCode,
  mockTodayPlanResponse,
  type ApiClient,
  type ApiErrorCode,
  type LearningActivityType,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { mapTodayPlanToViewModel, type TodayActivityViewModel, type TodayPlanViewModel } from './adapters';
import { useTodayPlan } from './useTodayPlan';
import { clientNavigate } from '../../lib/navigation/clientNavigate';

export interface TodayDashboardProps {
  initialPlan?: TodayPlanViewModel;
  initialTargetMinutes?: number;
  initialCompletedMinutes?: number;
  initialStreakDays?: number;
  initialMemoryHealth?: number;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  apiClient?: ApiClient;
  onActivityStart?: (activityId: string) => void;
}

function getPendingActionLabel(type: LearningActivityType): string {
  switch (type) {
    case 'review': return 'Bắt đầu ôn tập';
    case 'read': return 'Mở bài đọc';
    case 'listen': return 'Luyện nghe';
    case 'learn': return 'Khám phá';
    default: return 'Bắt đầu';
  }
}

function getCompletedActionLabel(type: LearningActivityType): string {
  switch (type) {
    case 'review': return 'Ôn lại';
    case 'read': return 'Đọc lại';
    case 'listen': return 'Luyện lại';
    case 'learn': return 'Xem lại';
    default: return 'Mở lại';
  }
}

function ActivityIcon({ type }: { type: LearningActivityType }) {
  const className = 'h-5 w-5';
  if (type === 'review') return <RotateCcw className={className} aria-hidden="true" />;
  if (type === 'read') return <BookOpen className={className} aria-hidden="true" />;
  if (type === 'listen') return <Headphones className={className} aria-hidden="true" />;
  return <Sparkles className={className} aria-hidden="true" />;
}

export function TodayDashboard({
  initialPlan,
  initialTargetMinutes,
  initialCompletedMinutes,
  initialStreakDays,
  forcedState,
  forcedErrorCode = 'INTERNAL_ERROR',
  apiClient,
  onActivityStart,
}: TodayDashboardProps) {
  const authContext = useOptionalAuth();
  const isAuthOrConfigured = Boolean(authContext?.isConfigured || apiClient);
  const {
    plan: livePlan,
    isLoading,
    error,
    isSetupRequired,
    isCompleting,
    completeActivity,
    actionError,
    alertMessage,
    refetch,
  } = useTodayPlan({ apiClient, initialPlan });

  const [localForcedState, setLocalForcedState] = useState<'loading' | 'empty' | 'error' | 'success' | undefined>(forcedState);
  useEffect(() => setLocalForcedState(forcedState), [forcedState]);

  const handleRetry = () => {
    if (localForcedState === 'error') setLocalForcedState('success');
    void refetch();
  };

  const effectivePlan = useMemo(() => {
    if (livePlan) return livePlan;
    if (localForcedState === 'success') return mapTodayPlanToViewModel(mockTodayPlanResponse.data);
    if (!isAuthOrConfigured && !localForcedState) return mapTodayPlanToViewModel(mockTodayPlanResponse.data);
    return null;
  }, [livePlan, localForcedState, isAuthOrConfigured]);

  if (localForcedState === 'loading' || (isLoading && !localForcedState)) {
    return <LoadingState message="Đang tải kế hoạch học tập hôm nay..." />;
  }

  if (localForcedState === 'error' || (error && !localForcedState)) {
    const code: ApiErrorCode = forcedErrorCode || (error && isApiErrorCode(error.message) ? error.message : 'INTERNAL_ERROR');
    return <ErrorState code={code} title="Không thể tải kế hoạch học tập" description="Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng thử lại sau giây lát." onRetry={handleRetry} />;
  }

  if (isSetupRequired && !localForcedState) {
    return (
      <EmptyState
        title="Cần thiết lập múi giờ học tập"
        description="Hồ sơ học tập của bạn chưa có múi giờ hợp lệ để hệ thống xây dựng kế hoạch hôm nay."
        actionLabel="Thiết lập lộ trình học"
        onAction={() => { clientNavigate('/onboarding'); }}
      />
    );
  }

  if (localForcedState === 'empty' || !effectivePlan || effectivePlan.activities.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <PageHeading />
        <EmptyState
          title="Chưa có hoạt động hôm nay"
          description="Kế hoạch hiện không có hoạt động cần thực hiện. Bạn có thể mở Thư viện để tìm nội dung đã xuất bản."
          actionLabel="Mở Thư viện"
          onAction={() => { clientNavigate('/library'); }}
        />
      </div>
    );
  }

  const targetMinutes = initialTargetMinutes ?? effectivePlan.targetMinutes;
  const completedMinutes = initialCompletedMinutes ?? effectivePlan.completedMinutes;
  const remainingMinutes = Math.max(0, targetMinutes - completedMinutes);
  const progressPercent = targetMinutes > 0 ? Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)) : 0;
  const streakDays = initialStreakDays ?? (effectivePlan.completedActivitiesCount > 0 ? 1 : 0);
  const nextActivity = effectivePlan.activities.find((activity) => !activity.completed);
  const primaryActivity = effectivePlan.activities[0];
  const focusSkillLabel =
    primaryActivity?.type === 'review'
      ? 'Kích hoạt trí nhớ dài hạn (Ôn tập ngắt quãng nhớ lâu)'
      : primaryActivity?.type === 'learn'
        ? 'Mở rộng mạng lưới khái niệm ngôn ngữ'
        : 'Đọc hiểu ngữ cảnh & Mở rộng từ vựng';
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <PageHeading />

      {(actionError || alertMessage) && (
        <div className="space-y-2">
          {actionError && <InlineAlert variant="danger" title="Lỗi hoàn thành hoạt động">{actionError.message}</InlineAlert>}
          {alertMessage && <InlineAlert variant="success" title="Cập nhật">{alertMessage}</InlineAlert>}
        </div>
      )}

      <section aria-label="Kế hoạch học tập hôm nay" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(250px,0.7fr)]">
        <div className="min-w-0 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--action-primary)]"><Sun className="h-4 w-4" aria-hidden="true" /><span>Kế hoạch hôm nay</span></div>
          <div
            data-testid="wave9-today-skill-focus"
            aria-label="Kỹ năng trọng tâm của kế hoạch hôm nay"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-[var(--action-primary)]/30 bg-[var(--surface-lilac)] px-3 py-1 text-xs font-semibold text-[var(--action-primary)]"
          >
            <span>🎯 Trọng tâm hôm nay:</span>
            <span className="font-bold text-[var(--text-primary)]">{focusSkillLabel}</span>
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Bắt đầu từ một bước nhỏ.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{completedMinutes} trên {targetMinutes} phút đã hoàn thành hôm nay.</p>
          <div className="mt-5 max-w-xl rounded-2xl bg-[var(--surface-lilac)] p-4">
            <Progress value={progressPercent} max={100} label={`Tiến độ hôm nay: ${completedMinutes} / ${targetMinutes} phút`} showValueText size="sm" />
          </div>
          {nextActivity ? (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--action-primary)]"><ActivityIcon type={nextActivity.type} /></span>
                <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Hoạt động tiếp theo</p><h2 className="mt-0.5 break-words text-sm font-bold text-[var(--text-primary)]">{nextActivity.title}</h2></div>
              </div>
              <Link href={nextActivity.targetUrl} className="w-full shrink-0 sm:w-auto">
                <Button className="w-full sm:w-auto" variant="primary" size="md" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => onActivityStart?.(nextActivity.id)}>
                  {getPendingActionLabel(nextActivity.type)}
                </Button>
              </Link>
            </div>
          ) : (
            <div
              data-testid="today-milestone-celebration"
              className="mt-5 flex flex-col gap-3 rounded-2xl bg-[var(--status-success-bg)] p-4 text-sm font-semibold text-[var(--status-success)] sm:flex-row sm:items-center sm:justify-between"
            >
              <span>Bạn đã hoàn thành các hoạt động trong kế hoạch hôm nay.</span>
              <Link href="/read" className="inline-flex shrink-0">
                <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Đọc thêm bài mới
                </Button>
              </Link>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-col justify-between rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-lilac)] p-5 sm:p-6">
          <div>
            <p className="lingua-kicker text-[var(--action-primary)]">Mục tiêu</p>
            <p className="mt-2 text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)]">{targetMinutes}<span className="ml-1 text-base font-semibold text-[var(--text-secondary)]">phút</span></p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Thời lượng kế hoạch hôm nay</p>
            <div
              data-testid="today-streak-badge"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--action-primary)]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{streakDays > 0 ? `Chuỗi học ${streakDays} ngày liên tiếp` : 'Bắt đầu chuỗi ngày học hôm nay'}</span>
            </div>
            <div
              data-testid="today-remaining-time-indicator"
              aria-label="Thời gian học ước tính còn lại hôm nay"
              className="mt-2 text-xs font-semibold text-[var(--text-secondary)]"
            >
              {remainingMinutes > 0
                ? `⏳ Còn khoảng ${remainingMinutes} phút để hoàn tất mục tiêu`
                : '✅ Đã hoàn thành mục tiêu thời lượng hôm nay'}
            </div>
            <div
              data-testid="today-completion-percent-badge"
              aria-label="Phần trăm hoàn thành mục tiêu ngày"
              className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--surface-lilac)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--action-primary)]"
            >
              📊 Hoàn thành {progressPercent}% mục tiêu ngày
            </div>
            <div
              data-testid="today-activity-ratio-pill"
              aria-label="Số nhiệm vụ đã hoàn thành trong ngày"
              className="mt-1.5 text-xs font-semibold text-[var(--text-secondary)]"
            >
              ✅ Hoàn tất {effectivePlan.completedActivitiesCount}/{effectivePlan.totalActivitiesCount} nhiệm vụ
            </div>
            <p
              data-testid="today-consistency-tip"
              aria-label="Mẹo duy trì thói quen học tập"
              className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]"
            >
              💡 Mẹo duy trì: Học đều 15 phút mỗi ngày hiệu quả gấp 3 lần học dồn cuối tuần.
            </p>
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                data-testid="today-quick-review-link"
                aria-label="Mở nhanh phiên ôn tập thẻ nhớ đến hạn"
                onClick={() => clientNavigate('/review')}
              >
                ⚡ Ôn nhanh thẻ đến hạn
              </Button>
            </div>
          </div>
          <div
            data-testid="today-action-button-guide"
            className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-secondary)]"
          >
            💡 Bấm <strong className="text-[var(--text-primary)]">Bắt đầu</strong> để vào bài học, hoặc <strong className="text-[var(--text-primary)]">Đánh dấu xong</strong> khi hoàn thành.
            <span className="sr-only">{effectivePlan.completedActivitiesCount} / {effectivePlan.totalActivitiesCount}</span>
          </div>
        </aside>
      </section>

      <div
        data-testid="today-greeting-banner"
        aria-label="Lời chào và gợi ý học tập theo thời gian trong ngày"
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-xs text-[var(--text-secondary)] shadow-[var(--shadow-xs)]"
      >
        <span className="font-semibold text-[var(--text-primary)]">
          ☀️ Nhịp học khoa học: Kết hợp đọc bài có ngữ cảnh và ôn tập ngắt quãng để ghi nhớ sâu.
        </span>
        <span
          data-testid="today-focus-skill-badge"
          aria-label="Trọng tâm kỹ năng hôm nay"
          className="inline-flex items-center rounded-full bg-[var(--surface-lilac)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--action-primary)]"
        >
          🎯 Trọng tâm: Đọc hiểu & Phản xạ từ vựng
        </span>
        <span className="font-mono text-[11px] font-bold text-[var(--action-primary)]">
          {effectivePlan.totalActivitiesCount} hoạt động trong ngày
        </span>
      </div>

      <section
        data-testid="today-beginner-guide"
        aria-label="Hướng dẫn 3 bước cho người mới"
        className="rounded-[24px] border border-[var(--border-subtle)] bg-gradient-to-r from-[var(--surface)] via-[var(--surface)] to-[var(--surface-lilac)]/45 p-4 shadow-[var(--shadow-xs)] sm:p-5"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--action-primary)]">
          Lộ trình 3 bước dễ dàng cho người mới
        </p>
        <p
          data-testid="today-novice-reassurance"
          className="mt-2 text-xs text-[var(--text-secondary)]"
        >
          🌱 Dành cho người mới bắt đầu: Bạn không cần biết trước từ vựng — hãy làm lần lượt từng bước từ Bước 1 đến Bước 3.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
            <span className="text-xs font-bold text-[var(--action-primary)]">Bước 1 · Đọc & Chạm từ</span>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Mở bài đọc, bật <strong>Đọc chậm 0.75x</strong> và chạm vào <strong>bất kỳ từ nào</strong> để xem nghĩa tiếng Việt.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
            <span className="text-xs font-bold text-[var(--action-primary)]">Bước 2 · Lưu 3–5 từ mới</span>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Chọn các từ được gạch chân quan trọng và bấm <strong>Lưu vào ôn tập</strong> để đưa vào bộ nhớ.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
            <span className="text-xs font-bold text-[var(--action-primary)]">Bước 3 · Ôn tập có gợi ý</span>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Khi ôn tập, dùng nút <strong>Gợi ý chữ cái</strong> và nghe phát âm chậm để nhớ từ tự nhiên, không áp lực.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="today-activities-heading" className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div><p className="lingua-kicker">Theo thứ tự ưu tiên</p><h2 id="today-activities-heading" className="mt-1 text-xl font-bold tracking-[-0.025em] text-[var(--text-primary)]">Các hoạt động</h2></div>
          <span className="text-xs text-[var(--text-muted)]">{effectivePlan.activities.length} mục</span>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {effectivePlan.activities.map((activity: TodayActivityViewModel, index) => {
            const isDone = Boolean(activity.completed);
            return (
              <article key={activity.id} className="flex min-w-0 flex-col gap-3 py-4 first:pt-3 last:pb-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-lilac)] text-[var(--action-primary)]"><ActivityIcon type={activity.type} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-muted)]">{index + 1}</span>
                      <h3 className="min-w-0 break-words text-sm font-bold text-[var(--text-primary)]">{activity.title}</h3>
                      {isDone ? <Badge variant="success" size="sm" icon={<CheckCircle2 className="h-3 w-3" />}>Đã xong</Badge> : <Badge variant={activity.badgeVariant} size="sm">{activity.badgeLabel}</Badge>}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{activity.reasonText}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 sm:items-end">
                  {!isDone && (
                    <span
                      data-testid={`today-step-priority-${activity.id}`}
                      className="text-[11px] font-semibold text-[var(--action-primary)]"
                    >
                      👉 Bước chính: Bấm &ldquo;Bắt đầu&rdquo; để vào bài học
                    </span>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                    <Link href={activity.targetUrl} className="min-w-0"><Button className="w-full sm:w-auto" variant={isDone ? 'secondary' : activity.id === nextActivity?.id ? 'primary' : 'outline'} size="sm" onClick={() => onActivityStart?.(activity.id)}>{isDone ? getCompletedActionLabel(activity.type) : getPendingActionLabel(activity.type)}</Button></Link>
                    {!isDone && <Button className="w-full sm:w-auto" variant="ghost" size="sm" disabled={isCompleting(activity.id)} onClick={() => void completeActivity(activity.id, activity.durationMinutes * 60)} aria-label={`Hoàn thành hoạt động ${activity.title}`}>{isCompleting(activity.id) ? 'Đang lưu...' : 'Đánh dấu xong'}</Button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PageHeading() {
  return (
    <header className="max-w-2xl">
      <p className="lingua-kicker text-[var(--action-primary)]">Hôm nay</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Kế hoạch của bạn</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">Xem hoạt động được lên lịch và chọn điều muốn bắt đầu.</p>
    </header>
  );
}
