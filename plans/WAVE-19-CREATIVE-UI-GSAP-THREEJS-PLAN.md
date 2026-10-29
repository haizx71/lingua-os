# WAVE 19 (Cycle 1 of 5) — Creative UI/UX, GSAP 60FPS Motion & Three.js 3D Overhaul Plan

## Overview
- **Goal**: Execute Cycle 1 of 5 (`Wave 19`) of the comprehensive UI/UX, GSAP 60FPS choreography, and Three.js 3D WebGL overhaul across all 10 LINGUA OS frontend screens while preserving 100% of existing tests (`wave1`..`wave18`, `e2e/*`, `contracts.test.ts`).
- **Skills Applied**: `creative-frontend`, `gsap-react`, `gsap-core`, `gsap-timeline`, `gsap-performance`, `threejs-graphics`.

## 5 Parallel Worker Subagent Scopes (Strict Non-Overlapping File Ownership)

1. **`W19-1` (`apps/web/src/app/globals.css`, `packages/ui/src/tokens/theme.css`, `apps/web/src/features/read/InteractiveReader.tsx`)**:
   - **Item #1 (`globals.css` & `theme.css` — Next-Gen Glassmorphism, Aurora Mesh & 3D Perspective Design Tokens)**:
     - Add CSS custom properties (`--aurora-gradient`, `--glass-bg`, `--glass-border`, `--shadow-glow-primary`, `--shadow-glow-teal`) in `theme.css` (both `:root` and `.dark`).
     - Add utility classes `.lingua-glass-panel`, `.lingua-aurora-hero`, `.lingua-3d-perspective`, `.lingua-3d-card`, `.lingua-shimmer-badge` in `globals.css`.
   - **Item #5 (`InteractiveReader.tsx` — GSAP Reading Progress Ribbon & Word Inspector Spring Entrance)**:
     - Import `gsap` and `{ useGSAP } from '@gsap/react'`.
     - Render a top glowing reading progress ribbon (`data-testid="reader-gsap-progress-ribbon"`) and animate Word Inspector dialog (`data-testid="inspector-gsap-spring-panel"`) using `useGSAP` (`scale`, `y`, `autoAlpha`) without writing to `localStorage` (`READ-LIVE-08` safe).

2. **`W19-2` (`apps/web/src/features/brain/ThreeBrainConstellation.tsx` [NEW], `apps/web/src/features/brain/LanguageBrainCanvas.tsx`)**:
   - **Item #2 (Real Three.js 3D Neural Knowledge Constellation + 2D/3D Switcher)**:
     - Create `apps/web/src/features/brain/ThreeBrainConstellation.tsx` using `three` (`THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.BufferGeometry`, `THREE.Points`, `THREE.PointsMaterial`, `THREE.LineSegments`, `THREE.LineBasicMaterial`, pre-allocated `THREE.Vector3` and `THREE.Color` outside the animation loop, full `.dispose()` cleanup on unmount, and automatic SVG/DOM fallback when `WebGLRenderingContext` is unavailable in JSDOM!).
     - Integrate `ThreeBrainConstellation` into `LanguageBrainCanvas.tsx` with `data-testid="brain-threejs-canvas-container"`, a 3D/2D mode toggle button (`data-testid="brain-3d-mode-toggle"`, `'🌌 Chế độ 3D (Three.js)'`), and orbital status indicator (`data-testid="brain-3d-orbit-status"`).

3. **`W19-3` (`apps/web/src/features/review/ReviewSession.tsx`, `apps/web/src/features/today/TodayDashboard.tsx`)**:
   - **Item #3 (`ReviewSession.tsx` — GSAP 3D Perspective Card Flip & Rating Celebration Timeline)**:
     - Wrap the flashcard stage with `data-testid="review-3d-card-stage"` (`data-gsap-flip-ready="true"`, `.lingua-3d-perspective`) and use `useGSAP` + `gsap.timeline()` to animate 3D card reveal (`rotationY`, `scale`, `ease: 'back.out(1.4)'`) and rating button pulse feedback.
   - **Item #4 (`TodayDashboard.tsx` — Aurora Hero Tilt & GSAP Staggered Bento Entrance)**:
     - Add `data-testid="today-aurora-hero"` (`.lingua-aurora-hero`) on the Today greeting/hero section and `data-testid="today-bento-stagger-grid"` on the main grid, using `useGSAP` to run a staggered entrance animation on `[data-gsap-bento-card]` when `!prefersReducedMotion`.

4. **`W19-4` (`apps/web/src/features/dictionary/DictionaryView.tsx`, `apps/web/src/features/library/LibraryView.tsx`, `apps/web/src/features/progress/ProgressAnalytics.tsx`)**:
   - **Item #6 (`DictionaryView.tsx` — Glassmorphic Search Bar & GSAP Acoustic Soundwave Visualizer)**:
     - Add `data-testid="dictionary-glass-search-bar"` (`.lingua-glass-panel`) and an acoustic soundwave visualizer (`data-testid="dictionary-soundwave-visualizer"`, 5 animated SVG/div bars driven by `useGSAP` when speaking). Never add `span.font-mono` (`f10-library-dictionary.test.tsx` invariant).
   - **Item #7 (`LibraryView.tsx` — Floating Glass Filter Dock & GSAP Animated Grid)**:
     - Add `data-testid="library-glass-filter-dock"` (`.lingua-glass-panel`) on the filter/bulk toolbar and `data-testid="library-animated-grid"` with `useGSAP` transition when toggling density or filters.
   - **Item #8 (`ProgressAnalytics.tsx` — 3D Orbital Mastery Ring & GSAP KPI Strip)**:
     - Add an orbital mastery ring visualization (`data-testid="progress-3d-orbital-ring"`) inside `progress-cefr-milestone` and `data-testid="progress-gsap-kpi-strip"` with `useGSAP` entrance tweening.

5. **`W19-5` (`apps/web/src/features/profile/ProfileView.tsx`, `apps/web/src/features/settings/SettingsView.tsx`, `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx`, `tests/frontend/wave19-creative-ui-gsap-threejs.test.tsx`)**:
   - **Item #9 (`ProfileView.tsx` & `SettingsView.tsx` — Holographic Achievements & Live Motion Preview Stage)**:
     - Add `data-testid="profile-holographic-achievements"` with `.lingua-shimmer-badge` / 3D hover tilt on unlocked badges in `ProfileView.tsx`.
     - Add `data-testid="settings-motion-preview-stage"` in `SettingsView.tsx` showing a live interactive GSAP motion preview orb (`data-motion-state={reducedMotion ? 'reduced' : 'active'}`).
   - **Item #10 (`OnboardingDiagnostic.tsx` & `tests/frontend/wave19-creative-ui-gsap-threejs.test.tsx`)**:
     - Add `data-testid="onboarding-gsap-step-stage"` (`useGSAP` question transition) and `data-testid="onboarding-3d-celebration-badge"` on the completion screen in `OnboardingDiagnostic.tsx`.
     - Create `tests/frontend/wave19-creative-ui-gsap-threejs.test.tsx` testing all 10 Wave 19 Creative UI, GSAP, and Three.js upgrades.
