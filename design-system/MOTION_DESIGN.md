# LINGUA OS — Motion Design System & Technical Specification

Version: 1.0  
Status: APPROVED MOTION SPECIFICATION  
Consumer: Frontend Web (`apps/web`), UI Package (`packages/ui`), Storybook, Animation Tests

---

## 1. Motion Philosophy & Principles

Motion in LINGUA OS exists exclusively to serve **learning comprehension, state continuity, feedback, and perceived responsiveness**. It is an ergonomic affordance, never decorative ornament or gamified spectacle.

### Core Principles
1. **Comprehension & Continuity**: Smooth visual transitions connect related states (e.g. flashcard question to revealed answer; word selected in reader to dictionary definition popover; concept node state update in the Language Brain).
2. **Restraint & Serenity**: Animations are brief, calm, and purposeful. No bouncy arcade-style celebrations, fireworks, flying gems, or disruptive entrance choreography.
3. **Immediacy, Timing Limits & Zero Blocking**: Primary interaction feedback should normally complete within 300ms. Motion up to 500ms is permitted only for non-blocking spatial transitions or data visualization when explicitly justified by `MOTION_AUDIT.md`. Users can click, answer cards, and navigate with keyboard shortcuts instantly without waiting for an animation cycle to finish.
4. **GSAP vs. CSS Boundary**: Do not use GSAP when a simple CSS transition is sufficient. Use GSAP only for coordinated timelines, sequencing, complex transforms, lifecycle-controlled motion, or interactions where GSAP provides clear engineering value.
5. **Immediate Semantic Data Correctness**: Progress and Language Brain data must be semantically correct immediately in the DOM/ARIA tree. Animation may reveal or transition visual presentation, but must NEVER display misleading intermediate scores, interpolated false retention values, incorrect mastery levels, or fake learning metrics.
6. **Performance by Construction**: Animations rely strictly on hardware-composited properties (`transform` and `opacity`). Layout thrashing (animating `width`, `height`, `top`, `left`, `margin`, `padding`) is strictly prohibited.
7. **Accessibility Invariant (`prefers-reduced-motion`)**: Every animation is paired with an immediate fallback (`duration: 0` or subtle opacity cross-fade). No essential instructional information may depend solely on motion.

---

## 2. 3-Tier Motion Token Architecture

Motion tokens follow the DTCG 3-tier layering standard:

```
[ Primitive Motion Tokens ]  -->  [ Semantic Motion Tokens ]  -->  [ Component Motion Tokens ]
(Raw ms durations & eases)        (Purpose-driven timing)           (Component-scoped bindings)
```

### 2.1 Primitive Tokens

```css
:root {
  /* Primitive Durations */
  --motion-duration-0: 0ms;
  --motion-duration-75: 75ms;
  --motion-duration-150: 150ms;
  --motion-duration-200: 200ms;
  --motion-duration-300: 300ms;
  --motion-duration-400: 400ms;
  --motion-duration-600: 600ms;

  /* Primitive Easing Curves */
  --motion-ease-linear: linear;
  --motion-ease-standard: cubic-bezier(0.2, 0.0, 0.0, 1.0);     /* power2.out equivalent */
  --motion-ease-enter: cubic-bezier(0.0, 0.0, 0.2, 1.0);        /* Decelerate / power1.out */
  --motion-ease-exit: cubic-bezier(0.4, 0.0, 1.0, 1.0);         /* Accelerate / power1.in */
  --motion-ease-emphasized: cubic-bezier(0.2, 0.0, 0.0, 1.0);   /* Calm focus curve */

  /* Primitive Distances & Scales */
  --motion-distance-xs: 2px;
  --motion-distance-sm: 4px;
  --motion-distance-md: 8px;
  --motion-distance-lg: 16px;
  --motion-scale-press: 0.98;
  --motion-scale-feedback: 1.02;
}
```

### 2.2 Semantic Motion Tokens

| Semantic Token | Value / Mapping | Usage Context |
| :--- | :--- | :--- |
| `--motion-instant` | `0ms` | Reduced-motion mode, instant resets |
| `--motion-fast` | `150ms` (`--motion-ease-standard`) | Button clicks, micro-interactions, chip selections |
| `--motion-normal` | `250ms` (`--motion-ease-standard`) | Card flips, popover reveals, tab switching, rating feedback |
| `--motion-slow` | `400ms` (`--motion-ease-standard`) | Modal appearances, drawer reveals, complex graph layouts |
| `--motion-feedback` | `200ms` (`--motion-ease-enter`) | Toast notifications, subtle checkmark reveals |
| `--motion-distance-reveal` | `8px` (`--motion-distance-md`) | Subtle vertical offset on entrance |
| `--motion-scale-active` | `0.98` (`--motion-scale-press`) | Active press visual feedback on interactive cards |

---

## 3. Allowed vs. Prohibited Motion Patterns

