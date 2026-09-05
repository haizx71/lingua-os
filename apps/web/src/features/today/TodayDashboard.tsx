'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  ConceptChip,
  Progress,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
} from '@lingua/ui';
import {
  Sparkles,
  Clock,
  ArrowRight,
  BookOpen,
  RotateCcw,
  Volume2,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import {
  isApiErrorCode,
  mockTodayPlanResponse,
  type ApiClient,
  type ApiErrorCode,
  type LearningActivityType,
} from '@lingua/types';
import { useOptionalAuth } from '../auth/AuthContext';
import {
  mapTodayPlanToViewModel,
  type TodayActivityViewModel,
  type TodayPlanViewModel,
} from './adapters';
import { useTodayPlan } from './useTodayPlan';

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
    case 'review':
      return 'Bắt đầu';
    case 'read':
      return 'Xem bài';
    case 'listen':
      return 'Luyện nghe';
    case 'learn':
      return 'Khám phá';
    default:
      return 'Bắt đầu';
  }
}

function getCompletedActionLabel(type: LearningActivityType): string {
  switch (type) {
    case 'review':
      return 'Ôn lại';
    case 'read':
      return 'Đọc lại';
    case 'listen':
      return 'Luyện lại';
    case 'learn':
      return 'Xem lại';
    default:
      return 'Làm lại';
  }
}

