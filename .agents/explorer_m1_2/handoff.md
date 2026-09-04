# Handoff Report: Theme & CSS Motion Token Explorer (Milestone 1)

## 1. Observation

Direct investigation of the codebase and motion design specifications revealed the following current state:

### 1.1 `packages/ui/src/tokens/theme.css`
- **Lines 55–58**: Currently defines only two transitions without motion tokens:
  ```css
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.2, 0, 0, 1);
  --transition-base: 250ms cubic-bezier(0.2, 0, 0, 1);
  ```
- **Lines 103–110**: The `@media (prefers-reduced-motion: reduce)` block only applies an inline override to elements:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
  It **lacks `:root` CSS custom property overrides** for motion tokens (such as duration, distance, scale, or transition variables).
- **Missing custom properties**:
  - Primitive durations: `--motion-duration-0`, `--motion-duration-75`, `--motion-duration-150`, `--motion-duration-200`, `--motion-duration-300`, `--motion-duration-400`, `--motion-duration-600`.
  - Primitive easings: `--motion-ease-linear`, `--motion-ease-standard`, `--motion-ease-enter`, `--motion-ease-exit`, `--motion-ease-emphasized`.
  - Primitive distances: `--motion-distance-xs`, `--motion-distance-sm`, `--motion-distance-md`, `--motion-distance-lg`.
  - Primitive scales: `--motion-scale-press`, `--motion-scale-feedback`, `--motion-scale-pulse`.
  - Semantic tokens: `--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`, `--motion-distance-reveal`, `--motion-distance-slide`, `--motion-scale-active`, `--motion-scale-highlight`.

### 1.2 `apps/web/tailwind.config.js`
- **Lines 8–34**: The current `theme.extend` object only configures `colors` and `borderRadius`:
  ```javascript
  module.exports = {
    content: [
      './src/**/*.{js,ts,jsx,tsx,mdx}',
      '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
      extend: {
        colors: { /* ... */ },
        borderRadius: { /* ... */ },
      },
    },
    plugins: [],
  };
  ```
  It lacks extensions for `transitionDuration`, `transitionTimingFunction`, `scale`, and `spacing`/`translate` pointing to `--motion-*` variables.

### 1.3 Consumers of `theme.css`
- `apps/web/src/app/globals.css` (line 5): `@import '../../../../packages/ui/src/tokens/theme.css';`
- `packages/ui/.storybook/preview.ts` (line 2): `import '../src/tokens/theme.css';`
- `theme.css` is therefore the shared root styling layer for both the Next.js web application and the Storybook component catalog.

### 1.4 Design System Specifications
- `design-system/MOTION_DESIGN.md` (§2.1, §2.2, §5) and `PROJECT.md` (§Tokens, §Component Contracts) specify exact token names and values for primitive scales (0–600ms, standard/enter/exit/emphasized easing, xs–lg distances, press/feedback/pulse scales) and semantic mappings.

---

## 2. Logic Chain