### Allowed Motion Categories
- **Immediate State Feedback**: Subtle scale (0.98 -> 1.0) and border color illumination on rating click or button submission.
- **Card Flip & Content Reveal**: Fast 200–250ms horizontal/vertical flip or cross-fade on flashcard prompt -> answer reveal.
- **Language Brain Graph Focus**: Smooth pan and zoom centering to target concept node upon selection without layout shift.
- **Progress Meter Updates**: Smooth CSS transition or GSAP GPU transform (`transform: scaleX(0 -> 1)` with `transform-origin: left`) for progress bar fill (150–250ms) reflecting time spent or items completed, avoiding layout reflows.
- **Contextual Popovers & Sheets**: Mobile bottom-sheet slide-up (300ms with deceleration ease) and desktop popover fade-in (150ms).

### Prohibited Motion Patterns
- ❌ **Scroll Hijacking & Forced Snap**: Never interfere with native browser scrolling physics.
- ❌ **Permanent Looping Animations**: No continuous floating, pulsing, glowing, or spinning elements (except standard loading spinner).
- ❌ **Cinematic / Dramatic Page Entrances**: No full-page slide-in sequences or multi-second hero entrances.
- ❌ **Gamified Arcade Celebrations**: No confetti explosions, flying coins, bouncing gems, or flashing casino reward loops.
- ❌ **Blocking Animations**: No animations that disable user inputs or delay next-card transitions in Review or Reader.
- ❌ **Layout-Property Tweens**: No animating `width`, `height`, `top`, `left`, `margin`, `padding` with GSAP (use `transform: translate3d/scale/scaleX` and `opacity` exclusively).

---

## 4. Technical Architecture: GSAP in React / Next.js

All programmatic animations in LINGUA OS adhere to strict engineering constraints using `@gsap/react` and official GreenSock best practices:

### 4.1 Prefer `useGSAP()` Hook & `usePrefersReducedMotion()`
All GSAP animations inside React components MUST be managed with the `useGSAP()` hook from `@gsap/react` paired with the standard `usePrefersReducedMotion()` hook:
```tsx
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { usePrefersReducedMotion, componentMotionNumeric } from '@lingua/ui';

// Register hook plugin once at bundle startup
if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export function InteractiveNode({ isSelected }: { isSelected: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(() => {
    // Check reduced-motion preference via standard SSR-safe hook
    if (prefersReducedMotion) {
      gsap.set(containerRef.current, { scale: isSelected ? 1.05 : 1, clearProps: 'transform' });
      return;
    }

    gsap.to(containerRef.current, {
      scale: isSelected ? 1.05 : 1,
      duration: componentMotionNumeric.conceptNode.pulseDurationStep,
      ease: componentMotionNumeric.conceptNode.pulseEaseUp,
      overwrite: 'auto',
    });
  }, { dependencies: [isSelected, prefersReducedMotion], scope: containerRef });

  return <div ref={containerRef} className="node" />;
}
```

### 4.2 Mandatory Scoping & Garbage Collection
- **Scoped Selectors**: Every `useGSAP()` call MUST declare `{ scope: containerRef }` so that selector strings (e.g. `'.chip'`) never leak outside the component DOM tree.
- **Automatic Lifecycle Reversion**: `useGSAP()` automatically reverts all created tweens, timelines, and event listeners upon component unmount.
- **Context-Safe Event Callbacks**: If animations are triggered by user events (clicks, pointer moves) after mount, wrap them with `contextSafe()` provided by `useGSAP`.

### 4.3 Next.js SSR & Server Component Rules
- GSAP is a **client-only** browser runtime.
- Any component containing GSAP animation logic MUST declare `'use client';` at the top of the file.
- Never invoke GSAP methods (`gsap.to`, `gsap.timeline`, etc.) during Server-Side Rendering (SSR).

---

## 5. Accessibility & `prefers-reduced-motion`

### Reduced-Motion Invariant
When the system media query `(prefers-reduced-motion: reduce)` evaluates to `true`:
1. All motion durations collapse to `0ms` (instant state change) or a minimal `100ms` opacity-only fade.
2. Translations (`x`, `y`), scale transformations, and rotations are disabled.
3. Audio/visual feedback remains fully accessible via static state classes and accessible ARIA attributes (`aria-live`, `aria-checked`, `role="status"`).

### Standard Hook Pattern
```tsx
import { usePrefersReducedMotion } from '@lingua/ui';

// Inside React components:
const prefersReducedMotion = usePrefersReducedMotion();
```

---

## 6. Storybook & Visual Regression Rules

Storybook stories for animated components MUST demonstrate:
1. **Default Resting State**: Visual presentation before interaction.
2. **Interactive / Active State**: Visual presentation during and after state transition.
3. **Reduced Motion State**: Verified instant state toggle without layout shift.
4. **Theme Variations**: Light mode and Dark mode contrast compliance across all animation keyframes.

---

## 7. Performance & Monitoring Thresholds

- **Frame Rate Target**: Solid 60 FPS on mid-tier mobile hardware.
- **Cumulative Layout Shift (CLS)**: `0.00` induced by motion (transforms do not trigger reflows).
- **Zero Animation Leaks**: 100% of tweens killed and reverted when navigating between routes.
