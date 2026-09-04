/**
 * LINGUA OS Semantic Tokens
 * Defines semantic roles for canvas, surface, text, border, actions, focus, status, and learning states.
 * Strictly implements 8 contract concept_status values from contracts/enums.json.
 * Defines purpose-driven semantic motion tokens (Tier 2 of DTCG Motion Token Architecture).
 */

import { primitivePalette, primitiveMotion } from './primitive';

export type ConceptStatus = 
  | 'unseen' 
  | 'discovered' 
  | 'learning' 
  | 'familiar' 
  | 'active' 
  | 'mastered' 
  | 'weak' 
  | 'forgotten';

export const semanticColors = {
  light: {
    canvas: primitivePalette.slate[50],
    surface: primitivePalette.white,
    surfaceSubtle: primitivePalette.slate[100],
    surfaceElevated: primitivePalette.white,
    textPrimary: primitivePalette.slate[900],
    textSecondary: primitivePalette.slate[600],
    textMuted: primitivePalette.slate[400],
    borderSubtle: primitivePalette.slate[200],
    borderDefault: primitivePalette.slate[300],
    borderStrong: primitivePalette.slate[400],
    actionPrimary: primitivePalette.indigo[600],
    actionPrimaryHover: primitivePalette.indigo[700],
    actionPrimaryText: primitivePalette.white,
    actionSecondary: primitivePalette.slate[100],
    actionSecondaryHover: primitivePalette.slate[200],
    actionSecondaryText: primitivePalette.slate[900],
    focusRing: primitivePalette.indigo[500],
    statusSuccess: primitivePalette.emerald[600],
    statusSuccessBg: primitivePalette.emerald[50],
    statusSuccessBorder: primitivePalette.emerald[200],
    statusWarning: primitivePalette.amber[600],
    statusWarningBg: primitivePalette.amber[50],
    statusWarningBorder: primitivePalette.amber[200],
    statusDanger: primitivePalette.rose[600],
    statusDangerBg: primitivePalette.rose[50],
    statusDangerBorder: primitivePalette.rose[200],
    statusInfo: primitivePalette.sky[600],
    statusInfoBg: primitivePalette.sky[50],
    statusInfoBorder: primitivePalette.sky[200],
  },
  dark: {
    canvas: primitivePalette.slate[950],
    surface: primitivePalette.slate[900],
    surfaceSubtle: primitivePalette.slate[800],
    surfaceElevated: primitivePalette.slate[800],
    textPrimary: primitivePalette.slate[100],
    textSecondary: primitivePalette.slate[400],
    textMuted: primitivePalette.slate[500],
    borderSubtle: primitivePalette.slate[800],
    borderDefault: primitivePalette.slate[700],
    borderStrong: primitivePalette.slate[600],
    actionPrimary: primitivePalette.indigo[500],
    actionPrimaryHover: primitivePalette.indigo[600],
    actionPrimaryText: primitivePalette.white,
    actionSecondary: primitivePalette.slate[800],
    actionSecondaryHover: primitivePalette.slate[700],
    actionSecondaryText: primitivePalette.slate[100],
    focusRing: primitivePalette.indigo[400],
    statusSuccess: primitivePalette.emerald[500],
    statusSuccessBg: 'rgba(16, 185, 129, 0.12)',
    statusSuccessBorder: 'rgba(16, 185, 129, 0.3)',
    statusWarning: primitivePalette.amber[500],
    statusWarningBg: 'rgba(245, 158, 11, 0.12)',
    statusWarningBorder: 'rgba(245, 158, 11, 0.3)',
    statusDanger: primitivePalette.rose[500],
    statusDangerBg: 'rgba(244, 63, 94, 0.12)',
    statusDangerBorder: 'rgba(244, 63, 94, 0.3)',
    statusInfo: primitivePalette.sky[500],
    statusInfoBg: 'rgba(14, 165, 233, 0.12)',
    statusInfoBorder: 'rgba(14, 165, 233, 0.3)',
  },
} as const;

