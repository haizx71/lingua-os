# Handoff Report: TypeScript & Token Test Explorer (Milestone 1)

**Agent ID**: `explorer_m1_3`  
**Role**: TypeScript & Token Test Explorer  
**Milestone**: Milestone 1 (Semantic Motion Token System & Core Utilities)  
**Date**: 2026-08-22  

---

## 1. Observation

Direct inspection of `tests/frontend/tokens.test.ts`, `packages/ui/src/tokens/`, and related test files across the repository revealed the following concrete observations:

### 1.1 Existing Token Test Suite State (`tests/frontend/tokens.test.ts`)
- **Lines 1–11**:
  ```ts
  import { describe, it, expect } from 'vitest';
  import {
    primitivePalette,
    primitiveSpace,
    primitiveRadius,
    primitiveTypography,
    primitiveMotion,
  } from '@lingua/ui/tokens/primitive';
  import { semanticColors, conceptStateMetadata, type ConceptStatus } from '@lingua/ui/tokens/semantic';
  import enumsContract from '../../contracts/enums.json';
  ```
- **Lines 40–44**:
  ```ts
  it('defines motion duration tokens', () => {
    expect(primitiveMotion.duration.fast).toBe('150ms');
    expect(primitiveMotion.duration.base).toBe('250ms');
  });
  ```
- **Current Test Execution**:
  Command: `npx vitest run tests/frontend/tokens.test.ts`
  Output: `✓ tests/frontend/tokens.test.ts (7 tests) 4ms - 1 passed (1), 7 passed (7)`.
- **Gaps Identified in Existing Tests**:
  1. Only 2 duration keys (`fast`, `base`) are asserted in `primitiveMotion.duration`. Missing raw numeric duration keys: `0`, `75`, `150`, `200`, `300`, `400`, `600`.
  2. Zero assertions for primitive easing curves (`linear`, `standard`, `enter`, `exit`, `emphasized`, `inOut`).
  3. Zero assertions for primitive distances (`xs`, `sm`, `md`, `lg`).
  4. Zero assertions for primitive scale multipliers (`press`, `feedback`, `pulse`).
  5. Zero assertions for `semanticMotion` tokens (`instant`, `fast`, `normal`, `slow`, `feedback`, `reveal`, `slide`, `active`, `highlight`).
  6. Zero assertions for `componentMotion` or `componentTokens.motion` (`button`, `card`, `reviewCard`, `reviewSession`, `conceptNode`, `brainCanvas`, `progressAnalytics`, `modal`, `toast`, `tooltip`).
  7. Zero assertions for reduced-motion token fallback behavior (CSS media query `:root` collapse, helper utilities).
  8. Zero compile-time type tests (`expectTypeOf`).

### 1.2 Existing Token Implementation Files
- **`packages/ui/src/tokens/primitive.ts` (lines 109–119)**:
  Currently defines only `fast: '150ms'`, `base: '250ms'`, `slow: '400ms'`, and `standard`, `inOut` easings. Lacks DTCG numeric durations (`0` to `600`), standard/enter/exit/emphasized/linear easings, all distances, and all scales.
- **`packages/ui/src/tokens/semantic.ts`**:
  Contains `semanticColors` and `conceptStateMetadata`, but lacks `semanticMotion` export and types.
- **`packages/ui/src/tokens/component.ts`**:
  Contains static styles for buttons/cards, but lacks `componentMotion` and motion property bindings.
- **`packages/ui/src/tokens/theme.css`**:
  Contains legacy `--transition-fast` and `--transition-base`. Lacks `--motion-*` custom properties in `:root` and lacks `:root` token overrides inside `@media (prefers-reduced-motion: reduce)`.
- **`packages/ui/src/tokens/index.ts`**:
  Re-exports `./primitive`, `./semantic`, and `./component`.

---

## 2. Logic Chain

1. **Backwards-Compatible Test Foundation**:
   - Existing code and test suites expect `primitiveMotion.duration.fast` (`150ms`) and `primitiveMotion.duration.base` (`250ms`).
   - The DTCG 3-tier motion architecture introduces numeric keys (`0`, `75`, `150`, `200`, `300`, `400`, `600`).
   - Therefore, unit tests must verify both numeric keys (e.g. `duration[150]`) and legacy named aliases (`duration.fast`, `duration.base`, `duration.slow`) to maintain compatibility without regression.

2. **DTCG Tier 1 (Primitive) Test Completeness**:
   - *Durations*: Test exact millisecond strings (`'0ms'`, `'75ms'`, `'150ms'`, `'200ms'`, `'300ms'`, `'400ms'`, `'600ms'`) and enforce monotonic duration order (`0 <= 75 < 150 < 200 < 300 < 400 < 600`).
   - *Easings*: Test exact bezier strings for `standard` (`cubic-bezier(0.2, 0.0, 0.0, 1.0)`), `enter` (`cubic-bezier(0.0, 0.0, 0.2, 1.0)`), `exit` (`cubic-bezier(0.4, 0.0, 1.0, 1.0)`), `emphasized` (`cubic-bezier(0.2, 0.0, 0.0, 1.0)`), and `linear` (`'linear'`). Assert regex compliance for valid CSS easing curves.
   - *Distances*: Test pixel strings (`xs: '2px'`, `sm: '4px'`, `md: '8px'`, `lg: '16px'`) and enforce pixel unit syntax (`/^\d+px$/`).
   - *Scales*: Test floating-point numbers (`press: 0.98`, `feedback: 1.02`, `pulse: 1.05`) and enforce mathematical bounds (`press < 1.0`, `feedback > 1.0`, `pulse > feedback`).

