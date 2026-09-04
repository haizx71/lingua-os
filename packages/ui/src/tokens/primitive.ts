/**
 * LINGUA OS Primitive Tokens
 * DTCG 2025.10 Compliant Primitive Scale
 */

export const primitivePalette = {
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  indigo: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
  },
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  rose: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    500: '#F43F5E',
    600: '#E11D48',
    700: '#BE123C',
  },
  sky: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    500: '#0EA5E9',
    600: '#0284C7',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const primitiveSpace = {
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',      // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
} as const;

export const primitiveRadius = {
  sm: '0.375rem',  // 6px
  md: '0.625rem',  // 10px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  full: '9999px',
} as const;

export const primitiveTypography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {
    display: { desktop: '2.25rem', mobile: '1.875rem', lineHeight: '1.25' },
    h1: { desktop: '1.75rem', mobile: '1.5rem', lineHeight: '1.3' },
    h2: { desktop: '1.375rem', mobile: '1.25rem', lineHeight: '1.35' },
    h3: { desktop: '1.125rem', mobile: '1.0625rem', lineHeight: '1.4' },
    body: { desktop: '1rem', mobile: '0.9375rem', lineHeight: '1.6' },
    bodySm: { desktop: '0.875rem', mobile: '0.8125rem', lineHeight: '1.5' },
    learning: { desktop: '1.25rem', mobile: '1.125rem', lineHeight: '1.6' },
    label: { desktop: '0.8125rem', mobile: '0.75rem', lineHeight: '1.4' },
    data: { desktop: '0.875rem', mobile: '0.8125rem', lineHeight: '1.4' },
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const primitiveMotion = {
  duration: {
    0: '0ms',
    75: '75ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    400: '400ms',
    600: '600ms',
    // Backward-compatible named aliases
    fast: '150ms',
    base: '250ms',
    slow: '400ms',
  },
  easing: {
    linear: 'linear',
    standard: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',   // power2.out equivalent
    enter: 'cubic-bezier(0.0, 0.0, 0.2, 1.0)',      // decelerate / power1.out
    exit: 'cubic-bezier(0.4, 0.0, 1.0, 1.0)',       // accelerate / power1.in
    emphasized: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)', // calm focus curve
    inOut: 'cubic-bezier(0.4, 0.0, 0.2, 1.0)',     // symmetric ease-in-out
  },
  distance: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '16px',
  },
  scale: {
    press: 0.98,
    feedback: 1.02,
    pulse: 1.05,
  },
} as const;

export type PrimitivePalette = typeof primitivePalette;
export type PrimitiveSpace = typeof primitiveSpace;
export type PrimitiveRadius = typeof primitiveRadius;
export type PrimitiveTypography = typeof primitiveTypography;
export type PrimitiveMotion = typeof primitiveMotion;
export type PrimitiveMotionDuration = typeof primitiveMotion.duration;
export type PrimitiveMotionDurationKey = keyof PrimitiveMotionDuration;
export type PrimitiveDuration = PrimitiveMotionDuration;
export type PrimitiveDurationKey = PrimitiveMotionDurationKey;
export type PrimitiveMotionEasing = typeof primitiveMotion.easing;
export type PrimitiveMotionEasingKey = keyof PrimitiveMotionEasing;
export type PrimitiveMotionDistance = typeof primitiveMotion.distance;
export type PrimitiveMotionDistanceKey = keyof PrimitiveMotionDistance;
export type PrimitiveMotionScale = typeof primitiveMotion.scale;
export type PrimitiveMotionScaleKey = keyof PrimitiveMotionScale;
