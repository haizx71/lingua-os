/**
 * Authoritative product-readiness evaluation.
 *
 * Sol's frozen predicate requires ALL:
 * 1. Resolved authenticated actor session.
 * 2. Valid learner bootstrap/profile with ID.
 * 3. Confirmed valid IANA timezone.
 * 4. Actor-owned active vi -> en LanguageProfile.
 * 5. Valid persisted goal (must belong to canonical LearningGoal registry).
 * 6. Valid persisted dailyMinutes numeric integer between 5 and 180 inclusive.
 *
 * Starting Level is explicitly OPTIONAL; unestimated learners are fully product-ready.
 */
import { isLearningGoal } from './enums';
import type { LearningGoal } from './api/dtos';

export function isValidIanaTimeZone(tz: string | null | undefined): boolean {
  if (!tz || typeof tz !== 'string') return false;
  const trimmed = tz.trim();
  if (!trimmed) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export function isLanguageProfileReady(
  profile: {
    readonly nativeLanguageCode?: string | null;
    readonly targetLanguageCode?: string | null;
    readonly status?: string | null;
    readonly goal?: unknown;
    readonly dailyMinutes?: unknown;
  } | null | undefined
): profile is {
  readonly nativeLanguageCode: 'vi';
  readonly targetLanguageCode: 'en';
  readonly status: 'active';
  readonly goal: LearningGoal;
  readonly dailyMinutes: number;
} {
  if (!profile) return false;
  if (profile.nativeLanguageCode !== 'vi' || profile.targetLanguageCode !== 'en') return false;
  if (profile.status !== 'active') return false;
  if (!isLearningGoal(profile.goal)) return false;
  if (
    typeof profile.dailyMinutes !== 'number' ||
    !Number.isInteger(profile.dailyMinutes) ||
    profile.dailyMinutes < 5 ||
    profile.dailyMinutes > 180
  ) {
    return false;
  }
  return true;
}

export interface EvaluateProductReadinessInput {
  readonly actorId: string | null | undefined;
  readonly meProfile: {
    readonly id?: string | null;
    readonly timeZone?: string | null;
  } | null | undefined;
  readonly languageProfiles: readonly {
    readonly id: string;
    readonly nativeLanguageCode?: string | null;
    readonly targetLanguageCode?: string | null;
    readonly status?: string | null;
    readonly goal?: unknown;
    readonly dailyMinutes?: unknown;
  }[] | null | undefined;
}

export interface ProductReadinessEvaluation {
  readonly isReady: boolean;
  readonly timeZone: string | null;
  readonly activeLanguageProfileId: string | null;
}

export function evaluateProductReadiness(input: EvaluateProductReadinessInput): ProductReadinessEvaluation {
  if (!input.actorId || !input.meProfile?.id) {
    return { isReady: false, timeZone: null, activeLanguageProfileId: null };
  }
  const rawTz = input.meProfile.timeZone?.trim() || null;
  if (!isValidIanaTimeZone(rawTz)) {
    return { isReady: false, timeZone: rawTz, activeLanguageProfileId: null };
  }
  const activeProfile = input.languageProfiles?.find(isLanguageProfileReady);
  if (!activeProfile) {
    return { isReady: false, timeZone: rawTz, activeLanguageProfileId: null };
  }
  return {
    isReady: true,
    timeZone: rawTz,
    activeLanguageProfileId: activeProfile.id,
  };
}
