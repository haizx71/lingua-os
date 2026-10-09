import { describe, it, expect, expectTypeOf } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderHook, act } from '@testing-library/react';
import {
  primitivePalette,
  primitiveSpace,
  primitiveRadius,
  primitiveTypography,
  primitiveMotion,
  type PrimitiveMotion,
  type PrimitiveMotionDuration,
  type PrimitiveMotionDurationKey,
  type PrimitiveMotionEasing,
  type PrimitiveMotionEasingKey,
  type PrimitiveMotionDistance,
  type PrimitiveMotionDistanceKey,
  type PrimitiveMotionScale,
  type PrimitiveMotionScaleKey,
} from '@lingua/ui/tokens/primitive';
import {
  semanticColors,
  semanticMotion,
  motionTokens,
  motionDurationToSeconds,
  motionSeconds,
  conceptStateMetadata,
  type ConceptStatus,
  type SemanticMotion,
  type SemanticMotionDuration,
  type SemanticMotionDurationKey,
  type SemanticMotionEasing,
  type SemanticMotionEasingKey,
  type SemanticMotionDistance,
  type SemanticMotionDistanceKey,
  type SemanticMotionScale,
  type SemanticMotionScaleKey,
} from '@lingua/ui/tokens/semantic';
import {
  componentTokens,
  componentMotionTokens,
  componentMotion,
  type ComponentMotionTokens,
  type ComponentMotion,
  type ComponentTokens,
} from '@lingua/ui/tokens/component';
import { usePrefersReducedMotion } from '@lingua/ui/hooks/usePrefersReducedMotion';
import enumsContract from '../../contracts/enums.json';
import { getContrastRatio } from './harness/a11y-helpers';

function readCssColor(block: string, token: string): string {
  const value = block.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`Missing CSS color token: ${token}`);
  return value;
}