3. **DTCG Tier 2 (Semantic) Test Mapping**:
   - *Intent Durations*: Verify purpose mappings (`instant === '0ms'`, `fast === '150ms'`, `normal === '250ms'`, `slow === '400ms'`, `feedback === '200ms'`). Verify non-blocking timing invariant (all interaction feedback ≤ 300ms; max spatial transition ≤ 500ms).
   - *Spatial & Scale*: Verify `distance.reveal === '8px'`, `distance.slide === '16px'`, `scale.active === 0.98`, `scale.highlight === 1.05`, `scale.feedback === 1.02`.
   - *Easing References*: Verify `semanticMotion.easing` maps directly to primitive easings (`standard`, `enter`, `exit`, `emphasized`).

4. **DTCG Tier 3 (Component) Token & CSS Binding Tests**:
   - Verify `componentMotion` contains all P0/P1 components from `MOTION_AUDIT.md`: `button`, `card`, `reviewCard`, `reviewSession`, `conceptNode`, `brainCanvas`, `progressAnalytics`, `modal`, `toast`, `tooltip`.
   - Verify that all component token values are bound to standard CSS variables (`var(--motion-*)`).
   - Verify `componentTokens.motion` and nested component tokens (e.g. `componentTokens.button.motion`, `componentTokens.card.motion`) are defined and synchronized.

5. **Accessibility & Reduced-Motion Fallback Tests**:
   - *CSS Layer*: Assert that `theme.css` contains `@media (prefers-reduced-motion: reduce)` with `:root` overrides collapsing `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback` to `0ms`, distances to `0px`, and scales to `1`.
   - *Helper Utilities*: Assert `motionDurationToSeconds` converts `'250ms'` -> `0.25`, `'0ms'` -> `0`, and invalid inputs -> `0`.
   - *GSAP Constants*: Assert `motionSeconds` provides exact numeric seconds (`instant: 0`, `fast: 0.15`, `feedback: 0.2`, `normal: 0.25`, `slow: 0.4`, `maxSpatial: 0.5`, `staggerStep: 0.05`).

6. **TypeScript Compile-Time Type Safety**:
   - Use `expectTypeOf` from Vitest to assert exact literal types, key unions (`SemanticMotionDurationKey`, `PrimitiveMotionDurationKey`), and readonly immutability.

---

## 3. Caveats

1. **Read-Only Explorer Scope**: As an Explorer agent, no direct modifications to repository source files were executed. All test specifications, type checks, and code snippets are ready for immediate implementation by the Worker agent (`worker_m1_1`).
2. **JSDOM vs. CSS Parsing**: In the Vitest test environment (running on Node / JSDOM), raw `.css` files are not automatically parsed into DOM `getComputedStyle`. Reduced-motion CSS variable coverage is tested by reading `theme.css` file content and asserting media query AST/regex blocks, combined with TypeScript utility unit tests.
3. **Vitest `expectTypeOf` Compatibility**: Vitest 3.x natively includes `expectTypeOf`, which allows testing TypeScript types without needing external type-testing dependencies like `tsd` or `dtslint`.

---

## 4. Conclusion & Proposed Test Implementation

### 4.1 Exact Test Code Specification for `tests/frontend/tokens.test.ts`

The following complete test suite expands `tests/frontend/tokens.test.ts` with comprehensive unit tests for primitive, semantic, component, reduced-motion, and type-level assertions:

```ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  primitivePalette,
  primitiveSpace,
  primitiveRadius,
  primitiveTypography,
  primitiveMotion,
  type PrimitiveMotion,
  type PrimitiveMotionDurationKey,
  type PrimitiveMotionEasingKey,
  type PrimitiveMotionDistanceKey,
  type PrimitiveMotionScaleKey,
} from '@lingua/ui/tokens/primitive';
import {
  semanticColors,
  semanticMotion,
  conceptStateMetadata,
  type ConceptStatus,
  type SemanticMotion,
  type SemanticMotionDurationKey,
  type SemanticMotionDistanceKey,
  type SemanticMotionScaleKey,
} from '@lingua/ui/tokens/semantic';
import {
  componentTokens,
  componentMotion,
  type ComponentMotion,
  type ComponentTokens,
} from '@lingua/ui/tokens/component';
import enumsContract from '../../contracts/enums.json';

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
        expect(semanticMotion.distance.reveal).toBe('8px');
        expect(semanticMotion.distance.slide).toBe('16px');
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
    });
  });

  // =========================================================================
  // 3. Component Motion Tokens
  // =========================================================================
  describe('Component Motion Tokens (DTCG Tier 3)', () => {
    it('defines component motion bindings for interactive components with CSS variables', () => {
      // Button
      expect(componentMotion.button.duration).toBe('var(--motion-fast)');
      expect(componentMotion.button.ease).toBe('var(--motion-ease-standard)');
      expect(componentMotion.button.scaleActive).toBe('var(--motion-scale-active)');

      // Card
      expect(componentMotion.card.duration).toBe('var(--motion-normal)');
      expect(componentMotion.card.ease).toBe('var(--motion-ease-standard)');

      // ReviewCard (P0)
      expect(componentMotion.reviewCard.flipDuration).toBe('var(--motion-normal)');
      expect(componentMotion.reviewCard.flipEase).toBe('var(--motion-ease-standard)');
      expect(componentMotion.reviewCard.ratingDuration).toBe('var(--motion-fast)');
      expect(componentMotion.reviewCard.ratingScale).toBe('var(--motion-scale-active)');
      expect(componentMotion.reviewCard.revealDistance).toBe('var(--motion-distance-reveal)');

      // ReviewSession (P0)
      expect(componentMotion.reviewSession.slideDuration).toBe('var(--motion-fast)');
      expect(componentMotion.reviewSession.slideEase).toBe('var(--motion-ease-standard)');
      expect(componentMotion.reviewSession.slideDistance).toBe('var(--motion-distance-slide)');

      // ConceptNode (P0)
      expect(componentMotion.conceptNode.pulseDuration).toBe('var(--motion-feedback)');
      expect(componentMotion.conceptNode.pulseScale).toBe('var(--motion-scale-highlight)');
      expect(componentMotion.conceptNode.pulseEase).toBe('var(--motion-ease-enter)');

      // LanguageBrainCanvas (P0)
      expect(componentMotion.brainCanvas.panDuration).toBe('var(--motion-slow)');
      expect(componentMotion.brainCanvas.panEase).toBe('var(--motion-ease-standard)');

      // ProgressAnalytics (P1)
      expect(componentMotion.progressAnalytics.barDuration).toBe('var(--motion-normal)');
      expect(componentMotion.progressAnalytics.barStagger).toBe('50ms');
      expect(componentMotion.progressAnalytics.barEase).toBe('var(--motion-ease-enter)');

      // Modal & Toast
      expect(componentMotion.modal.enterDuration).toBe('var(--motion-slow)');
      expect(componentMotion.modal.exitDuration).toBe('var(--motion-feedback)');
      expect(componentMotion.toast.duration).toBe('var(--motion-feedback)');
      expect(componentMotion.toast.distance).toBe('var(--motion-distance-reveal)');
    });

    it('integrates motion definitions directly into componentTokens bundle', () => {
      expect(componentTokens.motion).toBeDefined();
      expect(componentTokens.motion).toEqual(componentMotion);
      expect(componentTokens.button.motion).toEqual(componentMotion.button);
      expect(componentTokens.card.motion).toEqual(componentMotion.card);
      expect(componentTokens.reviewCard).toEqual(componentMotion.reviewCard);
      expect(componentTokens.reviewSession).toEqual(componentMotion.reviewSession);
      expect(componentTokens.conceptNode).toEqual(componentMotion.conceptNode);
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

      checkVars(componentMotion as unknown as Record<string, unknown>);
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
  // 5. TypeScript Type-Level Assertions
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
      expectTypeOf<SemanticMotionDistanceKey>().toEqualTypeOf<'reveal' | 'slide'>();
      expectTypeOf<SemanticMotionScaleKey>().toEqualTypeOf<'active' | 'highlight' | 'feedback'>();
    });

    it('verifies ComponentMotion object structure and ComponentTokens integration', () => {
      expectTypeOf<ComponentMotion>().toBeObject();
      expectTypeOf<ComponentTokens>().toBeObject();
      expectTypeOf(componentTokens.motion).toEqualTypeOf<ComponentMotion>();
    });
  });
});
```

---

## 5. Verification Method

### 5.1 Verification Command
To verify the test suite after the Worker implements the motion tokens in `packages/ui/src/tokens/`:
```powershell
npx vitest run tests/frontend/tokens.test.ts
```

### 5.2 Full Suite Verification
Ensure the entire repository test suite passes with zero regressions:
```powershell
npx vitest run
```

### 5.3 Typecheck Verification
Ensure strict TypeScript compilation across the monorepo:
```powershell
npx tsc --project packages/ui/tsconfig.json
```

### 5.4 Invalidation Conditions
- Any duration key mismatch (e.g. `duration[150]` missing or named alias `duration.fast` failing).
- Any bezier curve mismatch between `primitiveMotion.easing` and `MOTION_DESIGN.md`.
- Missing `:root` reduced-motion overrides in `packages/ui/src/tokens/theme.css`.
- Any component token value that does not reference `var(--motion-*)`.
- Any TypeScript type assertion failure with `expectTypeOf`.
