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
  const progressPercent = targetMinutes > 0 ? Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)) : 0;
  const nextActivity = effectivePlan.activities.find((activity) => !activity.completed);
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
            <div className="mt-5 rounded-2xl bg-[var(--status-success-bg)] p-4 text-sm font-semibold text-[var(--status-success)]">Bạn đã hoàn thành các hoạt động trong kế hoạch hôm nay.</div>
          )}
        </div>

        <aside className="flex min-w-0 flex-col justify-between rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-lilac)] p-5 sm:p-6">
          <div><p className="lingua-kicker text-[var(--action-primary)]">Mục tiêu</p><p className="mt-2 text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)]">{targetMinutes}<span className="ml-1 text-base font-semibold text-[var(--text-secondary)]">phút</span></p><p className="mt-1 text-sm text-[var(--text-secondary)]">Thời lượng kế hoạch hôm nay</p></div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm"><span className="text-[var(--text-secondary)]">Hoạt động hoàn tất</span><span className="font-bold text-[var(--text-primary)]">{effectivePlan.completedActivitiesCount} / {effectivePlan.totalActivitiesCount}</span></div>
        </aside>
      </section>

      <section aria-labelledby="today-activities-heading" className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div><p className="lingua-kicker">Theo thứ tự ưu tiên</p><h2 id="today-activities-heading" className="mt-1 text-xl font-bold tracking-[-0.025em] text-[var(--text-primary)]">Các hoạt động</h2></div>
          <span className="text-xs text-[var(--text-muted)]">{effectivePlan.activities.length} mục</span>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {effectivePlan.activities.map((activity: TodayActivityViewModel, index) => (
            <article key={activity.id} className="flex min-w-0 flex-col gap-3 py-4 first:pt-3 last:pb-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-lilac)] text-[var(--action-primary)]"><ActivityIcon type={activity.type} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">{index + 1}</span>
                    <h3 className="min-w-0 break-words text-sm font-bold text-[var(--text-primary)]">{activity.title}</h3>
                    {activity.completed ? <Badge variant="success" size="sm" icon={<CheckCircle2 className="h-3 w-3" />}>Đã xong</Badge> : <Badge variant={activity.badgeVariant} size="sm">{activity.badgeLabel}</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{activity.reasonText}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                <Link href={activity.targetUrl} className="min-w-0"><Button className="w-full sm:w-auto" variant={activity.completed ? 'secondary' : activity.id === nextActivity?.id ? 'primary' : 'outline'} size="sm" onClick={() => onActivityStart?.(activity.id)}>{activity.completed ? getCompletedActionLabel(activity.type) : getPendingActionLabel(activity.type)}</Button></Link>
                {!activity.completed && <Button className="w-full sm:w-auto" variant="ghost" size="sm" disabled={isCompleting(activity.id)} onClick={() => void completeActivity(activity.id, activity.durationMinutes * 60)} aria-label={`Hoàn thành hoạt động ${activity.title}`}>{isCompleting(activity.id) ? 'Đang lưu...' : 'Đánh dấu xong'}</Button>}
              </div>
            </article>
          ))}
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
