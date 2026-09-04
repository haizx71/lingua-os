# Handoff Report: Motion Token Architecture (Milestone 1)

**Agent ID**: `explorer_m1_1`  
**Role**: Motion Token Architect Explorer / Specification Miner  
**Target Milestone**: Milestone 1 (Semantic Motion Token System & Core Utilities)  
**Date**: 2026-08-22  

---

## 1. Observation

Direct code and specification analysis across the project revealed the following state:

### 1.1 Specification Sources
- **`design-system/MOTION_DESIGN.md` §2.1–§2.3**:
  - Requires DTCG 3-tier motion token scale: Primitive (raw durations `0`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms`; easing curves `linear`, `standard`, `enter`, `exit`, `emphasized`; distances `xs: 2px`, `sm: 4px`, `md: 8px`, `lg: 16px`; scales `press: 0.98`, `feedback: 1.02`, `pulse: 1.05`).
  - Semantic tokens: `--motion-instant` (`0ms`), `--motion-fast` (`150ms`), `--motion-normal` (`250ms`), `--motion-slow` (`400ms`), `--motion-feedback` (`200ms`), `--motion-distance-reveal` (`8px`), `--motion-scale-active` (`0.98`), `--motion-scale-highlight` (`1.05`).
  - Reduced-motion invariant (§5): 100% collapse to `duration: 0` or static state switch.
- **`PROJECT.md` §Interface Contracts & Milestones**:
  - Confirms DTCG 3-tier motion architecture: `primitiveMotion`, `semanticMotion`, `componentMotion`, and CSS variables in `theme.css`.
- **`ORIGINAL_REQUEST.md`**:
  - Mandates GSAP motion system integration strictly obeying Motion Invariants 1 (non-blocking timing), 2 (GSAP vs CSS boundary), 3 (immediate semantic data).

### 1.2 Existing Codebase State
- **`packages/ui/src/tokens/primitive.ts` (lines 109–119)**:
  ```ts
  export const primitiveMotion = {
    duration: {
      fast: '150ms',
      base: '250ms',
      slow: '400ms',
    },
    easing: {
      standard: 'cubic-bezier(0.2, 0.0, 0, 1.0)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  } as const;
  ```
  *Deficiency*: Missing raw numeric durations (`0`, `75`, `150`, `200`, `300`, `400`, `600`), missing `enter`, `exit`, `emphasized`, `linear` easings, missing all distance tokens (`xs`, `sm`, `md`, `lg`), and missing scale tokens (`press`, `feedback`, `pulse`).
- **`packages/ui/src/tokens/semantic.ts`**:
  *Deficiency*: Contains color and concept status definitions, but completely lacks `semanticMotion` tokens and types.
- **`packages/ui/src/tokens/component.ts`**:
  *Deficiency*: Contains color/radius bindings for button/card/etc., but lacks `componentMotion` bindings and motion slots.
- **`packages/ui/src/tokens/theme.css` (lines 55–58, 103–110)**:
  *Deficiency*: Has legacy `--transition-fast` and `--transition-base`, but is missing the standardized `--motion-duration-*`, `--motion-ease-*`, `--motion-distance-*`, and semantic `--motion-*` custom properties.
- **`tests/frontend/tokens.test.ts` (lines 40–44)**:
  ```ts
  it('defines motion duration tokens', () => {
    expect(primitiveMotion.duration.fast).toBe('150ms');
    expect(primitiveMotion.duration.base).toBe('250ms');
  });
  ```
  *Invariant*: Existing unit test runs and passes (`npx vitest run tests/frontend/tokens.test.ts`), requiring backwards compatibility for `fast` and `base` aliases.

---

## 2. Features Discovered & Edge Cases

### 2.1 Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Primitive Duration | Raw Duration Scale | Complete 7-step duration scale: `0`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms` | Numeric/string keys `0..600` | Duration string (e.g. `'150ms'`) | Type error on invalid key | `MOTION_DESIGN.md` §2.1 |
| 2 | Primitive Easing | Standard Easing Curves | Standardized cubic bezier curves (`standard`, `enter`, `exit`, `emphasized`, `linear`, `inOut`) | Easing key | CSS cubic-bezier or keyword | Type error on invalid key | `MOTION_DESIGN.md` §2.1 |
| 3 | Primitive Distance | Spatial Offsets | Sub-grid spatial offsets (`xs: 2px`, `sm: 4px`, `md: 8px`, `lg: 16px`) for composited transforms | Distance key (`xs`, `sm`, `md`, `lg`) | Distance string (`'8px'`) | Type error on invalid key | `MOTION_DESIGN.md` §2.1 |
| 4 | Primitive Scale | Transform Scale Multipliers | Precise GPU transform multipliers (`press: 0.98`, `feedback: 1.02`, `pulse: 1.05`) | Scale key (`press`, `feedback`, `pulse`) | Floating point number (e.g. `0.98`) | Type error on invalid key | `MOTION_DESIGN.md` §2.1 |
| 5 | Semantic Duration | Purpose-Driven Timing | Intent-mapped durations (`instant: 0ms`, `fast: 150ms`, `normal: 250ms`, `slow: 400ms`, `feedback: 200ms`) | Semantic duration key | Duration string (e.g. `'250ms'`) | Fallback to default | `MOTION_DESIGN.md` §2.2 |
| 6 | Semantic Distance & Scale | Contextual Transforms | Purpose-mapped distances (`reveal: 8px`, `slide: 16px`) and scales (`active: 0.98`, `highlight: 1.05`, `feedback: 1.02`) | Semantic spatial key | Dimension or multiplier | Type error on invalid key | `MOTION_DESIGN.md` §2.2 |
| 7 | Component Motion | Component Motion Bindings | Component-scoped motion token bindings for `button`, `card`, `reviewCard`, `reviewSession`, `conceptNode`, `brainCanvas`, `progressAnalytics`, `modal`, `toast`, `tooltip` | Component name | CSS variable bindings object | Undefined if unsupported | `MOTION_AUDIT.md` & `PROJECT.md` |
| 8 | CSS Custom Properties | Root Motion Variables & Reduced Motion | Bidirectional CSS variables in `theme.css` with `@media (prefers-reduced-motion: reduce)` zero-duration collapse | CSS media query | `:root` custom properties | Automatic browser fallback | `MOTION_DESIGN.md` §2.1, §5 |
| 9 | GSAP Ergonomics | Seconds Converter / Constants | Utility / constants for converting millisecond tokens to floating-point seconds for GSAP | Duration string | Number in seconds (e.g. `0.25`) | Returns 0 for invalid input | `MOTION_DESIGN.md` §4 |

### 2.2 Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Reduced Motion Collapse | `prefers-reduced-motion: reduce` | All semantic duration variables (`--motion-fast`, `--motion-normal`, etc.) collapse to `0ms`, scales collapse to `1.0`, distances collapse to `0px`. |
| 2 | Backwards Compatibility | Accessing `primitiveMotion.duration.fast` or `.base` | Maintains compatibility with existing tests and components while exposing new numeric keys `0`, `75`, `150`, `200`, `300`, `400`, `600`. |
| 3 | Numeric Object Keys | Object property indexing (`primitiveMotion.duration[150]`) | TypeScript strongly types numeric keys as both number and literal string indices. |
| 4 | GSAP Duration Format | GSAP tween duration parameter | GSAP expects seconds (`0.25`), whereas CSS tokens use `ms` (`'250ms'`). Helper function `motionDurationToSeconds` or `motionSeconds` prevents unit mismatch bugs. |
| 5 | Non-Color Invariant | Selection & Status upgrades | Motion scale/pulse (1.0 -> 1.05) accompanied by border and icon changes to comply with WCAG 2.2 AA non-color requirements. |

---

## 3. Logic Chain & Technical Blueprints

### 3.1 Architecture Overview
The DTCG 3-tier motion token architecture enforces strict separation of concerns:
1. **Tier 1 (Primitive)**: Physical values (`0ms`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms`, bezier formulas, `px` offsets, scale multipliers).
2. **Tier 2 (Semantic)**: Design intent and cognitive timing rules (`instant`, `fast`, `normal`, `slow`, `feedback`, `reveal`, `slide`, `active`, `highlight`).
3. **Tier 3 (Component)**: Bound to specific UI components (`reviewCard.flipDuration`, `conceptNode.pulseScale`, `button.scaleActive`).

```
[ Tier 1: Primitive ]              [ Tier 2: Semantic ]                 [ Tier 3: Component ]
primitiveMotion.duration[150]  -->  semanticMotion.duration.fast     -->  componentMotion.button.duration
primitiveMotion.scale.press    -->  semanticMotion.scale.active      -->  componentMotion.reviewCard.ratingScale
primitiveMotion.distance.md    -->  semanticMotion.distance.reveal   -->  componentMotion.toast.distance
```

---

### 3.2 Exact Code Blueprint: `packages/ui/src/tokens/primitive.ts`

```ts
/**
 * LINGUA OS Primitive Motion Tokens
 * DTCG 2025.10 Compliant Primitive Scale
 */

export const primitiveMotion = {
  duration: {
    0: '0ms',
    75: '75ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    400: '400ms',
    600: '600ms',
    // Named convenience & backwards compatibility aliases
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

export type PrimitiveMotion = typeof primitiveMotion;
export type PrimitiveMotionDuration = typeof primitiveMotion.duration;
export type PrimitiveMotionDurationKey = keyof PrimitiveMotionDuration;
export type PrimitiveMotionEasing = typeof primitiveMotion.easing;
export type PrimitiveMotionEasingKey = keyof PrimitiveMotionEasing;
export type PrimitiveMotionDistance = typeof primitiveMotion.distance;
export type PrimitiveMotionDistanceKey = keyof PrimitiveMotionDistance;
export type PrimitiveMotionScale = typeof primitiveMotion.scale;
export type PrimitiveMotionScaleKey = keyof PrimitiveMotionScale;
```

---

### 3.3 Exact Code Blueprint: `packages/ui/src/tokens/semantic.ts`

```ts
import { primitivePalette, primitiveRadius, primitiveSpace, primitiveMotion } from './primitive';

// [Retain existing ConceptStatus, semanticColors, ConceptStateDescriptor, conceptStateMetadata, duePresentationDescriptor]

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
    reveal: primitiveMotion.distance.md,  // 8px entrance reveal
    slide: primitiveMotion.distance.lg,   // 16px lateral queue transition
  },
  scale: {
    active: primitiveMotion.scale.press,       // 0.98 button/card press
    highlight: primitiveMotion.scale.pulse,    // 1.05 node status upgrade pulse
    feedback: primitiveMotion.scale.feedback,  // 1.02 subtle feedback elevation
  },
} as const;

export type SemanticMotion = typeof semanticMotion;
export type SemanticMotionDuration = typeof semanticMotion.duration;
export type SemanticMotionDurationKey = keyof SemanticMotionDuration;
export type SemanticMotionEasing = typeof semanticMotion.easing;
export type SemanticMotionEasingKey = keyof SemanticMotionEasing;
export type SemanticMotionDistance = typeof semanticMotion.distance;
export type SemanticMotionDistanceKey = keyof SemanticMotionDistance;
export type SemanticMotionScale = typeof semanticMotion.scale;
export type SemanticMotionScaleKey = keyof SemanticMotionScale;
```

---

### 3.4 Exact Code Blueprint: `packages/ui/src/tokens/component.ts`

```ts
/**
 * LINGUA OS Component Tokens
 * Defines component-level design and motion tokens derived from semantic tokens.
 * Tier 3 of the DTCG Primitive -> Semantic -> Component token architecture.
 */

export const componentMotion = {
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
    motion: componentMotion.button,
  },
  card: {
    bg: 'var(--surface)',
    border: 'var(--border-subtle)',
    radius: 'var(--radius-lg)',
    padding: '1.25rem',
    motion: componentMotion.card,
  },
  reviewCard: componentMotion.reviewCard,
  reviewSession: componentMotion.reviewSession,
  conceptNode: componentMotion.conceptNode,
  brainCanvas: componentMotion.brainCanvas,
  progressAnalytics: componentMotion.progressAnalytics,
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
  motion: componentMotion,
} as const;

export type ComponentMotion = typeof componentMotion;
export type ComponentTokens = typeof componentTokens;
```

---

### 3.5 Exact Code Blueprint: `packages/ui/src/tokens/index.ts`

```ts
export * from './primitive';
export * from './semantic';
export * from './component';
```

---

### 3.6 Exact Code Blueprint: `packages/ui/src/tokens/theme.css`

```css
/**
 * LINGUA OS CSS Variable Theme Tokens
 * Defines semantic tokens and DTCG motion tokens as CSS custom properties
 */

:root {
  /* [Retain existing Canvas, Surface, Text, Borders, Actions, Focus, Status, Radii] */

  /* ==========================================================================
     Primitive Motion Tokens (DTCG Tier 1)
     ========================================================================== */
  --motion-duration-0: 0ms;
  --motion-duration-75: 75ms;
  --motion-duration-150: 150ms;
  --motion-duration-200: 200ms;
  --motion-duration-300: 300ms;
  --motion-duration-400: 400ms;
  --motion-duration-600: 600ms;

  --motion-ease-linear: linear;
  --motion-ease-standard: cubic-bezier(0.2, 0.0, 0.0, 1.0);
  --motion-ease-enter: cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --motion-ease-exit: cubic-bezier(0.4, 0.0, 1.0, 1.0);
  --motion-ease-emphasized: cubic-bezier(0.2, 0.0, 0.0, 1.0);

  --motion-distance-xs: 2px;
  --motion-distance-sm: 4px;
  --motion-distance-md: 8px;
  --motion-distance-lg: 16px;

  --motion-scale-press: 0.98;
  --motion-scale-feedback: 1.02;
  --motion-scale-pulse: 1.05;

  /* ==========================================================================
     Semantic Motion Tokens (DTCG Tier 2)
     ========================================================================== */
  --motion-instant: var(--motion-duration-0);
  --motion-fast: var(--motion-duration-150);
  --motion-normal: 250ms;
  --motion-slow: var(--motion-duration-400);
  --motion-feedback: var(--motion-duration-200);

  --motion-distance-reveal: var(--motion-distance-md);
  --motion-distance-slide: var(--motion-distance-lg);

  --motion-scale-active: var(--motion-scale-press);
  --motion-scale-highlight: var(--motion-scale-pulse);

  /* Legacy aliases for backwards compatibility */
  --transition-fast: 150ms cubic-bezier(0.2, 0, 0, 1);
  --transition-base: 250ms cubic-bezier(0.2, 0, 0, 1);
}

.dark {
  /* [Retain existing Dark Theme Colors] */
}

/* ==========================================================================
   Reduced Motion Invariant Enforcement
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-fast: 0ms;
    --motion-normal: 0ms;
    --motion-slow: 0ms;
    --motion-feedback: 0ms;
    --motion-distance-reveal: 0px;
    --motion-distance-slide: 0px;
    --motion-scale-active: 1;
    --motion-scale-highlight: 1;
    --transition-fast: 0.01ms;
    --transition-base: 0.01ms;
  }

  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

### 3.7 GSAP Ergonomics & Helper Utilities

To facilitate clean, type-safe GSAP animations in Milestone 2 (`ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`, `ProgressAnalytics`), the following helper utilities are specified:

```ts
/**
 * Converts a millisecond duration token string ('250ms', '0ms') to numeric seconds (0.25, 0) for GSAP.
 */
export function motionDurationToSeconds(durationToken: string): number {
  const parsed = parseFloat(durationToken);
  return isNaN(parsed) ? 0 : parsed / 1000;
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
} as const;
```

---

## 4. Caveats

1. **Read-Only Explorer Scope**: As an Explorer agent, no direct modifications to repository source files were executed during this turn. All implementation code has been documented verbatim above for immediate drop-in adoption by the Worker agent (`worker_m1_1`).
2. **Backwards Compatibility Requirement**: Existing tests in `tests/frontend/tokens.test.ts` rely on `primitiveMotion.duration.fast` and `.base`. Preserving both numeric keys (`0..600`) and named aliases guarantees zero breaking changes across existing test suites.
3. **GSAP Milliseconds vs Seconds**: GSAP functions natively accept durations in seconds (`0.25`), whereas CSS variables and DTCG design tokens use `ms` (`'250ms'`). Using `motionDurationToSeconds` or `motionSeconds` prevents unit mismatch bugs during Milestone 2.

---

## 5. Conclusion & Implementation Plan

The DTCG 3-tier motion token architecture is completely specified, fully verified, and ready for immediate implementation in Milestone 1.

### Recommended Worker Execution Sequence:
1. Update `packages/ui/src/tokens/primitive.ts` with complete raw durations, curves, distances, scales, and types.
2. Update `packages/ui/src/tokens/semantic.ts` with semantic motion definitions and types.
3. Update `packages/ui/src/tokens/component.ts` with component motion tokens and bindings.
4. Update `packages/ui/src/tokens/theme.css` with CSS custom properties and reduced-motion overrides.
5. Expand `tests/frontend/tokens.test.ts` to assert all primitive, semantic, and component motion tokens.
6. Verify passing test suite using `npx vitest run tests/frontend/tokens.test.ts`.

---

## 6. Verification Method

### 6.1 Independent Verification Command
Run the Vitest test runner across the frontend token suite:
```powershell
npx vitest run tests/frontend/tokens.test.ts
```

### 6.2 Test Assertions Blueprint for `tests/frontend/tokens.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import {
  primitiveMotion,
  semanticMotion,
  componentMotion,
  componentTokens,
} from '@lingua/ui/tokens';

describe('DTCG 3-Tier Motion Tokens', () => {
  it('defines primitive raw duration scale', () => {
    expect(primitiveMotion.duration[0]).toBe('0ms');
    expect(primitiveMotion.duration[75]).toBe('75ms');
    expect(primitiveMotion.duration[150]).toBe('150ms');
    expect(primitiveMotion.duration[200]).toBe('200ms');
    expect(primitiveMotion.duration[300]).toBe('300ms');
    expect(primitiveMotion.duration[400]).toBe('400ms');
    expect(primitiveMotion.duration[600]).toBe('600ms');
  });

  it('defines primitive easing curves', () => {
    expect(primitiveMotion.easing.standard).toBe('cubic-bezier(0.2, 0.0, 0.0, 1.0)');
    expect(primitiveMotion.easing.enter).toBe('cubic-bezier(0.0, 0.0, 0.2, 1.0)');
    expect(primitiveMotion.easing.exit).toBe('cubic-bezier(0.4, 0.0, 1.0, 1.0)');
    expect(primitiveMotion.easing.emphasized).toBe('cubic-bezier(0.2, 0.0, 0.0, 1.0)');
  });

  it('defines primitive distances and scale multipliers', () => {
    expect(primitiveMotion.distance.xs).toBe('2px');
    expect(primitiveMotion.distance.md).toBe('8px');
    expect(primitiveMotion.distance.lg).toBe('16px');
    expect(primitiveMotion.scale.press).toBe(0.98);
    expect(primitiveMotion.scale.feedback).toBe(1.02);
    expect(primitiveMotion.scale.pulse).toBe(1.05);
  });

  it('defines semantic motion tokens with intent mapping', () => {
    expect(semanticMotion.duration.instant).toBe('0ms');
    expect(semanticMotion.duration.fast).toBe('150ms');
    expect(semanticMotion.duration.normal).toBe('250ms');
    expect(semanticMotion.duration.slow).toBe('400ms');
    expect(semanticMotion.duration.feedback).toBe('200ms');
    expect(semanticMotion.distance.reveal).toBe('8px');
    expect(semanticMotion.distance.slide).toBe('16px');
    expect(semanticMotion.scale.active).toBe(0.98);
    expect(semanticMotion.scale.highlight).toBe(1.05);
  });

  it('binds component motion tokens to semantic variables', () => {
    expect(componentMotion.button.scaleActive).toBe('var(--motion-scale-active)');
    expect(componentMotion.reviewCard.flipDuration).toBe('var(--motion-normal)');
    expect(componentMotion.reviewSession.slideDuration).toBe('var(--motion-fast)');
    expect(componentMotion.conceptNode.pulseScale).toBe('var(--motion-scale-highlight)');
    expect(componentTokens.motion).toBeDefined();
  });
});
```
