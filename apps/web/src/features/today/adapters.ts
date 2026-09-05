/**
 * Presentation-only adapters for the Today feature.
 * Strictly DTO-to-view-model mapping; preserves server authority, plan ID, item IDs, and exact item order.
 * Zero client-side sorting, ranking, heuristics, FSRS calculations, or competence mutations.
 */

import type {
  TodayActivityDto,
  TodayPlanDto,
  LearningActivityType,
} from '@lingua/types';

export interface TodayActivityViewModel {
  readonly id: string;
  readonly position: number;
  readonly type: LearningActivityType;
  readonly title: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly badgeLabel: string;
  readonly badgeVariant: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  readonly reasonCodes: readonly string[];
  readonly reasonText: string;
  readonly targetUrl: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  readonly completed: boolean;
  readonly targetCount?: number;
  readonly completedCount?: number;
  readonly contentId?: string;
  readonly conceptId?: string;
  readonly reviewItemId?: string;
  readonly completedAt?: string;
}

export interface TodayPlanViewModel {
  readonly id: string;
  readonly languageProfileId: string;
  readonly planDate: string;
  readonly timeZone: string;
  readonly targetMinutes: number;
  readonly completedMinutes: number;
  readonly status: 'draft' | 'active' | 'completed' | 'expired';
  readonly engineVersion: string;
  readonly activities: readonly TodayActivityViewModel[];
  readonly progressPercent: number;
  readonly isCompleted: boolean;
  readonly completedActivitiesCount: number;
  readonly totalActivitiesCount: number;
}

const activityRoutes: Readonly<Record<LearningActivityType, string>> = {
  review: '/review',
  read: '/read',
  listen: '/read',
  learn: '/dictionary',
};

export function deriveActivityBadgeLabel(activity: TodayActivityDto): string {
  if (activity.activityType === 'review' && (activity.targetCount ?? 0) > 0) {
    return `${activity.targetCount} từ đến hạn`;
  }
  if (activity.activityType === 'learn' && (activity.targetCount ?? 0) > 0) {
    return `${activity.targetCount} từ mới`;
  }
  if (activity.reasonCodes.includes('WEAK_LISTENING')) {
    return 'Củng cố nghe';
  }
  if (activity.reasonCodes.includes('CONTENT_FIT')) {
    return 'Nội dung phù hợp';
  }
  if (activity.reasonCodes.includes('NEW_CONCEPT_BUDGET')) {
    return 'Khám phá từ mới';
  }
  if (activity.reasonCodes.includes('FSRS_DUE')) {
    return 'Ôn tập FSRS';
  }
  return 'Hoạt động hôm nay';
}

export function deriveActivityBadgeVariant(
  activity: TodayActivityDto
): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  if (activity.status === 'completed') return 'success';
  if (activity.reasonCodes.includes('FSRS_DUE') || activity.activityType === 'review') return 'warning';
  if (activity.activityType === 'listen' || activity.reasonCodes.includes('WEAK_LISTENING')) return 'info';
  if (activity.activityType === 'learn') return 'primary';
  return 'neutral';
}

export function mapTodayActivityToViewModel(activity: TodayActivityDto): TodayActivityViewModel {
  const isComplete = activity.status === 'completed';
  return {
    id: activity.id,
    position: activity.position,
    type: activity.activityType,
    title: activity.title,
    description: activity.description,
    durationMinutes: activity.estimatedMinutes,
    badgeLabel: deriveActivityBadgeLabel(activity),
    badgeVariant: deriveActivityBadgeVariant(activity),
    reasonCodes: activity.reasonCodes,
    reasonText: activity.reasonText,
    targetUrl: activityRoutes[activity.activityType] ?? '/today',
    status: activity.status,
    completed: isComplete,
    ...(activity.targetCount !== undefined ? { targetCount: activity.targetCount } : {}),
    ...(activity.completedCount !== undefined ? { completedCount: activity.completedCount } : {}),
    ...(activity.contentId ? { contentId: activity.contentId } : {}),
    ...(activity.conceptId ? { conceptId: activity.conceptId } : {}),
    ...(activity.reviewItemId ? { reviewItemId: activity.reviewItemId } : {}),
    ...(activity.completedAt ? { completedAt: activity.completedAt } : {}),
  };
}

export function mapTodayPlanToViewModel(plan: TodayPlanDto): TodayPlanViewModel {
  // CRITICAL SERVER AUTHORITY:
  // Map activities preserving the exact server-provided array order.
  // Zero local sorting, ranking, or priority calculation!
  const activities = plan.activities.map(mapTodayActivityToViewModel);
  const completedCount = activities.filter((a) => a.completed).length;
  const isCompleted =
    plan.status === 'completed' || (activities.length > 0 && completedCount === activities.length);
  const progressPercent =
    plan.targetMinutes > 0
      ? Math.min(100, Math.round((plan.completedMinutes / plan.targetMinutes) * 100))
      : 0;

  return {
    id: plan.id,
    languageProfileId: plan.languageProfileId,
    planDate: plan.planDate,
    timeZone: plan.timeZone,
    targetMinutes: plan.targetMinutes,
    completedMinutes: plan.completedMinutes,
    status: plan.status,
    engineVersion: plan.engineVersion,
    activities,
    progressPercent,
    isCompleted,
    completedActivitiesCount: completedCount,
    totalActivitiesCount: activities.length,
  };
}