1. **Layering & Single Source of Truth**: Because `apps/web/src/app/globals.css` and Storybook `preview.ts` both import `packages/ui/src/tokens/theme.css`, placing motion custom properties in `:root` of `theme.css` guarantees consistent token availability everywhere without duplicating declarations.
2. **DTCG 3-Tier Mapping in CSS**:
   - *Tier 1 (Primitive)*: Raw durations (`0ms`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms`), standard cubic bezier curves, pixel distances (`2px`, `4px`, `8px`, `16px`), and transform scales (`0.98`, `1.02`, `1.05`).
   - *Tier 2 (Semantic)*: Purpose-based tokens referencing primitive variables (`--motion-fast: var(--motion-duration-150);`, `--motion-normal: 250ms;`, `--motion-distance-reveal: var(--motion-distance-md);`, `--motion-scale-active: var(--motion-scale-press);`).
   - *Tier 3 (Transitions)*: `--transition-fast: var(--motion-fast) var(--motion-ease-standard);` and `--transition-base: var(--motion-normal) var(--motion-ease-standard);`.
3. **Reduced Motion Accessibility Invariant**:
   - Element-level rules (`*, ::before, ::after`) handle CSS animations and transitions on the DOM tree, but components reading CSS variables directly (via inline styles or JS `getComputedStyle`) require the `:root` variables themselves to be collapsed.
   - Under `@media (prefers-reduced-motion: reduce)`, `:root` must collapse all `--motion-duration-*`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback` to `0ms`, distances to `0px`, scales to `1`, and transitions to `0ms linear`.
4. **Tailwind Config Extension**:
   - Extending `transitionDuration`, `transitionTimingFunction`, `scale`, and `spacing` in `apps/web/tailwind.config.js` allows developers and components to use standard utility classes (e.g. `duration-fast`, `duration-normal`, `ease-standard`, `scale-press`, `active:scale-press`, `translate-y-motion-reveal`).
   - Because these classes map directly to `var(--motion-*)`, they automatically respect `@media (prefers-reduced-motion: reduce)` without requiring ad-hoc conditional logic or duplication.

---

## 3. Caveats

1. **CSS Custom Properties vs. TypeScript Tokens**:
   - `theme.css` defines CSS custom properties for pure CSS transitions, Tailwind utilities, and Storybook styling.
   - `primitive.ts` and `semantic.ts` define TypeScript constants used by GSAP timelines (`useGSAP`) and component prop types.
   - Both must remain strictly synchronized in values (`duration`, `easing`, `distance`, `scale`).
2. **Semantic Duration Normal (250ms)**:
   - `primitiveMotion` has `200ms` and `300ms` as discrete scale steps, while `semanticMotion` / `MOTION_DESIGN.md` defines `normal: '250ms'`. In `theme.css`, `--motion-normal: 250ms;` is defined cleanly alongside primitive duration variables.
3. **JSDOM Test Environment**:
   - Vitest unit tests in `tests/frontend/tokens.test.ts` run in Node / JSDOM where raw CSS stylesheets are not automatically parsed into `getComputedStyle`. Token assertions in Vitest should test the TypeScript token scales and stylesheet file contents.

---

## 4. Conclusion & Proposed Implementation

### 4.1 Proposed `packages/ui/src/tokens/theme.css` Additions

```css
:root {
  /* ... existing colors, borders, actions, focus, status, radii ... */

  /* Primitive Motion Tokens - Durations */
  --motion-duration-0: 0ms;
  --motion-duration-75: 75ms;
  --motion-duration-150: 150ms;
  --motion-duration-200: 200ms;
  --motion-duration-300: 300ms;
  --motion-duration-400: 400ms;
  --motion-duration-600: 600ms;

  /* Primitive Motion Tokens - Easing Curves */
  --motion-ease-linear: linear;
  --motion-ease-standard: cubic-bezier(0.2, 0.0, 0.0, 1.0);     /* power2.out equivalent */
  --motion-ease-enter: cubic-bezier(0.0, 0.0, 0.2, 1.0);        /* Decelerate / power1.out */
  --motion-ease-exit: cubic-bezier(0.4, 0.0, 1.0, 1.0);         /* Accelerate / power1.in */
  --motion-ease-emphasized: cubic-bezier(0.2, 0.0, 0.0, 1.0);   /* Calm focus curve */

  /* Primitive Motion Tokens - Distances & Scales */
  --motion-distance-xs: 2px;
  --motion-distance-sm: 4px;
  --motion-distance-md: 8px;
  --motion-distance-lg: 16px;
  --motion-scale-press: 0.98;
  --motion-scale-feedback: 1.02;
  --motion-scale-pulse: 1.05;

  /* Semantic Motion Tokens */
  --motion-instant: var(--motion-duration-0);
  --motion-fast: var(--motion-duration-150);
  --motion-normal: 250ms;
  --motion-slow: var(--motion-duration-400);
  --motion-feedback: var(--motion-duration-200);
  --motion-distance-reveal: var(--motion-distance-md);
  --motion-distance-slide: var(--motion-distance-lg);
  --motion-scale-active: var(--motion-scale-press);
  --motion-scale-highlight: var(--motion-scale-pulse);

  /* Transitions */
  --transition-fast: var(--motion-fast) var(--motion-ease-standard);
  --transition-base: var(--motion-normal) var(--motion-ease-standard);
}

/* Reduced Motion Override */
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-0: 0ms;
    --motion-duration-75: 0ms;
    --motion-duration-150: 0ms;
    --motion-duration-200: 0ms;
    --motion-duration-300: 0ms;
    --motion-duration-400: 0ms;
    --motion-duration-600: 0ms;
    --motion-instant: 0ms;
    --motion-fast: 0ms;
    --motion-normal: 0ms;
    --motion-slow: 0ms;
    --motion-feedback: 0ms;
    --motion-distance-xs: 0px;
    --motion-distance-sm: 0px;
    --motion-distance-md: 0px;
    --motion-distance-lg: 0px;
    --motion-distance-reveal: 0px;
    --motion-distance-slide: 0px;
    --motion-scale-press: 1;
    --motion-scale-feedback: 1;
    --motion-scale-pulse: 1;
    --motion-scale-active: 1;
    --motion-scale-highlight: 1;
    --transition-fast: 0ms linear;
    --transition-base: 0ms linear;
  }

  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 4.2 Proposed `apps/web/tailwind.config.js` Extension

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-subtle': 'var(--surface-subtle)',
        'surface-elevated': 'var(--surface-elevated)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'action-primary': 'var(--action-primary)',
        'action-primary-hover': 'var(--action-primary-hover)',
        'action-secondary': 'var(--action-secondary)',
        'action-secondary-hover': 'var(--action-secondary-hover)',
        'focus-ring': 'var(--focus-ring)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionDuration: {
        '0': 'var(--motion-duration-0)',
        '75': 'var(--motion-duration-75)',
        '150': 'var(--motion-duration-150)',
        '200': 'var(--motion-duration-200)',
        '300': 'var(--motion-duration-300)',
        '400': 'var(--motion-duration-400)',
        '600': 'var(--motion-duration-600)',
        'instant': 'var(--motion-instant)',
        'fast': 'var(--motion-fast)',
        'normal': 'var(--motion-normal)',
        'slow': 'var(--motion-slow)',
        'feedback': 'var(--motion-feedback)',
      },
      transitionTimingFunction: {
        'standard': 'var(--motion-ease-standard)',
        'enter': 'var(--motion-ease-enter)',
        'exit': 'var(--motion-ease-exit)',
        'emphasized': 'var(--motion-ease-emphasized)',
      },
      scale: {
        'press': 'var(--motion-scale-press)',
        'feedback': 'var(--motion-scale-feedback)',
        'pulse': 'var(--motion-scale-pulse)',
        'active': 'var(--motion-scale-active)',
      },
      spacing: {
        'motion-xs': 'var(--motion-distance-xs)',
        'motion-sm': 'var(--motion-distance-sm)',
        'motion-md': 'var(--motion-distance-md)',
        'motion-lg': 'var(--motion-distance-lg)',
        'motion-reveal': 'var(--motion-distance-reveal)',
      },
    },
  },
  plugins: [],
};
```

---

## 5. Verification Method

To independently verify the implementation:
1. **CSS Token Inspection**:
   - Inspect `packages/ui/src/tokens/theme.css` and assert that all primitive durations (`0` to `600`), easings (`standard`, `enter`, `exit`, `emphasized`), distances (`xs` to `lg`), scales (`press`, `feedback`, `pulse`), and semantic tokens are present in `:root`.
   - Verify that `@media (prefers-reduced-motion: reduce)` contains `:root` overrides collapsing durations to `0ms`, distances to `0px`, scales to `1`, and transitions to `0ms linear`.
2. **Tailwind Config Inspection**:
   - Inspect `apps/web/tailwind.config.js` and verify `transitionDuration`, `transitionTimingFunction`, `scale`, and `spacing` extensions map to `var(--motion-*)`.
3. **Build & Test Commands**:
   - Run typecheck: `pnpm typecheck`
   - Run unit tests: `pnpm test`
   - Run Storybook build: `pnpm --filter @lingua/ui build-storybook`
   - Run web build: `pnpm --filter @lingua/web build`
4. **Invalidation Conditions**:
   - Any token name mismatch between TypeScript exports (`primitiveMotion`, `semanticMotion`) and CSS variable names (`--motion-*`).
   - Failure of Tailwind to resolve utility classes like `duration-fast` or `scale-press`.
   - Missing `:root` variable collapse under reduced motion.
