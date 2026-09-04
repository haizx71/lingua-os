'use client';

import React, { useState } from 'react';
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
  Search,
} from 'lucide-react';
import { type ApiErrorCode } from '@lingua/types';
import { defaultTodayActivities, type TodayActivityItem } from '../../fixtures/todayFixture';

export interface TodayDashboardProps {
  initialTargetMinutes?: number;
  initialCompletedMinutes?: number;
  initialStreakDays?: number;
  initialMemoryHealth?: number;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onActivityStart?: (activityId: string) => void;
}

export function TodayDashboard({
  initialTargetMinutes = 25,
  initialCompletedMinutes = 0,
  initialStreakDays = 5,
  initialMemoryHealth = 87,
  forcedState,
  forcedErrorCode,
  onActivityStart,
}: TodayDashboardProps) {
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success' | 'ready'>(
    forcedState || 'ready'
  );
  const [activities, setActivities] = useState<TodayActivityItem[]>(defaultTodayActivities);
  const [completedMinutes, setCompletedMinutes] = useState(initialCompletedMinutes);
  const [targetMinutes] = useState(initialTargetMinutes);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const completedActivitiesCount = activities.filter((a) => a.completed).length;
  const progressPercent = Math.min(100, Math.round((completedMinutes / targetMinutes) * 100));

  const handleCompleteActivity = (id: string, duration: number) => {
    setActivities((prev) =>
      prev.map((act) => (act.id === id ? { ...act, completed: true } : act))
    );
    setCompletedMinutes((prev) => Math.min(targetMinutes, prev + duration));
    setAlertMessage(`Đã hoàn thành hoạt động. Tiến độ hôm nay: +${duration} phút!`);
    onActivityStart?.(id);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang tải kế hoạch học tập hôm nay..." />;
  }

  if (currentState === 'error') {
    return (
      <ErrorState
        code={forcedErrorCode || 'INTERNAL_ERROR'}
        title="Không thể tải kế hoạch học tập"
        description="Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng thử lại sau giây lát."
        onRetry={() => setCurrentState('ready')}
      />
    );
  }

  if (currentState === 'empty' || activities.length === 0) {
    return (
      <EmptyState
        title="Không có bài học nào cần ôn hôm nay"
        description="Bạn đã hoàn thành tất cả các mục tiêu học tập hôm nay hoặc chưa cấu hình lộ trình."
        actionLabel="Khám phá bài đọc mới"
        onAction={() => setCurrentState('success')}
      />
    );
  }

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
            LINGUA OS đã chọn 4 hoạt động tối ưu nhất dựa trên trí nhớ và mục tiêu của bạn.
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
            {completedActivitiesCount > 0 ? `${completedActivitiesCount} / 4 hoàn thành` : '4 bài tập'}
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

      {/* Primary Activities Timeline */}
      <section aria-labelledby="timeline-heading" className="space-y-4">
        <h2 id="timeline-heading" className="text-lg font-semibold text-[var(--text-primary)]">
          Danh sách hoạt động
        </h2>

        {/* Activity 1: Review */}
        <Card
          variant="interactive"
          padding="md"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--status-warning-bg)] text-[var(--status-warning)] border border-[var(--status-warning-border)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base text-[var(--text-primary)]">
                  {activities[0].title}
                </h3>
                <Badge variant="warning" size="sm">
                  {activities[0].badgeLabel}
                </Badge>
                {activities[0].completed && (
                  <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                    Đã xong
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {activities[0].reasonText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Link href="/review">
              <Button
                variant={activities[0].completed ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => handleCompleteActivity(activities[0].id, activities[0].durationMinutes)}
              >
                {activities[0].completed ? 'Ôn lại' : 'Bắt đầu'}
              </Button>
            </Link>
          </div>
        </Card>

        {/* Activity 2: Reading */}
        <Card
          variant="interactive"
          padding="md"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base text-[var(--text-primary)]">
                  {activities[1].title}
                </h3>
                <Badge variant="neutral" size="sm">
                  {activities[1].badgeLabel}
                </Badge>
                {activities[1].completed && (
                  <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                    Đã xong
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {activities[1].reasonText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Link href="/read">
              <Button
                variant={activities[1].completed ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleCompleteActivity(activities[1].id, activities[1].durationMinutes)}
              >
                {activities[1].completed ? 'Đọc lại' : 'Xem bài'}
              </Button>
            </Link>
          </div>
        </Card>

        {/* Activity 3: Listening */}
        <Card
          variant="interactive"
          padding="md"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info)] border border-[var(--status-info-border)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base text-[var(--text-primary)]">
                  {activities[2].title}
                </h3>
                <Badge variant="info" size="sm">
                  {activities[2].badgeLabel}
                </Badge>
                {activities[2].completed && (
                  <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                    Đã xong
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {activities[2].reasonText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Link href="/read">
              <Button
                variant={activities[2].completed ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleCompleteActivity(activities[2].id, activities[2].durationMinutes)}
              >
                {activities[2].completed ? 'Luyện lại' : 'Luyện nghe'}
              </Button>
            </Link>
          </div>
        </Card>

        {/* Activity 4: New Words Discovery */}
        <Card
          variant="interactive"
          padding="md"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] text-[var(--action-primary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base text-[var(--text-primary)]">
                  {activities[3].title}
                </h3>
                <Badge variant="primary" size="sm">
                  {activities[3].badgeLabel}
                </Badge>
                {activities[3].completed && (
                  <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                    Đã xong
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {activities[3].reasonText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Link href="/dictionary">
              <Button
                variant={activities[3].completed ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleCompleteActivity(activities[3].id, activities[3].durationMinutes)}
              >
                {activities[3].completed ? 'Xem lại' : 'Khám phá'}
              </Button>
            </Link>
          </div>
        </Card>
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