export interface ConceptStateDescriptor {
  status: ConceptStatus;
  labelVi: string;
  labelEn: string;
  iconName: string;
  colorRole: 'neutral' | 'info' | 'primary' | 'success' | 'warning' | 'danger';
  borderStyle: 'dashed' | 'solid';
  descriptionVi: string;
}

export const conceptStateMetadata: Record<ConceptStatus, ConceptStateDescriptor> = {
  unseen: {
    status: 'unseen',
    labelVi: 'Chưa gặp',
    labelEn: 'Unseen',
    iconName: 'EyeOff',
    colorRole: 'neutral',
    borderStyle: 'dashed',
    descriptionVi: 'Khái niệm chưa từng xuất hiện trong quá trình học',
  },
  discovered: {
    status: 'discovered',
    labelVi: 'Mới phát hiện',
    labelEn: 'Discovered',
    iconName: 'Sparkles',
    colorRole: 'info',
    borderStyle: 'dashed',
    descriptionVi: 'Vừa được nhận diện trong bài đọc hoặc tra từ điển',
  },
  learning: {
    status: 'learning',
    labelVi: 'Đang học',
    labelEn: 'Learning',
    iconName: 'BookOpen',
    colorRole: 'primary',
    borderStyle: 'solid',
    descriptionVi: 'Đang trong chu kỳ nạp ban đầu, chưa qua 3 lần ôn tập thành công',
  },
  familiar: {
    status: 'familiar',
    labelVi: 'Quen thuộc',
    labelEn: 'Familiar',
    iconName: 'Check',
    colorRole: 'primary',
    borderStyle: 'solid',
    descriptionVi: 'Đã nhận diện tốt khi đọc nhưng phản xạ nghe/dùng còn cần luyện',
  },
  active: {
    status: 'active',
    labelVi: 'Đang luyện',
    labelEn: 'Active',
    iconName: 'Zap',
    colorRole: 'info',
    borderStyle: 'solid',
    descriptionVi: 'Có bằng chứng hiểu và dùng được trong ngữ cảnh',
  },
  mastered: {
    status: 'mastered',
    labelVi: 'Đã nắm vững',
    labelEn: 'Mastered',
    iconName: 'Award',
    colorRole: 'success',
    borderStyle: 'solid',
    descriptionVi: 'Độ ổn định trí nhớ FSRS cao (>30 ngày), đa chiều',
  },
  weak: {
    status: 'weak',
    labelVi: 'Cần củng cố',
    labelEn: 'Weak',
    iconName: 'AlertTriangle',
    colorRole: 'danger',
    borderStyle: 'solid',
    descriptionVi: 'Vừa đánh giá Again hoặc sai nhiều lần trong bài tập',
  },
  forgotten: {
    status: 'forgotten',
    labelVi: 'Đã quên',
    labelEn: 'Forgotten',
    iconName: 'RotateCcw',
    colorRole: 'danger',
    borderStyle: 'dashed',
    descriptionVi: 'Không vượt qua ngưỡng nhớ tối thiểu, cần học lại',
  },
};

export const duePresentationDescriptor: ConceptStateDescriptor = {
  status: 'learning',
  labelVi: 'Đến hạn ôn',
  labelEn: 'Due for Review',
  iconName: 'Clock',
  colorRole: 'warning',
  borderStyle: 'solid',
  descriptionVi: 'Khái niệm đã đến hạn ôn tập theo lịch FSRS',
};

/**
 * LINGUA OS Semantic Motion Tokens
 * Purpose-driven motion timing, easing, distances, and scales.
 * Tier 2 of DTCG Motion Token Architecture.
 */
