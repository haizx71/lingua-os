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
  Sun,
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
  return (
    <div
      aria-hidden
      className="relative min-h-[190px] w-full overflow-hidden bg-[linear-gradient(145deg,#dff5f0_0%,#dce9ff_58%,#f8e8bb_100%)] transition-colors duration-300 dark:bg-[linear-gradient(145deg,#2c3f72_0%,#17233f_56%,#11182d_100%)] sm:min-h-[220px]"
    >
      <div className="absolute inset-0 opacity-80 dark:opacity-100">
        <div className="absolute -left-10 -top-12 h-40 w-40 rounded-full bg-white/35 blur-2xl dark:bg-[#6d83d8]/10" />
        <div className="absolute right-8 top-5 h-12 w-12 rounded-full bg-[#ffd978] shadow-[0_0_28px_rgba(255,217,120,0.38)] dark:hidden" />
        <div className="absolute right-8 top-5 hidden h-11 w-11 rounded-full bg-[#ffe8a8] shadow-[0_0_26px_rgba(255,232,168,0.30)] dark:block">
          <span className="absolute -left-2 -top-2 h-11 w-11 rounded-full bg-[#25345d]" />
        </div>
        <span className="absolute right-[26%] top-[17%] hidden h-1.5 w-1.5 rounded-full bg-white/85 dark:block" />
        <span className="absolute right-[12%] top-[31%] hidden h-1 w-1 rounded-full bg-[#a8baff] dark:block" />
        <span className="absolute right-[39%] top-[10%] hidden h-1 w-1 rounded-full bg-white/70 dark:block" />
      </div>

      <div className="absolute left-4 top-4 hidden rounded-2xl border border-white/50 bg-white/70 px-3 py-2 text-[10px] font-bold leading-4 text-[#52617f] shadow-sm backdrop-blur md:block dark:border-white/10 dark:bg-[#1d2946]/80 dark:text-[#aeb9d8]">
        Small steps<br />Big progress
      </div>

      <div className="absolute right-4 top-12 z-20 hidden flex-col gap-2 lg:flex">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-white/88 px-3 py-1.5 text-[9px] font-extrabold tracking-[0.08em] text-[#3155b7] shadow-sm dark:border-white/10 dark:bg-[#1d2946]/88 dark:text-[#a9bbff]">
          <BookOpen className="h-3.5 w-3.5" /> READ
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-[#f1edff]/92 px-3 py-1.5 text-[9px] font-extrabold tracking-[0.08em] text-[#7455bd] shadow-sm dark:border-white/10 dark:bg-[#2b2447]/90 dark:text-[#c2b1ff]">
          <Sparkles className="h-3.5 w-3.5" /> BRAIN
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-[#fff3cf]/94 px-3 py-1.5 text-[9px] font-extrabold tracking-[0.08em] text-[#a56b00] shadow-sm dark:border-white/10 dark:bg-[#3a2e18]/92 dark:text-[#ffd878]">
          <CheckCircle2 className="h-3.5 w-3.5" /> REVIEW
        </span>
      </div>

      <svg
        viewBox="0 0 560 250"
        className="absolute inset-x-0 bottom-0 h-full w-full"
        role="presentation"
      >
        <defs>
          <linearGradient id="hoodieGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#263552" />
            <stop offset="100%" stopColor="#131d33" />
          </linearGradient>
          <linearGradient id="hairGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#27365f" />
            <stop offset="100%" stopColor="#10182d" />
          </linearGradient>
          <linearGradient id="deskGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a77860" />
            <stop offset="100%" stopColor="#7d5548" />
          </linearGradient>
        </defs>

        <rect x="0" y="215" width="560" height="35" fill="url(#deskGradient)" opacity="0.95" />
        <ellipse cx="360" cy="218" rx="92" ry="10" fill="#0a1020" opacity="0.20" />

        <g opacity="0.96">
          <rect x="62" y="168" width="92" height="15" rx="5" fill="#24304d" />
          <rect x="58" y="184" width="101" height="15" rx="5" fill="#2d3857" />
          <rect x="66" y="200" width="94" height="15" rx="5" fill="#1f2a45" />
          <text x="88" y="179" fill="#95a8df" fontSize="9" fontWeight="700">READ</text>
          <text x="88" y="195" fill="#b5a2e7" fontSize="9" fontWeight="700">BRAIN</text>
          <text x="88" y="211" fill="#e7c88a" fontSize="9" fontWeight="700">REVIEW</text>
        </g>

        <g>
          <rect x="164" y="178" width="34" height="38" rx="10" fill="#c58c5d" />
          <rect x="169" y="184" width="24" height="28" rx="8" fill="#9f714d" />
          <ellipse cx="178" cy="169" rx="12" ry="22" fill="#4f896d" transform="rotate(-23 178 169)" />
          <ellipse cx="192" cy="168" rx="11" ry="21" fill="#72a87a" transform="rotate(22 192 168)" />
          <ellipse cx="184" cy="154" rx="10" ry="20" fill="#5f9c76" />
        </g>

        <g transform="translate(405 154)">
          <rect x="0" y="4" width="88" height="55" rx="8" fill="#111a31" />
          <path d="M8 10h72v42H8z" fill="#1c2a4a" />
          <path d="M12 59h83l-9 9H18z" fill="#8d746f" />
          <circle cx="44" cy="30" r="5" fill="#6e8aee" />
        </g>

        <g transform="translate(430 93)">
          <rect x="23" y="18" width="10" height="78" rx="5" fill="#1c2740" />
          <path d="M28 18c31 0 48 17 48 37H28z" fill="#273657" />
          <ellipse cx="29" cy="58" rx="35" ry="15" fill="#ffd893" opacity="0.22" />
          <circle cx="28" cy="52" r="8" fill="#ffe5aa" />
        </g>

        <g transform="translate(192 46)">
          <ellipse cx="108" cy="159" rx="81" ry="15" fill="#08101f" opacity="0.16" />

          <path d="M66 118c-24 8-38 32-37 69h158c2-36-14-60-42-69z" fill="url(#hoodieGradient)" />
          <path d="M50 154c16 6 32 9 49 9s36-3 58-11" fill="none" stroke="#33456e" strokeWidth="4" strokeLinecap="round" opacity="0.55" />

          <ellipse cx="106" cy="94" rx="55" ry="54" fill="#ffd5bd" />
          <ellipse cx="60" cy="100" rx="10" ry="15" fill="#f3b99d" />
          <ellipse cx="152" cy="100" rx="10" ry="15" fill="#f3b99d" />

          <path d="M55 86c0-43 33-66 71-60 23 3 43 19 48 43-12-11-25-17-42-18-26-1-46 12-59 33-7 12-11 24-12 37-5-10-6-21-6-35z" fill="url(#hairGradient)" />
          <path d="M72 66c10-29 37-43 69-34-12 3-23 10-31 20 19-7 38-5 53 7-13-2-25 2-37 10-15-6-34-7-54-3z" fill="#334373" />
          <path d="M94 35c10-18 29-26 45-17-11 5-17 12-18 23z" fill="#27365f" />

          <ellipse cx="85" cy="97" rx="11" ry="14" fill="#2a2430" />
          <ellipse cx="128" cy="97" rx="11" ry="14" fill="#2a2430" />
          <circle cx="89" cy="92" r="4" fill="#ffffff" />
          <circle cx="132" cy="92" r="4" fill="#ffffff" />
          <path d="M99 119c6 5 13 5 19 0" fill="none" stroke="#c87972" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="73" cy="113" rx="11" ry="5" fill="#f2a6a1" opacity="0.46" />
          <ellipse cx="140" cy="113" rx="11" ry="5" fill="#f2a6a1" opacity="0.46" />

          <path d="M58 158c15-10 27-13 39-12" fill="none" stroke="#ffd5bd" strokeWidth="15" strokeLinecap="round" />
          <path d="M156 157c-12-11-24-15-36-15" fill="none" stroke="#ffd5bd" strokeWidth="15" strokeLinecap="round" />
          <circle cx="58" cy="158" r="8" fill="#ffd5bd" />
          <circle cx="156" cy="157" r="8" fill="#ffd5bd" />
        </g>

        <g transform="translate(316 170)">
          <ellipse cx="30" cy="36" rx="32" ry="22" fill="#83879a" />
          <ellipse cx="20" cy="19" rx="19" ry="19" fill="#9095a8" />
          <path d="M6 10l9-13 7 15zM28 10l12-11 2 17z" fill="#7f8498" />
          <ellipse cx="14" cy="20" rx="3" ry="2" fill="#252a36" />
          <ellipse cx="27" cy="20" rx="3" ry="2" fill="#252a36" />
          <path d="M17 26c4 3 7 3 11 0" fill="none" stroke="#65585c" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="10" cy="27" rx="5" ry="2.5" fill="#e9a9ad" opacity="0.45" />
          <ellipse cx="32" cy="27" rx="5" ry="2.5" fill="#e9a9ad" opacity="0.45" />
          <path d="M53 39c16-2 23 6 19 15" fill="none" stroke="#7d8295" strokeWidth="6" strokeLinecap="round" />
        </g>

        <path d="M248 204c28-8 59-8 89 0l-2 12h-85z" fill="#f7edd5" />
        <path d="M292 205v10" stroke="#d2c2a5" strokeWidth="2" />
      </svg>

      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0f1728]/15 to-transparent dark:from-black/20" />
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
          <section className="relative min-w-0 overflow-hidden rounded-[28px] border border-[#dbe4f0] bg-[#f7faff] shadow-[0_18px_55px_rgba(31,52,89,0.10)] transition-colors duration-300 dark:border-[#2c3750] dark:bg-[#141d31] sm:rounded-[32px]">
            <div className="grid min-w-0 md:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)]">
              <div className="relative z-10 min-w-0 overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
                <div className="absolute -left-12 -top-20 h-56 w-56 rounded-full bg-[#f7edd0]/55 blur-2xl" />
                <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-[#dce7ff]/55 blur-2xl" />
                <div className="relative min-w-0">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#cfe9df] bg-[#e8f6f1] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#218573] sm:text-[11px]">
                    <Sun className="h-3.5 w-3.5" />
                    Hôm nay
                  </span>

                  <h1 className="mt-4 text-[32px] font-black leading-[1.04] tracking-[-0.055em] text-[#16213a] sm:text-[38px] lg:text-[44px]">
                    Chào <span className="bg-[linear-gradient(90deg,#4c6fff,#7d95ff)] bg-clip-text text-transparent">Hải!</span>
                  </h1>
                  <p className="mt-3 max-w-[34rem] text-sm leading-6 text-[#66728a] sm:text-base">
                    Tiếp tục bài học hôm nay theo đúng nhịp của bạn.
                  </p>

                  <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <Link href={nextActivity?.targetUrl ?? '/review'} className="w-full sm:w-auto">
                      <Button
                        variant="primary"
                        size="lg"
                        className="min-h-12 w-full rounded-2xl bg-[#4f6fe9] px-7 text-white shadow-[0_10px_28px_rgba(79,111,233,0.22)] hover:bg-[#4263dc] sm:w-auto"
                        rightIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        Tiếp tục học
                      </Button>
                    </Link>
                    <span className="text-[11px] font-semibold leading-5 text-[#6d7890] sm:text-xs">
                      {effectivePlan.activities.length} hoạt động được ưu tiên cho bạn
                    </span>
                  </div>
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
