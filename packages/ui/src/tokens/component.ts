import { motionSeconds, motionNumeric, gsapEasings } from './semantic';

export const componentMotionTokens = {
  button: {
    duration: 'var(--motion-fast)',
    ease: 'var(--motion-ease-standard)',
    scaleActive: 'var(--motion-scale-active)',
  },
  card: {
    duration: 'var(--motion-normal)',
    ease: 'var(--motion-ease-standard)',
  },
  reviewCard: {
    flipDuration: 'var(--motion-normal)',
    flipEase: 'var(--motion-ease-standard)',
    ratingDuration: 'var(--motion-fast)',
    ratingScale: 'var(--motion-scale-active)',
    revealDistance: 'var(--motion-distance-reveal)',
  },
  reviewSession: {
    slideDuration: 'var(--motion-fast)',
    slideEase: 'var(--motion-ease-standard)',
    slideDistance: 'var(--motion-distance-slide)',
  },
  conceptNode: {
    pulseDuration: 'var(--motion-feedback)',
    pulseScale: 'var(--motion-scale-highlight)',
    pulseEase: 'var(--motion-ease-enter)',
  },
  brainCanvas: {
    panDuration: 'var(--motion-slow)',
    panEase: 'var(--motion-ease-standard)',
  },
  progressAnalytics: {
    barDuration: 'var(--motion-normal)',
    barStagger: '50ms',
    barEase: 'var(--motion-ease-enter)',
  },
  modal: {
    enterDuration: 'var(--motion-slow)',
    exitDuration: 'var(--motion-feedback)',
    enterEase: 'var(--motion-ease-enter)',
    exitEase: 'var(--motion-ease-exit)',
  },
  toast: {
    duration: 'var(--motion-feedback)',
    ease: 'var(--motion-ease-enter)',
    distance: 'var(--motion-distance-reveal)',
  },
  tooltip: {
    enterDuration: 'var(--motion-fast)',
    ease: 'var(--motion-ease-enter)',
  },
} as const;

/** Alias for componentMotionTokens */
export const componentMotion = componentMotionTokens;

/**
 * Numeric representations of component-level motion tokens for GSAP tweens.
 */
export const componentMotionNumeric = {
  reviewCard: {
    flipDuration: motionSeconds.normal,
    flipEase: gsapEasings.standard,
    ratingDuration: motionSeconds.fast,
    ratingScaleActive: motionNumeric.scale.active,
    revealDistance: motionNumeric.distance.reveal,
    ratingEase: gsapEasings.standard,
  },
  reviewSession: {
    slideDuration: motionSeconds.fast,
    slideDistance: motionNumeric.distance.slide,
    slideEase: gsapEasings.standard,
  },
  conceptNode: {
    pulseDurationStep: motionSeconds.pulseStep,
    pulseScale: motionNumeric.scale.highlight,
    pulseEaseUp: gsapEasings.enter,
    pulseEaseDown: gsapEasings.inOut,
  },
  brainCanvas: {
    panDuration: motionSeconds.slow,
    panEase: gsapEasings.standard,
  },
  progressAnalytics: {
    barDuration: motionSeconds.normal,
    barStagger: motionSeconds.staggerStep,
    barEase: gsapEasings.standard,
  },
} as const;

export const componentTokens = {
  button: {
    primary: {
      bg: 'var(--action-primary)',
      bgHover: 'var(--action-primary-hover)',
      text: 'var(--action-primary-text)',
    },
    secondary: {
      bg: 'var(--action-secondary)',
      bgHover: 'var(--action-secondary-hover)',
      text: 'var(--action-secondary-text)',
      border: 'var(--border-subtle)',
    },
    outline: {
      bg: 'transparent',
      border: 'var(--border-default)',
      text: 'var(--text-primary)',
    },
    ghost: {
      bg: 'transparent',
      bgHover: 'var(--surface-subtle)',
      text: 'var(--text-secondary)',
    },
    motion: componentMotionTokens.button,
  },
  card: {
    bg: 'var(--surface)',
    border: 'var(--border-subtle)',
    radius: 'var(--radius-lg)',
    padding: '1.25rem',
    motion: componentMotionTokens.card,
  },
  reviewCard: componentMotionTokens.reviewCard,
  reviewSession: componentMotionTokens.reviewSession,
  conceptNode: componentMotionTokens.conceptNode,
  brainCanvas: componentMotionTokens.brainCanvas,
  progressAnalytics: componentMotionTokens.progressAnalytics,
  chip: {
    bg: 'var(--surface-subtle)',
    border: 'var(--border-subtle)',
    text: 'var(--text-primary)',
    radius: 'var(--radius-full)',
  },
  badge: {
    bg: 'var(--surface-subtle)',
    text: 'var(--text-secondary)',
    radius: 'var(--radius-sm)',
  },
  navigation: {
    sidebarBg: 'var(--surface)',
    sidebarBorder: 'var(--border-subtle)',
    itemActiveBg: 'var(--status-info-bg)',
    itemActiveText: 'var(--action-primary)',
    itemInactiveText: 'var(--text-secondary)',
    itemHoverBg: 'var(--surface-subtle)',
  },
  progress: {
    trackBg: 'var(--surface-subtle)',
    fillPrimary: 'var(--action-primary)',
    fillSuccess: 'var(--status-success)',
    fillWarning: 'var(--status-warning)',
  },
  skeleton: {
    bg: 'var(--surface-subtle)',
    radius: 'var(--radius-md)',
  },
  motion: componentMotionTokens,
} as const;

export type ComponentMotionTokens = typeof componentMotionTokens;
export type ComponentMotion = typeof componentMotion;
export type ComponentMotionNumeric = typeof componentMotionNumeric;
export type ComponentTokens = typeof componentTokens;