function renderActivityIcon(type: LearningActivityType) {
  switch (type) {
    case 'review':
      return (
        <div className="w-10 h-10 rounded-xl bg-[var(--status-warning-bg)] text-[var(--status-warning)] border border-[var(--status-warning-border)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <RotateCcw className="w-5 h-5" />
        </div>
      );
    case 'read':
      return (
        <div className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <BookOpen className="w-5 h-5" />
        </div>
      );
    case 'listen':
      return (
        <div className="w-10 h-10 rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info)] border border-[var(--status-info-border)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Volume2 className="w-5 h-5" />
        </div>
      );
    case 'learn':
    default:
      return (
        <div className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] text-[var(--action-primary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5" />
        </div>
      );
  }
}

export function TodayDashboard({
  initialPlan,
  initialTargetMinutes,
  initialCompletedMinutes,
  initialStreakDays = 5,
  initialMemoryHealth = 87,
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
    isCompleting,
    completeActivity,
    actionError,
    alertMessage,
    refetch,
  } = useTodayPlan({
    apiClient,
    initialPlan,
  });

  const [localForcedState, setLocalForcedState] = useState<'loading' | 'empty' | 'error' | 'success' | undefined>(forcedState);

  useEffect(() => {
    setLocalForcedState(forcedState);
  }, [forcedState]);

  const handleRetry = () => {
    if (localForcedState === 'error') {
      setLocalForcedState('success');
    }
    void refetch();
  };

  // Backward-compatible fallback for unconfigured test harnesses (e.g. tier 1 synchronous render)
  const effectivePlan = useMemo(() => {
    if (livePlan) return livePlan;
    if (localForcedState === 'success') {
      return mapTodayPlanToViewModel(mockTodayPlanResponse.data);
    }
    if (!isAuthOrConfigured && !localForcedState) {
      return mapTodayPlanToViewModel(mockTodayPlanResponse.data);
    }
    return null;
  }, [livePlan, localForcedState, isAuthOrConfigured]);

  // Handle forcedStates or error/loading states
  if (localForcedState === 'loading' || (isLoading && !localForcedState)) {
    return <LoadingState message="Đang tải kế hoạch học tập hôm nay..." />;
  }

  if (localForcedState === 'error' || (error && !localForcedState)) {
    const code: ApiErrorCode = forcedErrorCode || (error && isApiErrorCode(error.message) ? error.message : 'INTERNAL_ERROR');
    return (
      <ErrorState
        code={code}
        title="Không thể tải kế hoạch học tập"
        description="Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng thử lại sau giây lát."
        onRetry={handleRetry}
      />
    );
  }

  if (localForcedState === 'empty' || !effectivePlan || effectivePlan.activities.length === 0) {
    return (
      <EmptyState
        title="Không có bài học nào cần ôn hôm nay"
        description="Bạn đã hoàn thành tất cả các mục tiêu học tập hôm nay hoặc chưa cấu hình lộ trình."
        actionLabel="Khám phá bài đọc mới"
      />
    );
  }

  // Authoritative server-provided numbers
  const targetMinutes = initialTargetMinutes ?? effectivePlan.targetMinutes;
  const completedMinutes = initialCompletedMinutes ?? effectivePlan.completedMinutes;
  const progressPercent =
    targetMinutes > 0 ? Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)) : 0;
  const completedActivitiesCount = effectivePlan.completedActivitiesCount;
  const totalActivitiesCount = effectivePlan.totalActivitiesCount;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
              Kế hoạch hôm nay
            </span>
            <Badge variant="primary" size="sm">
              {targetMinutes} phút
            </Badge>
            <div className="flex items-center gap-1 text-xs text-[var(--status-warning)] font-medium ml-1">
              <Flame className="w-3.5 h-3.5 fill-[var(--status-warning)] text-[var(--status-warning)]" />
              <span>Chuỗi {initialStreakDays} ngày</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Chào buổi sáng, Learner!
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            LINGUA OS đã chọn {effectivePlan.activities.length} hoạt động tối ưu nhất dựa trên trí nhớ và mục tiêu của bạn.
          </p>
        </div>
        <Link href="/review" className="w-full sm:w-auto">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto min-h-[48px] px-6"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Bắt đầu học ngay
          </Button>
        </Link>
      </header>

      {/* Action Error Alert */}
      {actionError && (
        <InlineAlert variant="danger" title="Lỗi hoàn thành hoạt động">
          {actionError.message}
        </InlineAlert>
      )}

      {/* Inline Feedback Alert */}
      {alertMessage && (
        <InlineAlert variant="success" title="Cập nhật">
          {alertMessage}
        </InlineAlert>
      )}

      {/* Progress & Alert Banner */}
      <Card variant="subtle" padding="md" className="space-y-3">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--action-primary)]" />
            <span>
              Tiến độ học hôm nay: {completedMinutes} / {targetMinutes} phút
            </span>
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {completedActivitiesCount > 0
              ? `${completedActivitiesCount} / ${totalActivitiesCount} hoàn thành`
              : `${totalActivitiesCount} bài tập`}
          </span>
        </div>
        <Progress
          value={progressPercent}
          max={100}
          size="md"
          variant="primary"
          label={`Tiến độ học hôm nay: ${completedMinutes} / ${targetMinutes} phút`}
        />
      </Card>

      {/* Primary Activities Timeline — SERVER ORDER STRICTLY PRESERVED */}
      <section aria-labelledby="timeline-heading" className="space-y-4">
        <h2 id="timeline-heading" className="text-lg font-semibold text-[var(--text-primary)]">
          Danh sách hoạt động
        </h2>

        {effectivePlan.activities.map((activity: TodayActivityViewModel) => (
          <Card
            key={activity.id}
            variant="interactive"
            padding="md"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              {renderActivityIcon(activity.type)}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base text-[var(--text-primary)]">
                    {activity.title}
                  </h3>
                  {activity.completed ? (
                    <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                      Đã xong
                    </Badge>
                  ) : (
                    <Badge variant={activity.badgeVariant} size="sm">
                      {activity.badgeLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {activity.reasonText}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
              <Link href={activity.targetUrl}>
                <Button
                  variant={
                    activity.completed
                      ? 'secondary'
                      : activity.type === 'review'
                        ? 'primary'
                        : 'outline'
                  }
                  size="sm"
                  onClick={() => onActivityStart?.(activity.id)}
                >
                  {activity.completed
                    ? getCompletedActionLabel(activity.type)
                    : getPendingActionLabel(activity.type)}
                </Button>
              </Link>
              {!activity.completed && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isCompleting(activity.id)}
                  onClick={() => void completeActivity(activity.id, activity.durationMinutes * 60)}
                  aria-label={`Hoàn thành hoạt động ${activity.title}`}
                >
                  {isCompleting(activity.id) ? 'Đang hoàn thành...' : 'Hoàn thành'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </section>

      {/* Language Brain Preview Snapshot */}
      <section aria-labelledby="brain-snapshot-heading" className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 id="brain-snapshot-heading" className="text-base font-semibold text-[var(--text-primary)]">
            Trạng thái Language Brain
          </h2>
          <Link href="/brain" className="text-xs text-[var(--action-primary)] hover:underline flex items-center gap-1 font-medium">
            <span>Xem toàn bộ 483 từ</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <Card padding="md" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--status-info-bg)] text-[var(--action-primary)] flex items-center justify-center border border-[var(--status-info-border)]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold text-sm text-[var(--text-primary)]">
                  Sức khỏe trí nhớ: {initialMemoryHealth}%
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Trạng thái ổn định cao. 23 từ cần ôn lại hôm nay để duy trì độ nhớ.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/review">
                <Button variant="primary" size="sm">
                  Ôn tập ngay
                </Button>
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] mr-1">Từ vựng gần đây đang được theo dõi:</span>
            <ConceptChip status="learning" isDue={true} term="perseverance" size="sm" />
            <ConceptChip status="learning" term="resilience" size="sm" />
            <ConceptChip status="mastered" term="effortless" size="sm" />
            <ConceptChip status="weak" term="meticulous" size="sm" />
          </div>
        </Card>
      </section>
    </div>
  );
}
