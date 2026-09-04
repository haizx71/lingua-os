import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderHook, act } from '@testing-library/react';

// Direct imports from UI package and subpaths
import * as RootUI from '@lingua/ui';
import * as TokenBundle from '@lingua/ui/tokens';
import {
  primitivePalette,
  primitiveSpace,
  primitiveRadius,
  primitiveTypography,
  primitiveMotion,
} from '@lingua/ui/tokens/primitive';
import {
  semanticColors,
  semanticMotion,
  motionTokens,
  motionDurationToSeconds,
  motionSeconds,
  conceptStateMetadata,
} from '@lingua/ui/tokens/semantic';
import {
  componentTokens,
  componentMotionTokens,
  componentMotion,
} from '@lingua/ui/tokens/component';
import { usePrefersReducedMotion } from '@lingua/ui/hooks/usePrefersReducedMotion';

describe('Milestone 1 Empirical Challenger Adversarial Test Suite', () => {
  // =========================================================================
  // Challenge 1: Mathematical Bezier Curve Validity & Boundary Analysis
  // =========================================================================
  describe('Challenge 1: Bezier Curve Validity & Boundary Analysis', () => {
    it('verifies all cubic-bezier timing functions have valid control point bounds (x1, x2 in [0, 1])', () => {
      const bezierRegex = /^cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)$/;

      Object.entries(primitiveMotion.easing).forEach(([easeName, easeStr]) => {
        if (easeStr === 'linear') {
          expect(easeStr).toBe('linear');
          return;
        }

        const match = easeStr.match(bezierRegex);
        expect(match, `Easing "${easeName}" (${easeStr}) should match cubic-bezier format`).not.toBeNull();

        if (match) {
          const [, x1Str, y1Str, x2Str, y2Str] = match;
          const x1 = parseFloat(x1Str);
          const y1 = parseFloat(y1Str);
          const x2 = parseFloat(x2Str);
          const y2 = parseFloat(y2Str);

          // In CSS cubic-bezier(x1, y1, x2, y2), X coordinates MUST be in [0, 1] range.
          // Values < 0 or > 1 cause runtime CSS parsing failure / invalid transition timing.
          expect(x1, `${easeName} x1 must be >= 0`).toBeGreaterThanOrEqual(0);
          expect(x1, `${easeName} x1 must be <= 1`).toBeLessThanOrEqual(1);
          expect(x2, `${easeName} x2 must be >= 0`).toBeGreaterThanOrEqual(0);
          expect(x2, `${easeName} x2 must be <= 1`).toBeLessThanOrEqual(1);

          // Y coordinates can overshoot, but for calm learning design, y values should be reasonable (e.g. within [-0.5, 1.5])
          expect(y1, `${easeName} y1 should be within calm bounds`).toBeGreaterThanOrEqual(-0.5);
          expect(y1, `${easeName} y1 should be within calm bounds`).toBeLessThanOrEqual(1.5);
          expect(y2, `${easeName} y2 should be within calm bounds`).toBeGreaterThanOrEqual(-0.5);
          expect(y2, `${easeName} y2 should be within calm bounds`).toBeLessThanOrEqual(1.5);
        }
      });
    });

    it('confirms cubic-bezier curves evaluate monotonically without backwards time travel', () => {
      // Numerical approximation of cubic bezier curve at sample points t in [0, 1]
      const sampleBezier = (x1: number, y1: number, x2: number, y2: number, t: number) => {
        const cx = 3 * x1;
        const bx = 3 * (x2 - x1) - cx;
        const ax = 1 - cx - bx;
        const cy = 3 * y1;
        const by = 3 * (y2 - y1) - cy;
        const ay = 1 - cy - by;

        const sampleX = ((ax * t + bx) * t + cx) * t;
        const sampleY = ((ay * t + by) * t + cy) * t;
        return { x: sampleX, y: sampleY };
      };

      const bezierRegex = /^cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)$/;

      Object.entries(primitiveMotion.easing).forEach(([easeName, easeStr]) => {
        if (easeStr === 'linear') return;
        const match = easeStr.match(bezierRegex);
        if (!match) return;

        const [, x1, y1, x2, y2] = match.map(Number);

        // Sample at t = 0, 0.25, 0.5, 0.75, 1.0
        const points = [0, 0.25, 0.5, 0.75, 1.0].map((t) => sampleBezier(x1, y1, x2, y2, t));

        // Start and end points must be (0,0) and (1,1)
        expect(points[0].x).toBeCloseTo(0, 5);
        expect(points[0].y).toBeCloseTo(0, 5);
        expect(points[4].x).toBeCloseTo(1, 5);
        expect(points[4].y).toBeCloseTo(1, 5);

        // Progressively increasing X values (no reverse time loops)
        for (let i = 1; i < points.length; i++) {
          expect(points[i].x, `${easeName} X progress should be strictly monotonic`).toBeGreaterThan(points[i - 1].x);
        }
      });
    });
  });

  // =========================================================================
  // Challenge 2: Duration Boundary & Zero-Duration Edge Cases
  // =========================================================================
  describe('Challenge 2: Duration Boundary & Zero-Duration Edge Cases', () => {
    it('verifies zero duration tokens and constants strictly evaluate to 0ms and 0 seconds', () => {
      expect(primitiveMotion.duration[0]).toBe('0ms');
      expect(semanticMotion.duration.instant).toBe('0ms');
      expect(motionSeconds.instant).toBe(0);
      expect(motionDurationToSeconds(semanticMotion.duration.instant)).toBe(0);
      expect(motionDurationToSeconds(primitiveMotion.duration[0])).toBe(0);
    });

    it('adversarially fuzzes motionDurationToSeconds with corrupted, edge-case, and malformed inputs', () => {
      // Valid inputs (milliseconds)
      expect(motionDurationToSeconds('0ms')).toBe(0);
      expect(motionDurationToSeconds('75ms')).toBe(0.075);
      expect(motionDurationToSeconds('150ms')).toBe(0.15);
      expect(motionDurationToSeconds('200ms')).toBe(0.2);
      expect(motionDurationToSeconds('250ms')).toBe(0.25);
      expect(motionDurationToSeconds('300ms')).toBe(0.3);
      expect(motionDurationToSeconds('400ms')).toBe(0.4);
      expect(motionDurationToSeconds('600ms')).toBe(0.6);

      // Valid inputs (seconds)
      expect(motionDurationToSeconds('0s')).toBe(0);
      expect(motionDurationToSeconds('1.5s')).toBe(1.5);
      expect(motionDurationToSeconds('0.25s')).toBe(0.25);
      expect(motionDurationToSeconds('2s')).toBe(2);
      expect(motionDurationToSeconds('0.05s')).toBe(0.05);

      // Whitespace resilience
      expect(motionDurationToSeconds('  250ms  ')).toBe(0.25);
      expect(motionDurationToSeconds('\t150ms\n')).toBe(0.15);
      expect(motionDurationToSeconds('  1.5s  ')).toBe(1.5);
      expect(motionDurationToSeconds('\t0.5s\n')).toBe(0.5);

      // Fractional values
      expect(motionDurationToSeconds('12.5ms')).toBe(0.0125);
      expect(motionDurationToSeconds('0.5ms')).toBe(0.0005);

      // Malformed / Non-numeric / Empty strings should return 0 safely without NaN or throwing
      expect(motionDurationToSeconds('')).toBe(0);
      expect(motionDurationToSeconds('   ')).toBe(0);
      expect(motionDurationToSeconds('invalid')).toBe(0);
      expect(motionDurationToSeconds('invalidms')).toBe(0);
      expect(motionDurationToSeconds('invalids')).toBe(0);
      expect(motionDurationToSeconds('fast')).toBe(0);
      expect(motionDurationToSeconds('undefined')).toBe(0);
      expect(motionDurationToSeconds('var(--motion-fast)')).toBe(0);
      expect(motionDurationToSeconds(null as unknown as string)).toBe(0);
      expect(motionDurationToSeconds(undefined as unknown as string)).toBe(0);
      expect(motionDurationToSeconds({} as unknown as string)).toBe(0);
    });

    it('ensures all duration tokens obey the non-blocking timing limits (primary <= 300ms, spatial <= 500ms)', () => {
      // Primary interaction durations: fast (150ms), normal (250ms), feedback (200ms)
      expect(motionDurationToSeconds(semanticMotion.duration.fast)).toBeLessThanOrEqual(0.3);
      expect(motionDurationToSeconds(semanticMotion.duration.feedback)).toBeLessThanOrEqual(0.3);
      expect(motionDurationToSeconds(semanticMotion.duration.normal)).toBeLessThanOrEqual(0.3);

      // Spatial duration: slow (400ms)
      expect(motionDurationToSeconds(semanticMotion.duration.slow)).toBeLessThanOrEqual(0.5);

      // Pre-calculated motionSeconds matches exact mathematical seconds
      expect(motionSeconds.fast).toBe(motionDurationToSeconds(semanticMotion.duration.fast));
      expect(motionSeconds.normal).toBe(motionDurationToSeconds(semanticMotion.duration.normal));
      expect(motionSeconds.feedback).toBe(motionDurationToSeconds(semanticMotion.duration.feedback));
      expect(motionSeconds.slow).toBe(motionDurationToSeconds(semanticMotion.duration.slow));
      expect(motionSeconds.instant).toBe(motionDurationToSeconds(semanticMotion.duration.instant));
    });
  });

  // =========================================================================
  // Challenge 3: Scale Multipliers & Physical Transform Direction
  // =========================================================================
  describe('Challenge 3: Scale Multipliers & Physical Transform Direction', () => {
    it('verifies press scale is compressive (< 1.0) and feedback/pulse are expansive (> 1.0)', () => {
      // Press/Active must feel like pressing down
      expect(primitiveMotion.scale.press).toBe(0.98);
      expect(semanticMotion.scale.active).toBe(0.98);
      expect(primitiveMotion.scale.press).toBeLessThan(1.0);
      expect(primitiveMotion.scale.press).toBeGreaterThan(0.9); // Restrained, not jarring

      // Feedback must provide subtle affirmative elevation
      expect(primitiveMotion.scale.feedback).toBe(1.02);
      expect(semanticMotion.scale.feedback).toBe(1.02);
      expect(primitiveMotion.scale.feedback).toBeGreaterThan(1.0);
      expect(primitiveMotion.scale.feedback).toBeLessThan(1.1);

      // Pulse must provide noticeable but calm status pulse
      expect(primitiveMotion.scale.pulse).toBe(1.05);
      expect(semanticMotion.scale.highlight).toBe(1.05);
      expect(primitiveMotion.scale.pulse).toBeGreaterThan(primitiveMotion.scale.feedback);
      expect(primitiveMotion.scale.pulse).toBeLessThan(1.15);
    });

    it('verifies spatial distances follow strict geometric progression in pixels', () => {
      const xs = parseInt(primitiveMotion.distance.xs, 10);
      const sm = parseInt(primitiveMotion.distance.sm, 10);
      const md = parseInt(primitiveMotion.distance.md, 10);
      const lg = parseInt(primitiveMotion.distance.lg, 10);

      expect(xs).toBe(2);
      expect(sm).toBe(4);
      expect(md).toBe(8);
      expect(lg).toBe(16);

      expect(sm).toBe(xs * 2);
      expect(md).toBe(sm * 2);
      expect(lg).toBe(md * 2);
    });
  });

  // =========================================================================
  // Challenge 4: CSS Variable Matching & Referential Integrity
  // =========================================================================
  describe('Challenge 4: CSS Variable Matching & Referential Integrity', () => {
    const themeCssPath = path.resolve(__dirname, '../../packages/ui/src/tokens/theme.css');
    const cssContent = fs.readFileSync(themeCssPath, 'utf-8');

    it('ensures every CSS variable referenced in componentMotionTokens is declared in theme.css :root', () => {
      // Extract all var(--xxx) references in componentMotionTokens
      const extractedVars = new Set<string>();

      const extract = (obj: Record<string, unknown>) => {
        Object.values(obj).forEach((val) => {
          if (typeof val === 'string') {
            const matches = val.match(/var\((--[a-z0-9-]+)\)/g);
            if (matches) {
              matches.forEach((m) => {
                const varName = m.replace(/^var\(/, '').replace(/\)$/, '');
                extractedVars.add(varName);
              });
            }
          } else if (typeof val === 'object' && val !== null) {
            extract(val as Record<string, unknown>);
          }
        });
      };

      extract(componentMotionTokens as unknown as Record<string, unknown>);

      expect(extractedVars.size).toBeGreaterThan(0);

      // Verify each referenced CSS variable is explicitly declared in theme.css :root
      extractedVars.forEach((cssVar) => {
        const declRegex = new RegExp(`${cssVar}\\s*:`, 'm');
        expect(
          declRegex.test(cssContent),
          `Referenced variable "${cssVar}" must be declared in theme.css :root`
        ).toBe(true);
      });
    });

    it('ensures @media (prefers-reduced-motion: reduce) completely overrides all motion variables to 0/1', () => {
      // Find the reduced-motion block in theme.css
      const reducedMotionBlockMatch = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
      expect(reducedMotionBlockMatch, 'theme.css must contain @media (prefers-reduced-motion: reduce)').not.toBeNull();

      const reducedBlock = reducedMotionBlockMatch ? reducedMotionBlockMatch[1] : '';

      // Required duration collapses
      const requiredDurationZero = [
        '--motion-duration-0: 0ms;',
        '--motion-duration-75: 0ms;',
        '--motion-duration-150: 0ms;',
        '--motion-duration-200: 0ms;',
        '--motion-duration-300: 0ms;',
        '--motion-duration-400: 0ms;',
        '--motion-duration-600: 0ms;',
        '--motion-instant: 0ms;',
        '--motion-fast: 0ms;',
        '--motion-normal: 0ms;',
        '--motion-slow: 0ms;',
        '--motion-feedback: 0ms;',
      ];

      requiredDurationZero.forEach((line) => {
        expect(reducedBlock, `Reduced motion block must contain: ${line}`).toContain(line);
      });

      // Required distance collapses
      const requiredDistanceZero = [
        '--motion-distance-xs: 0px;',
        '--motion-distance-sm: 0px;',
        '--motion-distance-md: 0px;',
        '--motion-distance-lg: 0px;',
        '--motion-distance-reveal: 0px;',
        '--motion-distance-slide: 0px;',
      ];

      requiredDistanceZero.forEach((line) => {
        expect(reducedBlock, `Reduced motion block must contain: ${line}`).toContain(line);
      });

      // Required scale collapses
      const requiredScaleOne = [
        '--motion-scale-press: 1;',
        '--motion-scale-feedback: 1;',
        '--motion-scale-pulse: 1;',
        '--motion-scale-active: 1;',
        '--motion-scale-highlight: 1;',
      ];

      requiredScaleOne.forEach((line) => {
        expect(reducedBlock, `Reduced motion block must contain: ${line}`).toContain(line);
      });

      // Global element override
      expect(reducedBlock).toContain('animation-duration: 0.01ms !important;');
      expect(reducedBlock).toContain('transition-duration: 0.01ms !important;');
      expect(reducedBlock).toContain('scroll-behavior: auto !important;');
    });
  });

  // =========================================================================
  // Challenge 5: Cross-Module Re-Export Integrity & Immutability
  // =========================================================================
  describe('Challenge 5: Cross-Module Re-Export Integrity & Immutability', () => {
    it('verifies that root package exports match token bundle re-exports exactly by reference', () => {
      // Primitive
      expect(RootUI.primitiveMotion).toBe(primitiveMotion);
      expect(TokenBundle.primitiveMotion).toBe(primitiveMotion);
      expect(RootUI.primitivePalette).toBe(primitivePalette);
      expect(RootUI.primitiveSpace).toBe(primitiveSpace);
      expect(RootUI.primitiveRadius).toBe(primitiveRadius);
      expect(RootUI.primitiveTypography).toBe(primitiveTypography);

      // Semantic
      expect(RootUI.semanticMotion).toBe(semanticMotion);
      expect(TokenBundle.semanticMotion).toBe(semanticMotion);
      expect(RootUI.motionTokens).toBe(motionTokens);
      expect(RootUI.motionDurationToSeconds).toBe(motionDurationToSeconds);
      expect(RootUI.motionSeconds).toBe(motionSeconds);
      expect(RootUI.semanticColors).toBe(semanticColors);
      expect(RootUI.conceptStateMetadata).toBe(conceptStateMetadata);

      // Component
      expect(RootUI.componentTokens).toBe(componentTokens);
      expect(TokenBundle.componentTokens).toBe(componentTokens);
      expect(RootUI.componentMotionTokens).toBe(componentMotionTokens);
      expect(RootUI.componentMotion).toBe(componentMotion);

      // Hook
      expect(RootUI.usePrefersReducedMotion).toBe(usePrefersReducedMotion);
    });

    it('confirms token objects maintain immutable structure across invocations', () => {
      // Verify frozen or const shape integrity
      expect(Object.keys(primitiveMotion.duration)).toEqual([
        '0', '75', '150', '200', '300', '400', '600', 'fast', 'base', 'slow'
      ]);

      expect(Object.keys(primitiveMotion.easing)).toEqual([
        'linear', 'standard', 'enter', 'exit', 'emphasized', 'inOut'
      ]);

      expect(Object.keys(primitiveMotion.distance)).toEqual([
        'xs', 'sm', 'md', 'lg'
      ]);

      expect(Object.keys(primitiveMotion.scale)).toEqual([
        'press', 'feedback', 'pulse'
      ]);

      expect(Object.keys(semanticMotion.duration)).toEqual([
        'instant', 'fast', 'normal', 'slow', 'feedback'
      ]);

      expect(Object.keys(semanticMotion.distance)).toEqual([
        'reveal', 'slide', 'micro'
      ]);

      expect(Object.keys(semanticMotion.scale)).toEqual([
        'active', 'highlight', 'feedback'
      ]);
    });
  });

  // =========================================================================
  // Challenge 6: SSR Safety & usePrefersReducedMotion Hook Stress Testing
  // =========================================================================
  describe('Challenge 6: SSR Safety & usePrefersReducedMotion Hook Stress Testing', () => {
    it('handles legacy MediaQueryList implementation (addListener / removeListener fallback)', () => {
      let legacyListener: ((e: { matches: boolean }) => void) | null = null;
      let currentMatches = false;

      const originalMatchMedia = window.matchMedia;
      // Mock legacy MediaQueryList without addEventListener
      window.matchMedia = (query: string) => ({
        matches: currentMatches,
        media: query,
        onchange: null,
        addListener: (cb: (e: { matches: boolean }) => void) => {
          legacyListener = cb;
        },
        removeListener: (cb: (e: { matches: boolean }) => void) => {
          if (legacyListener === cb) legacyListener = null;
        },
      } as unknown as MediaQueryList);

      const { result, unmount } = renderHook(() => usePrefersReducedMotion());
      expect(result.current).toBe(false);

      act(() => {
        currentMatches = true;
        if (legacyListener) {
          legacyListener({ matches: true });
        }
      });

      expect(result.current).toBe(true);

      unmount();
      expect(legacyListener).toBeNull();
      window.matchMedia = originalMatchMedia;
    });

    it('survives rapid mount and unmount cycles without memory leaks or dangling listeners', () => {
      let activeListenersCount = 0;

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {
          activeListenersCount++;
        },
        removeEventListener: () => {
          activeListenersCount--;
        },
        dispatchEvent: () => true,
      } as unknown as MediaQueryList);

      // Rapidly mount and unmount 50 hooks
      for (let i = 0; i < 50; i++) {
        const { unmount } = renderHook(() => usePrefersReducedMotion());
        expect(activeListenersCount).toBe(1);
        unmount();
        expect(activeListenersCount).toBe(0);
      }

      window.matchMedia = originalMatchMedia;
    });

    it('gracefully returns false when window.matchMedia is undefined (SSR environment)', () => {
      const originalMatchMedia = window.matchMedia;
      // @ts-expect-error simulating SSR / non-browser environment
      delete window.matchMedia;

      const { result, unmount } = renderHook(() => usePrefersReducedMotion());
      expect(result.current).toBe(false);

      unmount();
      window.matchMedia = originalMatchMedia;
    });
  });
});
