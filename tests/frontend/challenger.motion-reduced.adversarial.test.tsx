/**
 * LINGUA OS Empirical Adversarial Stress Test Suite
 * Challenger 2 - Milestone 1 Verification (Motion Tokens & Reduced Motion Infrastructure)
 *
 * Empirical Challenge Vectors:
 * 1. SSR & Headless Node Execution Invariants (renderToString, undefined window, missing matchMedia)
 * 2. Dynamic Media Query Listener Lifecycle (addEventListener, removeEventListener, unmount leak prevention)
 * 3. Legacy Browser Fallback Handling (addListener / removeListener, missing removal methods)
 * 4. Concurrency & Mass Subscriber Stress (100+ simultaneous hooks, rapid high-frequency toggling)
 * 5. CSS Reduced-Motion Invariants & Token Cascade Overrides
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderHook, render, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import { usePrefersReducedMotion } from '@lingua/ui/hooks/usePrefersReducedMotion';
import { primitiveMotion } from '@lingua/ui/tokens/primitive';
import { semanticMotion, motionTokens, motionDurationToSeconds, motionSeconds } from '@lingua/ui/tokens/semantic';
import { componentMotionTokens, componentTokens } from '@lingua/ui/tokens/component';

// Sample test consumer component
function MotionIndicator() {
  const prefersReduced = usePrefersReducedMotion();
  return <div data-testid="motion-status">{prefersReduced ? 'reduced' : 'full'}</div>;
}

describe('Adversarial Challenge 1: SSR & Headless Environment Invariants', () => {
  const originalWindow = globalThis.window;
  const originalMatchMedia = globalThis.window?.matchMedia;

  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow;
      if (originalMatchMedia) {
        globalThis.window.matchMedia = originalMatchMedia;
      }
    }
  });

  it('safely evaluates under React SSR (renderToString) without throwing ReferenceError', () => {
    // Execute SSR renderToString
    const html = renderToString(<MotionIndicator />);
    expect(html).toContain('full');
    expect(html).toContain('data-testid="motion-status"');
  });

  it('returns false and creates safe no-op subscriber when window is undefined', () => {
    // Temporarily mask global window to simulate pure Node/SSR environment
    const windowSpy = vi.spyOn(globalThis, 'window', 'get').mockReturnValue(undefined as unknown as Window & typeof globalThis);

    // Render hook or execute outside DOM
    // Note: renderHook requires JSDOM, but calling hook logic or simulating SSR subscriber
    expect(typeof window).toBe('undefined');

    // Direct SSR renderToString without window
    const html = renderToString(<MotionIndicator />);
    expect(html).toBe('<div data-testid="motion-status">full</div>');

    windowSpy.mockRestore();
  });

  it('handles environment where window exists but matchMedia is undefined', () => {
    // @ts-expect-error - simulating legacy/headless browser without matchMedia
    window.matchMedia = undefined;

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('handles environment where window.matchMedia is not a function (e.g. null, object)', () => {
    // @ts-expect-error - simulating corrupted matchMedia property
    window.matchMedia = null;

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    expect(() => unmount()).not.toThrow();

    // @ts-expect-error - simulating object-typed matchMedia
    window.matchMedia = {};
    const { result: result2, unmount: unmount2 } = renderHook(() => usePrefersReducedMotion());
    expect(result2.current).toBe(false);
    expect(() => unmount2()).not.toThrow();
  });
});

describe('Adversarial Challenge 2: Dynamic Media Query Listener Lifecycle & Leak Prevention', () => {
  let listeners: Set<() => void>;
  let matchesState: boolean;

  beforeEach(() => {
    listeners = new Set();
    matchesState = false;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchesState,
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'change') listeners.add(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'change') listeners.delete(cb);
      }),
      addListener: vi.fn((cb: () => void) => {
        listeners.add(cb);
      }),
      removeListener: vi.fn((cb: () => void) => {
        listeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    }));
  });

  it('subscribes with exact media query (prefers-reduced-motion: reduce)', () => {
    renderHook(() => usePrefersReducedMotion());
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('reacts dynamically to OS media query change events', () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    expect(listeners.size).toBe(1);

    // Simulate OS preference change to reduce motion
    act(() => {
      matchesState = true;
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);

    // Simulate OS preference change back to no preference
    act(() => {
      matchesState = false;
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(false);
  });

  it('strictly detaches listener on unmount to prevent memory leaks', () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(listeners.size).toBe(1);

    unmount();

    // Verify listener was removed from the set
    expect(listeners.size).toBe(0);

    // Emitting an event after unmount should have no effect and not throw
    expect(() => {
      matchesState = true;
      listeners.forEach((cb) => cb());
    }).not.toThrow();
  });
});

describe('Adversarial Challenge 3: Legacy Browser Fallback Handling (addListener / removeListener)', () => {
  let legacyListeners: Set<() => void>;
  let matchesState: boolean;

  beforeEach(() => {
    legacyListeners = new Set();
    matchesState = false;

    // Simulate Safari <= 13 / older WebKit where addEventListener is undefined on MediaQueryList
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchesState,
      media: query,
      onchange: null,
      addEventListener: undefined,
      removeEventListener: undefined,
      addListener: vi.fn((cb: () => void) => {
        legacyListeners.add(cb);
      }),
      removeListener: vi.fn((cb: () => void) => {
        legacyListeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    }));
  });

  it('falls back to addListener when addEventListener is undefined', () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    expect(legacyListeners.size).toBe(1);

    // Simulate change
    act(() => {
      matchesState = true;
      legacyListeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);
  });

  it('cleans up via removeListener on unmount in legacy environments', () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(legacyListeners.size).toBe(1);

    unmount();
    expect(legacyListeners.size).toBe(0);
  });

  it('safely handles legacy environment where removeListener is missing on unmount', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchesState,
      media: query,
      onchange: null,
      addEventListener: undefined,
      removeEventListener: undefined,
      addListener: vi.fn((cb: () => void) => {
        legacyListeners.add(cb);
      }),
      removeListener: undefined, // Missing removeListener
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(legacyListeners.size).toBe(1);

    // Unmount should not throw even if removeListener is missing
    expect(() => unmount()).not.toThrow();
  });

  it('safely handles environment where neither addEventListener nor addListener exists', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: undefined,
      removeEventListener: undefined,
      addListener: undefined,
      removeListener: undefined,
      dispatchEvent: vi.fn(),
    }));

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
    expect(() => unmount()).not.toThrow();
  });
});

describe('Adversarial Challenge 4: Concurrency & Mass Subscriber Stress Test', () => {
  let listeners: Set<() => void>;
  let matchesState: boolean;

  beforeEach(() => {
    listeners = new Set();
    matchesState = false;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchesState,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, cb: () => void) => {
        listeners.add(cb);
      }),
      removeEventListener: vi.fn((_event: string, cb: () => void) => {
        listeners.delete(cb);
      }),
      addListener: vi.fn((cb: () => void) => {
        listeners.add(cb);
      }),
      removeListener: vi.fn((cb: () => void) => {
        listeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    }));
  });

  it('supports 100 simultaneous component subscribers and synchronizes all on state flip', () => {
    const SubscriberList = ({ count }: { count: number }) => (
      <div>
        {Array.from({ length: count }).map((_, idx) => (
          <MotionIndicator key={idx} />
        ))}
      </div>
    );

    const { getAllByTestId, unmount } = render(<SubscriberList count={100} />);
    const indicators = getAllByTestId('motion-status');
    expect(indicators.length).toBe(100);
    expect(indicators.every((el) => el.textContent === 'full')).toBe(true);

    // Flip to reduced motion
    act(() => {
      matchesState = true;
      listeners.forEach((cb) => cb());
    });

    const updatedIndicators = getAllByTestId('motion-status');
    expect(updatedIndicators.every((el) => el.textContent === 'reduced')).toBe(true);

    // Unmount all
    unmount();
    expect(listeners.size).toBe(0);
  });

  it('handles rapid high-frequency oscillation (50 cycles) without desynchronization', () => {
    const { result } = renderHook(() => usePrefersReducedMotion());

    for (let i = 0; i < 50; i++) {
      const nextMatch = i % 2 === 1;
      act(() => {
        matchesState = nextMatch;
        listeners.forEach((cb) => cb());
      });
      expect(result.current).toBe(nextMatch);
    }
  });
});

describe('Adversarial Challenge 5: CSS Motion Token Invariants & prefers-reduced-motion Overrides', () => {
  const themeCssPath = path.resolve(__dirname, '../../packages/ui/src/tokens/theme.css');
  let cssContent: string;

  beforeEach(() => {
    expect(fs.existsSync(themeCssPath)).toBe(true);
    cssContent = fs.readFileSync(themeCssPath, 'utf-8');
  });

  it('enforces Invariant 1 (timing limits): all semantic feedback durations are <= 300ms', () => {
    const fastMs = parseInt(semanticMotion.duration.fast, 10);
    const feedbackMs = parseInt(semanticMotion.duration.feedback, 10);
    const normalMs = parseInt(semanticMotion.duration.normal, 10);
    const slowMs = parseInt(semanticMotion.duration.slow, 10);

    expect(fastMs).toBeLessThanOrEqual(150);
    expect(feedbackMs).toBeLessThanOrEqual(200);
    expect(normalMs).toBeLessThanOrEqual(300);
    expect(slowMs).toBeLessThanOrEqual(500); // Spatial max
  });

  it('verifies that @media (prefers-reduced-motion: reduce) completely collapses all durations to 0ms', () => {
    const reducedMotionSection = cssContent.slice(cssContent.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedMotionSection).toBeTruthy();

    const expectedZeroDurations = [
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

    for (const rule of expectedZeroDurations) {
      expect(reducedMotionSection, `Missing rule in reduced-motion CSS: ${rule}`).toContain(rule);
    }
  });

  it('verifies that @media (prefers-reduced-motion: reduce) collapses all spatial distances to 0px', () => {
    const reducedMotionSection = cssContent.slice(cssContent.indexOf('@media (prefers-reduced-motion: reduce)'));

    const expectedZeroDistances = [
      '--motion-distance-xs: 0px;',
      '--motion-distance-sm: 0px;',
      '--motion-distance-md: 0px;',
      '--motion-distance-lg: 0px;',
      '--motion-distance-reveal: 0px;',
      '--motion-distance-slide: 0px;',
    ];

    for (const rule of expectedZeroDistances) {
      expect(reducedMotionSection, `Missing distance rule in reduced-motion CSS: ${rule}`).toContain(rule);
    }
  });

  it('verifies that @media (prefers-reduced-motion: reduce) collapses all GPU scale multipliers to 1 (neutral)', () => {
    const reducedMotionSection = cssContent.slice(cssContent.indexOf('@media (prefers-reduced-motion: reduce)'));

    const expectedNeutralScales = [
      '--motion-scale-press: 1;',
      '--motion-scale-feedback: 1;',
      '--motion-scale-pulse: 1;',
      '--motion-scale-active: 1;',
      '--motion-scale-highlight: 1;',
    ];

    for (const rule of expectedNeutralScales) {
      expect(reducedMotionSection, `Missing scale rule in reduced-motion CSS: ${rule}`).toContain(rule);
    }
  });

  it('verifies universal CSS animation & transition override with !important flags', () => {
    const reducedMotionSection = cssContent.slice(cssContent.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reducedMotionSection).toContain('*, ::before, ::after {');
    expect(reducedMotionSection).toContain('animation-duration: 0.01ms !important;');
    expect(reducedMotionSection).toContain('animation-iteration-count: 1 !important;');
    expect(reducedMotionSection).toContain('transition-duration: 0.01ms !important;');
    expect(reducedMotionSection).toContain('scroll-behavior: auto !important;');
  });

  it('verifies motionSeconds and motionDurationToSeconds utility edge cases', () => {
    // Millisecond duration token inputs for motionDurationToSeconds
    expect(motionDurationToSeconds('')).toBe(0);
    expect(motionDurationToSeconds('0ms')).toBe(0);
    expect(motionDurationToSeconds('150ms')).toBe(0.15);
    expect(motionDurationToSeconds('250ms')).toBe(0.25);
    expect(motionDurationToSeconds('400ms')).toBe(0.4);
    expect(motionDurationToSeconds('600ms')).toBe(0.6);
    expect(motionDurationToSeconds('not-a-number')).toBe(0);
    expect(motionDurationToSeconds('   300ms   ')).toBe(0.3);

    // Verify motionSeconds mapping
    expect(motionSeconds.instant).toBe(0);
    expect(motionSeconds.fast).toBe(0.15);
    expect(motionSeconds.normal).toBe(0.25);
    expect(motionSeconds.slow).toBe(0.4);
    expect(motionSeconds.feedback).toBe(0.2);
    expect(motionSeconds.maxSpatial).toBe(0.5);
    expect(motionSeconds.staggerStep).toBe(0.05);
  });
});