function flattenCssColor(value: string, background: string): string {
  if (value.startsWith('#')) return value;
  const rgba = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*([\d.]+)?\s*\)/i);
  if (!rgba) throw new Error(`Unsupported CSS color token: ${value}`);
  const base = background.slice(1);
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  const channels = [0, 2, 4].map((offset, index) => {
    const foregroundChannel = Number(rgba[index + 1]);
    const backgroundChannel = Number.parseInt(base.slice(offset, offset + 2), 16);
    return Math.round(foregroundChannel * alpha + backgroundChannel * (1 - alpha));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

describe('Design Tokens Specification (Unit Tests)', () => {
  // =========================================================================
  // 1. Primitive Tokens
  // =========================================================================
  describe('Primitive Tokens', () => {
    it('has standard neutral slate palette with all required tones', () => {
      expect(primitivePalette.slate[50]).toBe('#F8FAFC');
      expect(primitivePalette.slate[900]).toBe('#0F172A');
      expect(primitivePalette.slate[950]).toBe('#020617');
    });

    it('has 4px base grid spacing scale', () => {
      expect(primitiveSpace[1]).toBe('0.25rem'); // 4px
      expect(primitiveSpace[2]).toBe('0.5rem');  // 8px
      expect(primitiveSpace[4]).toBe('1rem');    // 16px
      expect(primitiveSpace[6]).toBe('1.5rem');  // 24px
    });

    it('has consistent radius scale', () => {
      expect(primitiveRadius.sm).toBe('0.375rem');
      expect(primitiveRadius.md).toBe('0.625rem');
      expect(primitiveRadius.lg).toBe('1rem');
      expect(primitiveRadius.full).toBe('9999px');
    });

    it('defines responsive typography sizes with line heights', () => {
      expect(primitiveTypography.fontSize.h1.desktop).toBe('1.75rem');
      expect(primitiveTypography.fontSize.h1.mobile).toBe('1.5rem');
      expect(primitiveTypography.fontSize.learning.desktop).toBe('1.25rem');
    });

    describe('Primitive Motion Scale (DTCG Tier 1)', () => {
      it('defines complete primitive duration scale with numeric keys and ms units', () => {
        expect(primitiveMotion.duration[0]).toBe('0ms');
        expect(primitiveMotion.duration[75]).toBe('75ms');
        expect(primitiveMotion.duration[150]).toBe('150ms');
        expect(primitiveMotion.duration[200]).toBe('200ms');
        expect(primitiveMotion.duration[300]).toBe('300ms');
        expect(primitiveMotion.duration[400]).toBe('400ms');
        expect(primitiveMotion.duration[600]).toBe('600ms');

        // Backwards compatibility named aliases
        expect(primitiveMotion.duration.fast).toBe('150ms');
        expect(primitiveMotion.duration.base).toBe('250ms');
        expect(primitiveMotion.duration.slow).toBe('400ms');

        // Verify valid format for all durations
        Object.values(primitiveMotion.duration).forEach((val) => {
          expect(val).toMatch(/^\d+ms$/);
        });
      });

      it('defines primitive easing curves matching motion specification', () => {
        expect(primitiveMotion.easing.linear).toBe('linear');
        expect(primitiveMotion.easing.standard).toBe('cubic-bezier(0.2, 0.0, 0.0, 1.0)');
        expect(primitiveMotion.easing.enter).toBe('cubic-bezier(0.0, 0.0, 0.2, 1.0)');
        expect(primitiveMotion.easing.exit).toBe('cubic-bezier(0.4, 0.0, 1.0, 1.0)');
        expect(primitiveMotion.easing.emphasized).toBe('cubic-bezier(0.2, 0.0, 0.0, 1.0)');
        expect(primitiveMotion.easing.inOut).toBe('cubic-bezier(0.4, 0.0, 0.2, 1.0)');

        // Validate easing curve syntax
        const easingRegex = /^(linear|cubic-bezier\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\))$/;
        Object.values(primitiveMotion.easing).forEach((ease) => {
          expect(ease).toMatch(easingRegex);
        });
      });

      it('defines sub-grid spatial distance tokens in pixels', () => {
        expect(primitiveMotion.distance.xs).toBe('2px');
        expect(primitiveMotion.distance.sm).toBe('4px');
        expect(primitiveMotion.distance.md).toBe('8px');
        expect(primitiveMotion.distance.lg).toBe('16px');

        // Validate distance syntax and ascending order
        const xs = parseInt(primitiveMotion.distance.xs, 10);
        const sm = parseInt(primitiveMotion.distance.sm, 10);
        const md = parseInt(primitiveMotion.distance.md, 10);
        const lg = parseInt(primitiveMotion.distance.lg, 10);

        expect(xs).toBeLessThan(sm);
        expect(sm).toBeLessThan(md);
        expect(md).toBeLessThan(lg);
      });

      it('defines GPU transform scale multipliers with valid bounds', () => {
        expect(primitiveMotion.scale.press).toBe(0.98);
        expect(primitiveMotion.scale.feedback).toBe(1.02);
        expect(primitiveMotion.scale.pulse).toBe(1.05);

        // Mathematical bounds
        expect(primitiveMotion.scale.press).toBeLessThan(1.0);
        expect(primitiveMotion.scale.feedback).toBeGreaterThan(1.0);
        expect(primitiveMotion.scale.pulse).toBeGreaterThan(primitiveMotion.scale.feedback);
      });
    });
  });

  // =========================================================================
  // 2. Semantic Tokens
  // =========================================================================
  describe('Semantic Tokens', () => {
    it('defines contrast-compliant light and dark mode colors', () => {
      expect(semanticColors.light.canvas).toBe(primitivePalette.slate[50]);
      expect(semanticColors.dark.canvas).toBe(primitivePalette.slate[950]);
      expect(semanticColors.light.actionPrimary).toBe(primitivePalette.indigo[600]);
      expect(semanticColors.light.statusSuccess).toBe(primitivePalette.emerald[600]);
      expect(semanticColors.light.statusWarning).toBe(primitivePalette.amber[600]);
      expect(semanticColors.light.statusDanger).toBe(primitivePalette.rose[600]);
    });

    it('keeps theme-muted and semantic status text at WCAG AA contrast on their surfaces', () => {
      const themeCssPath = path.resolve(__dirname, '../../packages/ui/src/tokens/theme.css');
      const css = fs.readFileSync(themeCssPath, 'utf-8');
      const light = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
      const dark = css.match(/\.dark\s*\{([\s\S]*?)\}/)?.[1];
      expect(light).toBeTruthy();
      expect(dark).toBeTruthy();
      if (!light || !dark) throw new Error('Theme light/dark token blocks are missing.');

      const lightMuted = readCssColor(light, 'text-muted');
      for (const surfaceToken of ['surface', 'canvas', 'surface-subtle', 'surface-lilac']) {
        expect(getContrastRatio(lightMuted, readCssColor(light, surfaceToken)), `light muted on ${surfaceToken}`).toBeGreaterThanOrEqual(4.5);
      }

      const lightStatusTokens = ['success', 'warning', 'danger', 'info'] as const;
      for (const status of lightStatusTokens) {
        expect(
          getContrastRatio(readCssColor(light, `status-${status}`), readCssColor(light, `status-${status}-bg`)),
          `light ${status} status text on its background`
        ).toBeGreaterThanOrEqual(4.5);
      }

      const darkSurface = readCssColor(dark, 'surface');
      const darkMuted = readCssColor(dark, 'text-muted');
      for (const surfaceToken of ['surface', 'canvas', 'surface-subtle', 'surface-lilac']) {
        expect(getContrastRatio(darkMuted, readCssColor(dark, surfaceToken)), `dark muted on ${surfaceToken}`).toBeGreaterThanOrEqual(4.5);
      }

      for (const status of lightStatusTokens) {
        const foreground = readCssColor(dark, `status-${status}`);
        const background = flattenCssColor(readCssColor(dark, `status-${status}-bg`), darkSurface);
        expect(getContrastRatio(foreground, background), `dark ${status} status text on its composited background`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('maps all 8 contract concept statuses from contracts/enums.json with icons and Vietnamese labels', () => {
      const contractStatuses = enumsContract.concept_status as ConceptStatus[];

      contractStatuses.forEach((status) => {
        const meta = conceptStateMetadata[status];
        expect(meta, `Metadata should exist for status: ${status}`).toBeDefined();
        expect(meta.labelVi).toBeTruthy();
        expect(meta.iconName).toBeTruthy();
        expect(meta.colorRole).toBeTruthy();
        expect(meta.borderStyle).toMatch(/solid|dashed/);
      });
    });

    describe('Semantic Motion Tokens (DTCG Tier 2)', () => {
      it('defines purpose-driven semantic durations obeying non-blocking timing limits', () => {
        expect(semanticMotion.duration.instant).toBe('0ms');
        expect(semanticMotion.duration.fast).toBe('150ms');
        expect(semanticMotion.duration.normal).toBe('250ms');
        expect(semanticMotion.duration.slow).toBe('400ms');
        expect(semanticMotion.duration.feedback).toBe('200ms');

        // Invariant 1: Primary interaction feedback must be <= 300ms
        const fastMs = parseInt(semanticMotion.duration.fast, 10);
        const feedbackMs = parseInt(semanticMotion.duration.feedback, 10);
        const normalMs = parseInt(semanticMotion.duration.normal, 10);
        const slowMs = parseInt(semanticMotion.duration.slow, 10);

        expect(fastMs).toBeLessThanOrEqual(150);
        expect(feedbackMs).toBeLessThanOrEqual(200);
        expect(normalMs).toBeLessThanOrEqual(300);
        expect(slowMs).toBeLessThanOrEqual(500); // Spatial max limit
      });

      it('defines semantic distances derived from primitive spatial tokens', () => {
        expect(semanticMotion.distance.reveal).toBe(primitiveMotion.distance.md); // 8px
        expect(semanticMotion.distance.slide).toBe(primitiveMotion.distance.lg);  // 16px
        expect(semanticMotion.distance.micro).toBe(primitiveMotion.distance.sm);  // 4px
        expect(semanticMotion.distance.reveal).toBe('8px');
        expect(semanticMotion.distance.slide).toBe('16px');
        expect(semanticMotion.distance.micro).toBe('4px');
      });

      it('defines semantic scales derived from primitive scale multipliers', () => {
        expect(semanticMotion.scale.active).toBe(primitiveMotion.scale.press);      // 0.98
        expect(semanticMotion.scale.highlight).toBe(primitiveMotion.scale.pulse);   // 1.05
        expect(semanticMotion.scale.feedback).toBe(primitiveMotion.scale.feedback); // 1.02
      });

      it('defines semantic easings mapped to primitive bezier curves', () => {
        expect(semanticMotion.easing.standard).toBe(primitiveMotion.easing.standard);
        expect(semanticMotion.easing.enter).toBe(primitiveMotion.easing.enter);
        expect(semanticMotion.easing.exit).toBe(primitiveMotion.easing.exit);
        expect(semanticMotion.easing.emphasized).toBe(primitiveMotion.easing.emphasized);
      });

      it('exports motionTokens alias and motion helper functions', () => {
        expect(motionTokens).toBe(semanticMotion);
        expect(motionDurationToSeconds('250ms')).toBe(0.25);
        expect(motionDurationToSeconds('0ms')).toBe(0);
        expect(motionDurationToSeconds('150ms')).toBe(0.15);
        expect(motionDurationToSeconds('1.5s')).toBe(1.5);
        expect(motionDurationToSeconds('0.25s')).toBe(0.25);
        expect(motionDurationToSeconds('  300ms  ')).toBe(0.3);
        expect(motionDurationToSeconds('  2s  ')).toBe(2);
        expect(motionDurationToSeconds('')).toBe(0);
        expect(motionDurationToSeconds('invalid')).toBe(0);
        expect(motionSeconds.normal).toBe(0.25);
        expect(motionSeconds.fast).toBe(0.15);
        expect(motionSeconds.feedback).toBe(0.2);
        expect(motionSeconds.instant).toBe(0);
      });
    });
  });

  // =========================================================================
  // 3. Component Motion Tokens
  // =========================================================================
  describe('Component Motion Tokens (DTCG Tier 3)', () => {
    it('defines component motion bindings for interactive components with CSS variables', () => {
      // Button
      expect(componentMotionTokens.button.duration).toBe('var(--motion-fast)');
      expect(componentMotionTokens.button.ease).toBe('var(--motion-ease-standard)');
      expect(componentMotionTokens.button.scaleActive).toBe('var(--motion-scale-active)');

      // Card
      expect(componentMotionTokens.card.duration).toBe('var(--motion-normal)');
      expect(componentMotionTokens.card.ease).toBe('var(--motion-ease-standard)');

      // ReviewCard (P0)
      expect(componentMotionTokens.reviewCard.flipDuration).toBe('var(--motion-normal)');
      expect(componentMotionTokens.reviewCard.flipEase).toBe('var(--motion-ease-standard)');
      expect(componentMotionTokens.reviewCard.ratingDuration).toBe('var(--motion-fast)');
      expect(componentMotionTokens.reviewCard.ratingScale).toBe('var(--motion-scale-active)');
      expect(componentMotionTokens.reviewCard.revealDistance).toBe('var(--motion-distance-reveal)');

      // ReviewSession (P0)
      expect(componentMotionTokens.reviewSession.slideDuration).toBe('var(--motion-fast)');
      expect(componentMotionTokens.reviewSession.slideEase).toBe('var(--motion-ease-standard)');
      expect(componentMotionTokens.reviewSession.slideDistance).toBe('var(--motion-distance-slide)');

      // ConceptNode (P0)
      expect(componentMotionTokens.conceptNode.pulseDuration).toBe('var(--motion-feedback)');
      expect(componentMotionTokens.conceptNode.pulseScale).toBe('var(--motion-scale-highlight)');
      expect(componentMotionTokens.conceptNode.pulseEase).toBe('var(--motion-ease-enter)');

      // LanguageBrainCanvas (P0)
      expect(componentMotionTokens.brainCanvas.panDuration).toBe('var(--motion-slow)');
      expect(componentMotionTokens.brainCanvas.panEase).toBe('var(--motion-ease-standard)');

      // ProgressAnalytics (P1)
      expect(componentMotionTokens.progressAnalytics.barDuration).toBe('var(--motion-normal)');
      expect(componentMotionTokens.progressAnalytics.barStagger).toBe('50ms');
      expect(componentMotionTokens.progressAnalytics.barEase).toBe('var(--motion-ease-enter)');

      // Modal & Toast & Tooltip
      expect(componentMotionTokens.modal.enterDuration).toBe('var(--motion-slow)');
      expect(componentMotionTokens.modal.exitDuration).toBe('var(--motion-feedback)');
      expect(componentMotionTokens.toast.duration).toBe('var(--motion-feedback)');
      expect(componentMotionTokens.toast.distance).toBe('var(--motion-distance-reveal)');
      expect(componentMotionTokens.tooltip.enterDuration).toBe('var(--motion-fast)');
    });

    it('integrates motion definitions directly into componentTokens bundle and alias', () => {
      expect(componentMotion).toBe(componentMotionTokens);
      expect(componentTokens.motion).toBeDefined();
      expect(componentTokens.motion).toEqual(componentMotionTokens);
      expect(componentTokens.button.motion).toEqual(componentMotionTokens.button);
      expect(componentTokens.card.motion).toEqual(componentMotionTokens.card);
      expect(componentTokens.reviewCard).toEqual(componentMotionTokens.reviewCard);
      expect(componentTokens.reviewSession).toEqual(componentMotionTokens.reviewSession);
      expect(componentTokens.conceptNode).toEqual(componentMotionTokens.conceptNode);
      expect(componentTokens.brainCanvas).toEqual(componentMotionTokens.brainCanvas);
      expect(componentTokens.progressAnalytics).toEqual(componentMotionTokens.progressAnalytics);
    });

    it('ensures all component motion properties reference valid CSS custom property strings', () => {
      const varRegex = /^var\(--motion-[a-z0-9-]+\)$|^50ms$/;
      
      const checkVars = (obj: Record<string, unknown>) => {
        Object.entries(obj).forEach(([key, val]) => {
          if (typeof val === 'string') {
            expect(val, `Key ${key} should reference CSS var or duration`).toMatch(varRegex);
          } else if (typeof val === 'object' && val !== null) {
            checkVars(val as Record<string, unknown>);
          }
        });
      };

      checkVars(componentMotionTokens as unknown as Record<string, unknown>);
    });
  });

  // =========================================================================
  // 4. Reduced-Motion CSS & Token Fallbacks
  // =========================================================================
  describe('Reduced-Motion Token Fallbacks & CSS Invariant', () => {
    it('verifies theme.css contains complete :root motion definitions and reduced-motion overrides', () => {
      const themeCssPath = path.resolve(__dirname, '../../packages/ui/src/tokens/theme.css');
      expect(fs.existsSync(themeCssPath)).toBe(true);

      const cssContent = fs.readFileSync(themeCssPath, 'utf-8');

      // Primitive durations in :root
      expect(cssContent).toContain('--motion-duration-0: 0ms;');
      expect(cssContent).toContain('--motion-duration-75: 75ms;');
      expect(cssContent).toContain('--motion-duration-150: 150ms;');
      expect(cssContent).toContain('--motion-duration-200: 200ms;');
      expect(cssContent).toContain('--motion-duration-300: 300ms;');
      expect(cssContent).toContain('--motion-duration-400: 400ms;');
      expect(cssContent).toContain('--motion-duration-600: 600ms;');

      // Primitive easings
      expect(cssContent).toContain('--motion-ease-standard:');
      expect(cssContent).toContain('--motion-ease-enter:');
      expect(cssContent).toContain('--motion-ease-exit:');

      // Semantic tokens
      expect(cssContent).toContain('--motion-instant:');
      expect(cssContent).toContain('--motion-fast:');
      expect(cssContent).toContain('--motion-normal: 250ms;');
      expect(cssContent).toContain('--motion-slow:');
      expect(cssContent).toContain('--motion-feedback:');
      expect(cssContent).toContain('--motion-distance-reveal:');
      expect(cssContent).toContain('--motion-scale-active:');
      expect(cssContent).toContain('--motion-scale-highlight:');

      // Reduced motion media query overrides
      expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
      expect(cssContent).toContain('--motion-fast: 0ms;');
      expect(cssContent).toContain('--motion-normal: 0ms;');
      expect(cssContent).toContain('--motion-slow: 0ms;');
      expect(cssContent).toContain('--motion-feedback: 0ms;');
      expect(cssContent).toContain('--motion-distance-reveal: 0px;');
      expect(cssContent).toContain('--motion-distance-slide: 0px;');
      expect(cssContent).toContain('--motion-scale-active: 1;');
      expect(cssContent).toContain('--motion-scale-highlight: 1;');
      expect(cssContent).toContain('animation-duration: 0.01ms !important;');
      expect(cssContent).toContain('transition-duration: 0.01ms !important;');
    });
  });

  // =========================================================================
  // 5. usePrefersReducedMotion Hook Tests
  // =========================================================================
  describe('usePrefersReducedMotion Hook', () => {
    it('returns false by default when reduced motion is not preferred', () => {
      const { result } = renderHook(() => usePrefersReducedMotion());
      expect(typeof result.current).toBe('boolean');
    });

    it('reactively updates when matchMedia preference changes', () => {
      let listener: ((e: { matches: boolean }) => void) | null = null;
      let currentMatches = false;

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (query: string) => ({
        matches: currentMatches,
        media: query,
        onchange: null,
        addListener: (cb: (e: { matches: boolean }) => void) => { listener = cb; },
        removeListener: () => { listener = null; },
        addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => { listener = cb; },
        removeEventListener: () => { listener = null; },
        dispatchEvent: () => true,
      } as unknown as MediaQueryList);

      const { result, unmount } = renderHook(() => usePrefersReducedMotion());
      expect(result.current).toBe(false);

      act(() => {
        currentMatches = true;
        if (listener) {
          listener({ matches: true });
        }
      });

      expect(result.current).toBe(true);

      unmount();
      window.matchMedia = originalMatchMedia;
    });
  });

  // =========================================================================
  // 6. TypeScript Type-Level Assertions
  // =========================================================================
  describe('TypeScript Compile-Time Type Safety (expectTypeOf)', () => {
    it('verifies exact types for PrimitiveMotion tokens', () => {
      expectTypeOf(primitiveMotion).toBeObject();
      expectTypeOf(primitiveMotion.duration[150]).toEqualTypeOf<'150ms'>();
      expectTypeOf(primitiveMotion.duration.fast).toEqualTypeOf<'150ms'>();
      expectTypeOf(primitiveMotion.duration.base).toEqualTypeOf<'250ms'>();
      expectTypeOf(primitiveMotion.scale.press).toEqualTypeOf<0.98>();
      expectTypeOf(primitiveMotion.scale.pulse).toEqualTypeOf<1.05>();
      expectTypeOf(primitiveMotion.distance.md).toEqualTypeOf<'8px'>();
      expectTypeOf(primitiveMotion.easing.standard).toEqualTypeOf<'cubic-bezier(0.2, 0.0, 0.0, 1.0)'>();
    });

    it('verifies exact types for SemanticMotion tokens', () => {
      expectTypeOf(semanticMotion).toBeObject();
      expectTypeOf(semanticMotion.duration.instant).toEqualTypeOf<'0ms'>();
      expectTypeOf(semanticMotion.duration.fast).toEqualTypeOf<'150ms'>();
      expectTypeOf(semanticMotion.duration.normal).toEqualTypeOf<'250ms'>();
      expectTypeOf(semanticMotion.scale.active).toEqualTypeOf<0.98>();
      expectTypeOf(semanticMotion.scale.highlight).toEqualTypeOf<1.05>();
      expectTypeOf(semanticMotion.distance.reveal).toEqualTypeOf<'8px'>();
      expectTypeOf(semanticMotion.distance.slide).toEqualTypeOf<'16px'>();
    });

    it('verifies key union types for duration, easing, distance, and scale', () => {
      expectTypeOf<SemanticMotionDurationKey>().toEqualTypeOf<'instant' | 'fast' | 'normal' | 'slow' | 'feedback'>();
      expectTypeOf<SemanticMotionDistanceKey>().toEqualTypeOf<'reveal' | 'slide' | 'micro'>();
      expectTypeOf<SemanticMotionScaleKey>().toEqualTypeOf<'active' | 'highlight' | 'feedback'>();
    });

    it('verifies ComponentMotion object structure and ComponentTokens integration', () => {
      expectTypeOf<ComponentMotionTokens>().toBeObject();
      expectTypeOf<ComponentMotion>().toBeObject();
      expectTypeOf<ComponentTokens>().toBeObject();
      expectTypeOf(componentTokens.motion).toEqualTypeOf<ComponentMotionTokens>();
    });
  });
});
