'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingState,
} from '@lingua/ui';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Headphones,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trophy,
  Volume2,
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

function activityIcon(type: LearningActivityType) {
  const base = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl';
  switch (type) {
    case 'review':
      return <span className={`${base} bg-[var(--status-warning-bg)] text-[var(--status-warning)]`}><RotateCcw className="h-5 w-5" /></span>;
    case 'read':
      return <span className={`${base} bg-[var(--surface-blue)] text-[var(--action-primary)]`}><BookOpen className="h-5 w-5" /></span>;
    case 'listen':
      return <span className={`${base} bg-[var(--surface-lilac)] text-[var(--accent-purple)]`}><Volume2 className="h-5 w-5" /></span>;
    default:
      return <span className={`${base} bg-[var(--accent-teal-soft)] text-[var(--accent-teal-strong)]`}><Sparkles className="h-5 w-5" /></span>;
  }
}

function LanguageBrainVisual() {
  const chibiArtworkUrl = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3GlA8XU18ZAFeRalQzajlaCNDZL/bf560186-d322-4481-ad62-adcc952795e7.png';

  return (
    <div aria-hidden className="pointer-events-none absolute right-3 top-3 h-24 w-24 shrink-0 sm:static sm:h-36 sm:w-56">
      <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/70 bg-[#dff3ed] shadow-[0_14px_32px_rgba(23,63,186,0.10)] ring-1 ring-[#173fba]/5 transition-all duration-300 dark:border-white/10 dark:bg-[#121c32] dark:shadow-[0_16px_38px_rgba(0,0,0,0.30)] sm:rounded-[28px]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-95 transition-[filter,opacity] duration-300 [filter:brightness(1.08)_saturate(.92)] dark:opacity-100 dark:[filter:brightness(.96)_saturate(1.04)]"
          style={{ backgroundImage: `url("${chibiArtworkUrl}")` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_48%)] dark:bg-[linear-gradient(135deg,rgba(120,145,232,0.05),transparent_52%)]" />
      </div>
    </div>
  );
}

export function TodayDashboard({
  initialPlan,
  initialTargetMinutes,
  initialCompletedMinutes,
  initialStreakDays = 7,
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
        onAction={() => { window.location.href = '/onboarding'; }}
      />
    );
  }

  if (localForcedState === 'empty' || !effectivePlan || effectivePlan.activities.length === 0) {
    return <EmptyState title="Không có bài học nào cần ôn hôm nay" description="Bạn đã hoàn thành tất cả các mục tiêu học tập hôm nay hoặc chưa cấu hình lộ trình." actionLabel="Khám phá bài đọc mới" />;
  }

  const targetMinutes = initialTargetMinutes ?? effectivePlan.targetMinutes;
  const completedMinutes = initialCompletedMinutes ?? effectivePlan.completedMinutes;
  const progressPercent = targetMinutes > 0 ? Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)) : 0;
  const completedActivitiesCount = effectivePlan.completedActivitiesCount;
  const totalActivitiesCount = effectivePlan.totalActivitiesCount;
  const nextActivity = effectivePlan.activities.find((activity) => !activity.completed) ?? effectivePlan.activities[0];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1240px]">
      <div className="mb-4 flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white/80 px-3 py-3 shadow-sm backdrop-blur sm:px-4 md:mb-6">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <input aria-label="Tìm bài học hoặc từ vựng" placeholder="Tìm bài học, từ vựng hoặc chủ đề..." className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
        <span className="hidden rounded-lg bg-[var(--surface-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] sm:block">LINGUA SEARCH</span>
      </div>

      {(actionError || alertMessage) && (
        <div className="mb-5 space-y-2">
          {actionError && <InlineAlert variant="danger" title="Lỗi hoàn thành hoạt động">{actionError.message}</InlineAlert>}
          {alertMessage && <InlineAlert variant="success" title="Cập nhật">{alertMessage}</InlineAlert>}
        </div>
      )}

      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <section className="relative min-w-0 overflow-hidden rounded-[26px] border border-[#dfe7f0] bg-[linear-gradient(135deg,#f6f9ff_0%,#eef8f4_100%)] px-5 py-5 shadow-[var(--shadow-card)] transition-colors duration-300 dark:border-[#2d3953] dark:bg-[linear-gradient(135deg,#182238_0%,#11192c_58%,#18243a_100%)] sm:rounded-[30px] sm:px-7 sm:py-6">
            <div className="absolute -left-16 -top-20 h-48 w-48 rounded-full bg-[#fff2c8]/45 blur-2xl dark:hidden" />
            <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[#d9f1e9]/80 transition-colors duration-300 dark:bg-[#263657]/75 sm:hidden" />
            <div className="absolute inset-x-0 bottom-0 hidden h-16 bg-[linear-gradient(180deg,transparent,rgba(70,98,166,0.08))] dark:block" />
            <div className="relative min-w-0 pr-24 sm:grid sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center sm:gap-7 sm:pr-0">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-[#e6f4ef] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#258675] transition-colors duration-300 dark:bg-[#18342f] dark:text-[#83d9cc] sm:text-[11px]">Hôm nay</span>
                <h1 className="mt-3 text-[28px] font-extrabold leading-[1.08] tracking-[-0.045em] text-[var(--text-primary)] sm:text-[31px]">Chào Hải!</h1>
                <p className="mt-2 max-w-md text-sm leading-5 text-[var(--text-secondary)] sm:leading-6">Tiếp tục bài học hôm nay theo đúng nhịp của bạn.</p>
                <div className="mt-4 flex min-w-0 flex-col items-start gap-2 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <Link href={nextActivity?.targetUrl ?? '/review'} className="w-full sm:w-auto">
                    <Button variant="primary" size="lg" className="min-h-12 w-full rounded-2xl px-6 sm:w-auto" rightIcon={<ArrowRight className="h-4 w-4" />}>Tiếp tục học</Button>
                  </Link>
                  <span className="text-[11px] font-semibold leading-4 text-[var(--text-secondary)] sm:text-xs">{effectivePlan.activities.length} hoạt động được ưu tiên cho bạn</span>
                </div>
              </div>
              <LanguageBrainVisual />
            </div>
          </section>

          <section aria-label="Tóm tắt hôm nay" className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
            <div className="lingua-card flex min-w-[76%] snap-start items-center gap-3 p-4 sm:min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-blue)] text-[var(--action-primary)]"><Target className="h-5 w-5" /></span>
              <div className="min-w-0"><div className="text-xs font-medium text-[var(--text-muted)]">Mục tiêu hôm nay</div><div className="mt-0.5 text-base font-extrabold text-[var(--text-primary)]">{completedMinutes}/{targetMinutes} phút</div></div>
            </div>
            <div className="lingua-card flex min-w-[76%] snap-start items-center gap-3 p-4 sm:min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--status-warning-bg)] text-[var(--status-warning)]"><Flame className="h-5 w-5 fill-current" /></span>
              <div className="min-w-0"><div className="text-xs font-medium text-[var(--text-muted)]">Chuỗi học tập</div><div className="mt-0.5 text-base font-extrabold text-[var(--text-primary)]">{initialStreakDays} ngày</div></div>
            </div>
            <div className="lingua-card flex min-w-[76%] snap-start items-center gap-3 p-4 sm:min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-lilac)] text-[var(--accent-purple)]"><Trophy className="h-5 w-5" /></span>
              <div className="min-w-0"><div className="text-xs font-medium text-[var(--text-muted)]">Thành tích</div><div className="mt-0.5 text-base font-extrabold text-[var(--text-primary)]">{completedActivitiesCount}/{totalActivitiesCount} hoàn thành</div></div>
            </div>
          </section>

          <section aria-labelledby="learning-progress-heading" className="lingua-card min-w-0 overflow-hidden p-4 sm:p-6 lg:p-7">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="lingua-kicker text-[var(--accent-teal-strong)]">Language Brain</div>
                <h2 id="learning-progress-heading" className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">Your Learning Progress</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">Một cái nhìn nhanh về nhịp học và độ bền trí nhớ hôm nay.</p>
              </div>
              <Link href="/progress" className="flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-bold text-[var(--action-primary)] hover:bg-[var(--surface-blue)] sm:px-3">Xem chi tiết <ChevronRight className="h-3.5 w-3.5" /></Link>
            </div>

            <div className="mt-5 grid min-w-0 items-center gap-5 sm:mt-6 sm:gap-7 lg:grid-cols-[200px_minmax(0,1fr)]">
              <div className="mx-auto flex flex-col items-center">
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full sm:h-44 sm:w-44" style={{ background: `conic-gradient(var(--accent-teal) ${progressPercent * 3.6}deg, #e8ece8 0deg)` }}>
                  <div className="absolute inset-[11px] rounded-full bg-white shadow-[inset_0_0_0_1px_var(--border-subtle)] sm:inset-[13px]" />
                  <div className="relative z-10 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)] sm:text-[11px]">Today</div>
                    <div className="mt-1 text-3xl font-black tracking-[-0.06em] text-[var(--text-primary)] sm:text-4xl">{progressPercent}%</div>
                    <div className="mt-1 text-[11px] font-semibold text-[var(--accent-teal-strong)] sm:text-xs">{completedMinutes}/{targetMinutes} min</div>
                  </div>
                </div>
                <div className="mt-3 rounded-full bg-[var(--surface-blue)] px-3 py-1 text-xs font-extrabold text-[var(--action-primary)]">CEFR journey • B1</div>
              </div>

              <div className="min-w-0 space-y-4">
                {[
                  ['Daily goal', progressPercent, 'var(--action-primary)'],
                  ['Memory health', initialMemoryHealth, 'var(--accent-teal)'],
                  ['Activities', totalActivitiesCount > 0 ? Math.round((completedActivitiesCount / totalActivitiesCount) * 100) : 0, 'var(--accent-purple)'],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-[var(--text-secondary)]">{label}</span><span className="font-extrabold text-[var(--text-primary)]">{value}%</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${value}%`, background: String(color) }} /></div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-1 sm:gap-3">
                  <div className="rounded-2xl bg-[var(--accent-teal-soft)] p-3"><div className="text-[11px] font-semibold text-[var(--text-muted)]">Memory</div><div className="mt-1 text-lg font-extrabold text-[var(--accent-teal-strong)]">{initialMemoryHealth}%</div></div>
                  <div className="rounded-2xl bg-[var(--surface-warm)] p-3"><div className="text-[11px] font-semibold text-[var(--text-muted)]">Today plan</div><div className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{totalActivitiesCount} tasks</div></div>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="timeline-heading" className="lingua-card min-w-0 p-4 sm:p-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div className="min-w-0"><div className="lingua-kicker">Kế hoạch cá nhân</div><h2 id="timeline-heading" className="mt-1 text-lg font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">Today's Activity</h2></div>
              <span className="hidden text-xs font-semibold text-[var(--text-muted)] md:block">Giữ nguyên thứ tự ưu tiên từ server</span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {effectivePlan.activities.map((activity: TodayActivityViewModel) => (
                <div key={activity.id} className="flex min-w-0 flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {activityIcon(activity.type)}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="line-clamp-2 min-w-0 text-sm font-bold leading-5 text-[var(--text-primary)] sm:truncate">{activity.title}</h3>
                        {activity.completed ? <Badge variant="success" size="sm" icon={<CheckCircle2 className="h-3 w-3" />}>Đã xong</Badge> : <Badge variant={activity.badgeVariant} size="sm">{activity.badgeLabel}</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{activity.reasonText}</p>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-1.5 sm:self-center">
                    <Link href={activity.targetUrl} className="min-w-0"><Button className="w-full sm:w-auto" variant={activity.completed ? 'secondary' : activity.type === 'review' ? 'primary' : 'outline'} size="sm" onClick={() => onActivityStart?.(activity.id)}>{activity.completed ? getCompletedActionLabel(activity.type) : getPendingActionLabel(activity.type)}</Button></Link>
                    {!activity.completed && <Button className="w-full sm:w-auto" variant="ghost" size="sm" disabled={isCompleting(activity.id)} onClick={() => void completeActivity(activity.id, activity.durationMinutes * 60)} aria-label={`Hoàn thành hoạt động ${activity.title}`}>{isCompleting(activity.id) ? 'Đang xử lý...' : 'Hoàn thành'}</Button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside aria-label="Hành trình học tập" className="min-w-0 space-y-4 xl:sticky xl:top-8 xl:self-start">
          <section className="rounded-[24px] border border-[#efe5d3] bg-[var(--surface-warm)] p-4 shadow-[var(--shadow-card)] sm:rounded-[26px] sm:p-5">
            <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="lingua-kicker text-[#9b773f]">My Journey</div><h2 className="mt-1 truncate text-lg font-extrabold text-[var(--text-primary)]">Keep going, Hải</h2></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--status-warning)] shadow-sm"><CalendarDays className="h-5 w-5" /></span></div>
            <div className="mt-4 space-y-3 sm:mt-5">
              <div className="rounded-2xl bg-white/80 p-3.5"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-[var(--text-secondary)]">Weekly rhythm</span><span className="font-extrabold text-[var(--text-primary)]">{initialStreakDays} days</span></div><div className="mt-3 flex gap-1.5">{Array.from({ length: 7 }).map((_, index) => <span key={index} className={`h-7 flex-1 rounded-lg ${index < Math.min(initialStreakDays, 7) ? 'bg-[var(--accent-teal)]' : 'bg-[var(--surface-subtle)]'}`} />)}</div></div>
              <Link href="/brain" className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/80 p-3.5 transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-teal-soft)] text-[var(--accent-teal-strong)]"><Sparkles className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[var(--text-primary)]">Language Brain</span><span className="block truncate text-[11px] text-[var(--text-secondary)]">Memory health {initialMemoryHealth}%</span></span><ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" /></Link>
            </div>
          </section>

          <section className="lingua-card min-w-0 p-4 sm:p-5">
            <div className="lingua-kicker">Featured Content</div>
            <div className="mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--surface-blue)] to-[var(--surface-lilac)] p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--action-primary)] shadow-sm"><BookOpen className="h-5 w-5" /></span>
              <h3 className="mt-4 text-sm font-extrabold text-[var(--text-primary)]">Đọc một chút, nhớ lâu hơn</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Khám phá nội dung phù hợp trình độ và gặp lại từ vựng trong ngữ cảnh thật.</p>
              <Link href="/library" className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-[var(--action-primary)]">Mở thư viện <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <Link href="/read" className="mt-3 flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-subtle)] p-3 transition-colors hover:bg-[var(--surface-subtle)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-lilac)] text-[var(--accent-purple)]"><Headphones className="h-4 w-4" /></span><span className="min-w-0 flex-1 text-xs font-bold text-[var(--text-primary)]">Reader & contextual learning</span><ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