export const semanticMotion = {
  duration: {
    instant: primitiveMotion.duration[0],
    fast: primitiveMotion.duration[150],
    normal: '250ms', // Calibrated baseline for card flip, popovers, and rating interactions
    slow: primitiveMotion.duration[400],
    feedback: primitiveMotion.duration[200],
  },
  easing: {
    standard: primitiveMotion.easing.standard,
    enter: primitiveMotion.easing.enter,
    exit: primitiveMotion.easing.exit,
    emphasized: primitiveMotion.easing.emphasized,
  },
  distance: {
    reveal: primitiveMotion.distance.md, // 8px entrance reveal
    slide: primitiveMotion.distance.lg,  // 16px lateral queue transition
    micro: primitiveMotion.distance.sm,  // 4px micro offset
  },
  scale: {
    active: primitiveMotion.scale.press,       // 0.98 button/card press
    highlight: primitiveMotion.scale.pulse,    // 1.05 node status upgrade pulse
    feedback: primitiveMotion.scale.feedback,  // 1.02 subtle feedback elevation
  },
} as const;

/** Alias for semanticMotion */
export const motionTokens = semanticMotion;

/**
 * GSAP Easing Token Mappings
 * Standardized easing strings for GreenSock animations, mapped from design tokens.
 */
export const gsapEasings = {
  standard: 'power2.out',
  enter: 'power1.out',
  exit: 'power1.in',
  inOut: 'power1.inOut',
  emphasized: 'power2.out',
  linear: 'none',
} as const;

/** Alias for gsapEasings */
export const motionEasings = gsapEasings;

/**
 * Numeric representations of motion tokens for direct consumption in GSAP tweens.
 */
export const motionNumeric = {
  distance: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 16,
    reveal: 8,
    slide: 16,
    micro: 4,
  },
  scale: {
    press: primitiveMotion.scale.press,       // 0.98
    feedback: primitiveMotion.scale.feedback, // 1.02
    pulse: primitiveMotion.scale.pulse,       // 1.05
    active: primitiveMotion.scale.press,      // 0.98
    highlight: primitiveMotion.scale.pulse,   // 1.05
  },
} as const;

/** Alias for motionNumeric */
export const semanticMotionNumeric = motionNumeric;

/**
 * Converts a duration token string ('250ms', '0ms', '1.5s') to numeric seconds (0.25, 0, 1.5) for GSAP.
 * Safely handles units (ms vs s), whitespace trimming, and non-numeric fallbacks.
 */
export function motionDurationToSeconds(durationToken: string): number {
  if (typeof durationToken !== 'string') return 0;
  const trimmed = durationToken.trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith('ms')) {
    const parsed = parseFloat(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed / 1000;
  }
  if (trimmed.endsWith('s')) {
    const parsed = parseFloat(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(trimmed);
  return Number.isNaN(parsed) ? 0 : parsed / 1000;
}

/**
 * Pre-calculated duration constants in seconds for direct use in GSAP tweens.
 */
export const motionSeconds = {
  instant: 0,
  fast: 0.15,
  feedback: 0.2,
  normal: 0.25,
  slow: 0.4,
  maxSpatial: 0.5,
  staggerStep: 0.05,
  pulseStep: 0.1, // Half of feedback duration (200ms) for 2-step pulse
} as const;

export type SemanticColors = typeof semanticColors;
export type SemanticMotion = typeof semanticMotion;
export type MotionTokens = typeof motionTokens;
export type SemanticMotionDuration = typeof semanticMotion.duration;
export type SemanticMotionDurationKey = keyof SemanticMotionDuration;
export type SemanticMotionEasing = typeof semanticMotion.easing;
export type SemanticMotionEasingKey = keyof SemanticMotionEasing;
export type SemanticMotionDistance = typeof semanticMotion.distance;
export type SemanticMotionDistanceKey = keyof SemanticMotionDistance;
export type SemanticMotionScale = typeof semanticMotion.scale;
export type SemanticMotionScaleKey = keyof SemanticMotionScale;
export type MotionSeconds = typeof motionSeconds;
export type GsapEasings = typeof gsapEasings;
export type MotionEasings = typeof motionEasings;
export type MotionNumeric = typeof motionNumeric;
export type SemanticMotionNumeric = typeof semanticMotionNumeric;
