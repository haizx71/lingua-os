# Handoff Report: Brain & Progress Domain Motion Integration Analysis (Milestone 2)

**Explorer**: Brain & Progress Domain Motion Explorer (`explorer_m2_2`)  
**Target Milestone**: Milestone 2 — P0/P1 GSAP Learning Loop Component Enhancements  
**Target Components**:
1. `apps/web/src/features/brain/LanguageBrainCanvas.tsx`
2. `packages/ui/src/components/ConceptNode/ConceptNode.tsx`
3. `apps/web/src/features/progress/ProgressAnalytics.tsx`

---

## 1. Observation

### 1.1 Existing Implementations & Gap Analysis

#### `apps/web/src/features/brain/LanguageBrainCanvas.tsx`
- **Current Observation**:
  - Located at lines 1–392. Client component (`'use client'`).
  - Manages zoom via local state `zoomLevel` (clamped 50–150%) at line 51:
    ```tsx
    const [zoomLevel, setZoomLevel] = useState<number>(100);
    ```
  - Zoom controls at lines 198–226 invoke `setZoomLevel((prev) => Math.max(50, prev - 10))` and `Math.min(150, prev + 10)`.
  - The canvas container (lines 288–291) applies a naive inline CSS scale:
    ```tsx
    <div
      className="p-6 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] min-h-[300px] flex flex-wrap content-start gap-3 transition-transform origin-top-left"
      style={{ transform: `scale(${zoomLevel / 100})` }}
    >
    ```
  - When a node is clicked (lines 69–74, `handleNodeClick`), only React state is updated (`setSelectedNode(node)`).
  - **Gap**: There is no camera panning or centering to bring the selected node to the viewport center $(W_v / 2, H_v / 2)$. If the canvas is zoomed in or the node is located at the periphery, the user must manually scroll/guess. The inline CSS `transition-transform` causes uncoordinated jumps and lacks boundary clamping.

#### `packages/ui/src/components/ConceptNode/ConceptNode.tsx`
- **Current Observation**:
  - Located at lines 1–107. Renders interactive vocabulary concept nodes with CEFR levels, mastery statuses (8 enum statuses), and review-due indicators.
  - Currently relies strictly on static Tailwind classes at line 92:
    ```tsx
    isSelected && 'ring-2 ring-[var(--focus-ring)] shadow-md scale-105',
    ```
  - **Gap**: Status upgrades (e.g. from `learning` to `familiar` or `mastered`) or selection changes do not trigger the approved 200ms scale pulse (`1.0 -> 1.05 -> 1.0`) with border illumination flare specified in `MOTION_DESIGN.md` §4.1 and `MOTION_AUDIT.md`. No `useGSAP` hook or animation cleanup lifecycle is currently present.

#### `apps/web/src/features/progress/ProgressAnalytics.tsx`
- **Current Observation**:
  - Located at lines 1–247. Client component (`'use client'`).
  - Renders time-window switcher (`'7d'` vs `'30d'`), weekly highlights, CEFR stepper (ADR-009), and 4 activity breakdown progress bars (lines 201–244).
  - Activity breakdown uses `<Progress value={...} max={100} size="sm" variant="..." />`.
  - **Gap**: On initial mount and when switching between `'7d'` and `'30d'` time windows, progress bars render instantly without visual pacing. There is no staggered 250ms bar entrance (`scaleX: 0 -> 1` with 50ms stagger per bar) to organize cognitive intake as mandated by `MOTION_AUDIT.md` (P1).

---

## 2. Logic Chain & Architectural Design

```
[MOTION_DESIGN.md & MOTION_AUDIT.md]
                 │
  ┌──────────────┴──────────────┐
  ▼                             ▼
[Spatial & Graph Motion]     [Data Viz & Feedback Motion]
  │                             │
  ├─ LanguageBrainCanvas         ├─ ConceptNode
  │  Camera pan & zoom center   │  200ms scale pulse (1.0->1.05->1.0)
  │  (gsap.to transforms)       │  + border illumination
  │                             │
  └─ Clamped [0.5, 1.5] zoom   └─ ProgressAnalytics
     Zero layout thrashing         Staggered 250ms bar entrance
                                   (scaleX: 0->1, stagger: 50ms)
                                   Immediate ARIA & DOM values
```

### 2.1 Motion Invariant Adherence Matrix

| Invariant | Specification Rule | `LanguageBrainCanvas` Strategy | `ConceptNode` Strategy | `ProgressAnalytics` Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Invariant 1** (Timing & Non-Blocking) | Feedback $\le 300\text{ms}$; spatial transitions $\le 500\text{ms}$. Zero input blocking. | Pan & zoom duration: `400ms` (`motionSeconds.slow`). `overwrite: 'auto'` allows rapid clicks without locking. | Pulse duration: `200ms` (`motionSeconds.feedback`). 0ms click delay. | Entrance duration: `250ms` (`motionSeconds.normal`), `50ms` stagger. Time window toggle immediate. |
| **Invariant 2** (GSAP vs CSS Boundary) | CSS for simple hover/pills; GSAP for spatial & coordinated timelines. | GSAP drives 2D transform matrix `(x, y, scale)`. CSS handles button hovers and filter chips. | GSAP drives 2-step pulse timeline; CSS handles static role borders and ring shadows. | GSAP drives `scaleX` fill stagger; CSS handles track backgrounds and typography. |
| **Invariant 3** (Immediate Semantic Data) | DOM text & ARIA reflect true data immediately without ticker stepping. | Selected node metadata & detail drawer populate immediately on click. | `aria-label`, `aria-selected`, and status badge reflect true values immediately. | `aria-valuenow`, `aria-valuemin/max`, and percentage text labels are statically rendered from frame 0. |
| **Reduced Motion** | 100% collapse to `duration: 0` or instant state change. | `isReducedMotion` triggers `gsap.set` with 0ms transition. | `isReducedMotion` sets `scale: 1` instantly without pulse. | `isReducedMotion` sets `scaleX: 1, opacity: 1` instantly without stagger. |

---

## 3. Concrete Technical Implementation Blueprints

### 3.1 `LanguageBrainCanvas.tsx` Integration Blueprint

#### Architecture
1. **Viewport & Stage Structure**:
   - `viewportRef`: Outer container with `overflow-hidden relative w-full h-[460px] sm:h-[520px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]`.
   - `stageRef`: Inner content layer with `will-change: transform; transform-origin: 0 0; position: absolute; top: 0; left: 0; min-width: 100%; min-height: 100%;`.
   - `nodeRefs`: Dictionary `Record<string, HTMLButtonElement | null>` mapping concept IDs to DOM nodes to read exact coordinates (`offsetLeft`, `offsetTop`, `offsetWidth`, `offsetHeight`).
2. **Camera Math**:
   - Viewport dimensions: $W_v = \text{viewportRef.clientWidth}$, $H_v = \text{viewportRef.clientHeight}$.
   - Node center: $X_n = \text{el.offsetLeft} + \text{el.offsetWidth}/2$, $Y_n = \text{el.offsetTop} + \text{el.offsetHeight}/2$.
   - Target translation at scale $S \in [0.5, 1.5]$:
     $$T_x = \frac{W_v}{2} - (X_n \cdot S), \quad T_y = \frac{H_v}{2} - (Y_n \cdot S)$$
   - Clamping ensures the canvas content remains in-bounds.

#### TypeScript Implementation Snippet
```tsx
'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { usePrefersReducedMotion, motionSeconds } from '@lingua/ui';
// ... other imports ...

// Ensure useGSAP plugin is registered
if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export function LanguageBrainCanvas({
  initialNodes = defaultBrainNodes,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSelectConcept,
}: LanguageBrainCanvasProps) {
  const prefersReduced = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Camera state
  const cameraRef = useRef({ x: 0, y: 0, scale: 1.0 });
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [selectedNode, setSelectedNode] = useState<BrainNodeItem | null>(null);

  // GSAP ContextSafe camera transform
  const { contextSafe } = useGSAP({ scope: viewportRef });

  const animateCamera = contextSafe((targetX: number, targetY: number, targetScale: number) => {
    if (!stageRef.current) return;

    cameraRef.current = { x: targetX, y: targetY, scale: targetScale };

    if (prefersReduced) {
      gsap.set(stageRef.current, {
        x: targetX,
        y: targetY,
        scale: targetScale,
        transformOrigin: '0 0',
      });
      return;
    }

    gsap.to(stageRef.current, {
      x: targetX,
      y: targetY,
      scale: targetScale,
      duration: motionSeconds.slow, // 0.4s
      ease: 'power2.out',
      overwrite: 'auto',
      transformOrigin: '0 0',
    });
  });

  // Center camera onto selected node
  const centerNode = useCallback(
    (node: BrainNodeItem, explicitZoom?: number) => {
      const nodeEl = nodeRefs.current[node.id];
      const viewportEl = viewportRef.current;
      const stageEl = stageRef.current;
      if (!nodeEl || !viewportEl || !stageEl) return;

      const scale = (explicitZoom ?? zoomLevel) / 100;
      const vW = viewportEl.clientWidth;
      const vH = viewportEl.clientHeight;
      const sW = stageEl.scrollWidth || stageEl.clientWidth;
      const sH = stageEl.scrollHeight || stageEl.clientHeight;

      const nodeX = nodeEl.offsetLeft + nodeEl.offsetWidth / 2;
      const nodeY = nodeEl.offsetTop + nodeEl.offsetHeight / 2;

      let targetX = vW / 2 - nodeX * scale;
      let targetY = vH / 2 - nodeY * scale;

      // Boundary soft-clamping
      const maxClampX = 24;
      const minClampX = Math.min(0, vW - sW * scale - 24);
      const maxClampY = 24;
      const minClampY = Math.min(0, vH - sH * scale - 24);

      targetX = Math.max(minClampX, Math.min(maxClampX, targetX));
      targetY = Math.max(minClampY, Math.min(maxClampY, targetY));

      animateCamera(targetX, targetY, scale);
    },
    [zoomLevel, animateCamera]
  );

  const handleNodeClick = (node: BrainNodeItem) => {
    setSelectedNode(node);
    onSelectConcept?.(node);
    centerNode(node);
  };

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(50, Math.min(150, newZoom));
    setZoomLevel(clampedZoom);

    if (selectedNode) {
      centerNode(selectedNode, clampedZoom);
    } else {
      // Zoom towards center of viewport
      const viewportEl = viewportRef.current;
      if (!viewportEl) return;
      const vW = viewportEl.clientWidth;
      const vH = viewportEl.clientHeight;
      const oldScale = cameraRef.current.scale;
      const newScale = clampedZoom / 100;

      const centerX = (vW / 2 - cameraRef.current.x) / oldScale;
      const centerY = (vH / 2 - cameraRef.current.y) / oldScale;

      const targetX = vW / 2 - centerX * newScale;
      const targetY = vH / 2 - centerY * newScale;

      animateCamera(targetX, targetY, newScale);
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    animateCamera(0, 0, 1.0);
  };

  // Render canvas
  return (
    <Card variant="default" padding="lg" className="space-y-4">
      {/* Zoom and Filter controls */}
      {/* ... */}

      {/* Viewport & Stage */}
      <div
        ref={viewportRef}
        className="relative w-full h-[460px] sm:h-[520px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] overflow-hidden"
      >
        <div
          ref={stageRef}
          className="absolute inset-0 p-6 flex flex-wrap content-start gap-3 will-change-transform"
          style={{ transformOrigin: '0 0' }}
        >
          {filteredNodes.map((node) => (
            <button
              key={node.id}
              ref={(el) => {
                nodeRefs.current[node.id] = el;
              }}
              type="button"
              onClick={() => handleNodeClick(node)}
              className="focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] rounded-xl"
            >
              <ConceptChip
                status={node.status}
                isDue={node.isDue}
                term={node.label}
                size="md"
                className={selectedNode?.id === node.id ? 'ring-2 ring-[var(--focus-ring)] shadow-md' : ''}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Detail Drawer ... */}
    </Card>
  );
}
```

---

### 3.2 `ConceptNode.tsx` Integration Blueprint

#### Architecture
1. **Scoped GSAP Lifecycle**:
   - `nodeRef = useRef<HTMLButtonElement>(null)`.
   - `useGSAP` scoped to `nodeRef` with dependencies `[status, isSelected]`.
2. **Pulse Choreography**:
   - Total duration: `200ms` (`motionSeconds.feedback` = 0.2s).
   - Step 1: `scale: 1.05` (duration: `0.1s`, `power1.out`).
   - Step 2: `scale: 1.0` (duration: `0.1s`, `power1.inOut`, `clearProps: 'transform'`).
   - Prevents duplicate pulse on initial mount using `prevStatusRef` and `prevSelectedRef`.
3. **Reduced Motion**:
   - If `prefersReduced` is true, immediately clears transform and applies static ring/border styles.

#### TypeScript Implementation Snippet
```tsx
'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '../../utils';
import { type ConceptStatus, conceptStateMetadata } from '../../tokens/semantic';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface ConceptNodeProps {
  id: string;
  label: string;
  cefr?: string;
  status: ConceptStatus;
  isDue?: boolean;
  stability?: number;
  difficulty?: number;
  isSelected?: boolean;
  isFaded?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

export const ConceptNode: React.FC<ConceptNodeProps> = ({
  id,
  label,
  cefr,
  status,
  isDue = false,
  stability,
  difficulty,
  isSelected = false,
  isFaded = false,
  size = 'md',
  onClick,
  className,
}) => {
  const nodeRef = useRef<HTMLButtonElement>(null);
  const prevStatusRef = useRef<ConceptStatus>(status);
  const prevSelectedRef = useRef<boolean>(isSelected);
  const prefersReduced = usePrefersReducedMotion();

  const meta = conceptStateMetadata[status] || conceptStateMetadata.unseen;
  const IconComponent = isDue ? Clock : (statusIcons[status] || EyeOff);

  useGSAP(
    () => {
      const statusChanged = prevStatusRef.current !== status;
      const selectionChanged = !prevSelectedRef.current && isSelected;

      prevStatusRef.current = status;
      prevSelectedRef.current = isSelected;

      // Skip unprompted initial mount pulse
      if (!statusChanged && !selectionChanged) return;

      if (prefersReduced) {
        gsap.set(nodeRef.current, { scale: 1, clearProps: 'transform' });
        return;
      }

      const tl = gsap.timeline({ overwrite: 'auto' });
      tl.to(nodeRef.current, {
        scale: 1.05,
        duration: 0.1,
        ease: 'power1.out',
      }).to(nodeRef.current, {
        scale: 1.0,
        duration: 0.1,
        ease: 'power1.inOut',
        clearProps: 'transform',
      });
    },
    { dependencies: [status, isSelected], scope: nodeRef }
  );

  return (
    <button
      ref={nodeRef}
      type="button"
      onClick={onClick}
      aria-label={`${label} (${meta.labelVi}${isDue ? ', đến hạn ôn' : ''})`}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex items-center font-medium border transition-colors select-none focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] will-change-transform',
        sizeStyles[size],
        borderStyleClass,
        roleStyles[isDue ? 'warning' : meta.colorRole] || roleStyles.neutral,
        isSelected && 'ring-2 ring-[var(--focus-ring)] shadow-md',
        isFaded && 'opacity-35 grayscale',
        className
      )}
    >
      <IconComponent className={cn(iconSizes[size], 'shrink-0')} aria-hidden="true" />
      <span className="font-semibold">{label}</span>
      {cefr && (
        <span className="text-[10px] font-mono opacity-80 uppercase px-1 py-0.5 rounded bg-[var(--surface-subtle)]">
          {cefr}
        </span>
      )}
    </button>
  );
};
```

---

### 3.3 `ProgressAnalytics.tsx` Integration Blueprint

#### Architecture
1. **Targeting & Timing**:
   - Scope ref: `containerRef = useRef<HTMLDivElement>(null)`.
   - Target selector: `.analytics-bar-fill`.
   - Duration: `0.25s` (250ms = `--motion-normal`), stagger: `0.05s` (50ms).
   - Transform: `scaleX: 0 -> 1` with `transformOrigin: 'left center'`.
2. **Immediate ARIA & DOM Text (Invariant 3 Compliance)**:
   - Screen readers and accessibility tree read `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` and static label text (`45 phút (28%)`) immediately from initial render.
   - The visual element has fixed CSS width (`style={{ width: '28%' }}`). GSAP applies `scaleX: 0 -> 1` on top of this composited width without manipulating or interpolating numbers.

#### TypeScript Implementation Snippet
```tsx
'use client';

import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { usePrefersReducedMotion, motionSeconds } from '@lingua/ui';
// ... other imports ...

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export function ProgressAnalytics({
  initialData = defaultProgressSummary,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
}: ProgressAnalyticsProps) {
  const [data] = useState<ProgressSummaryData>(initialData);
  const [currentState, setCurrentState] = useState(forcedState);
  const [timeWindow, setTimeWindow] = useState<'7d' | '30d'>('7d');
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = usePrefersReducedMotion();

  // Coordinated staggered entrance on mount & timeWindow toggle
  useGSAP(
    () => {
      if (currentState !== 'success') return;

      if (prefersReduced) {
        gsap.set('.analytics-bar-fill', { scaleX: 1, opacity: 1, clearProps: 'transform,opacity' });
        return;
      }

      gsap.fromTo(
        '.analytics-bar-fill',
        {
          scaleX: 0,
          opacity: 0.3,
        },
        {
          scaleX: 1,
          opacity: 1,
          duration: motionSeconds.normal, // 0.25s
          stagger: motionSeconds.staggerStep, // 0.05s
          ease: 'power2.out',
          transformOrigin: 'left center',
          overwrite: 'auto',
          clearProps: 'transform,opacity',
        }
      );
    },
    { dependencies: [timeWindow, currentState], scope: containerRef }
  );

  return (
    <div ref={containerRef} className="space-y-6 max-w-4xl">
      {/* Header & Time Window Switcher */}
      {/* Weekly Highlights */}
      {/* ADR-009 Stepper */}

      {/* Study Time Breakdown */}
      <Card variant="default" padding="lg" className="space-y-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--action-primary)]" />
          <span>
            Thời gian học theo hoạt động ({timeWindow === '7d' ? 'Tuần này: 160 phút' : '30 ngày: 640 phút'})
          </span>
        </h3>
        <div className="space-y-3">
          {[
            {
              id: 'fsrs',
              icon: RotateCcw,
              iconColor: 'text-[var(--status-warning)]',
              barVariant: 'bg-[var(--status-warning)]',
              title: 'Ôn tập thông minh (FSRS)',
              timeText: timeWindow === '7d' ? '45 phút (28%)' : '180 phút (28%)',
              percentage: 28,
            },
            {
              id: 'reader',
              icon: BookOpen,
              iconColor: 'text-[var(--action-primary)]',
              barVariant: 'bg-[var(--action-primary)]',
              title: 'Đọc hiểu ngữ cảnh (Reader)',
              timeText: timeWindow === '7d' ? '60 phút (38%)' : '245 phút (38%)',
              percentage: 38,
            },
            {
              id: 'listening',
              icon: Volume2,
              iconColor: 'text-[var(--status-info)]',
              barVariant: 'bg-[var(--status-info)]',
              title: 'Luyện nghe phản xạ câu',
              timeText: timeWindow === '7d' ? '30 phút (19%)' : '125 phút (19%)',
              percentage: 19,
            },
            {
              id: 'dict',
              icon: Search,
              iconColor: 'text-[var(--status-success)]',
              barVariant: 'bg-[var(--status-success)]',
              title: 'Khám phá từ mới & Tra từ điển',
              timeText: timeWindow === '7d' ? '25 phút (15%)' : '90 phút (15%)',
              percentage: 15,
            },
          ].map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4', activity.iconColor)} />
                    <span className="text-[var(--text-secondary)]">{activity.title}</span>
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">{activity.timeText}</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={activity.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${activity.title}: ${activity.timeText}`}
                  className="w-full h-2 bg-[var(--surface-subtle)] rounded-full overflow-hidden border border-[var(--border-subtle)]"
                >
                  <div
                    className={cn('analytics-bar-fill h-full rounded-full will-change-transform', activity.barVariant)}
                    style={{ width: `${activity.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
```

---

## 4. Caveats & Assumptions

1. **DOM Measurement in SSR**:
   - `offsetLeft`, `clientWidth`, and `scrollWidth` return `0` on the server. The `useGSAP` hook and `centerNode` calculations execute strictly on the client inside browser event loops.
2. **Virtual vs. Flex Canvas Layout**:
   - The current `LanguageBrainCanvas` uses a flex-wrapped grid for nodes. The coordinate calculation formula `offsetLeft + offsetWidth / 2` works identically on both flex layouts and absolute graph coordinate layouts.
3. **Reduced Motion Synchrony**:
   - `usePrefersReducedMotion` relies on `useSyncExternalStore`. In tests with simulated media queries, ensure `act(() => { ... })` wraps mock change events.

---

## 5. Conclusion & Recommendations

1. **`LanguageBrainCanvas.tsx`**: Replace naive CSS transform scaling with GSAP camera centering (`gsap.to` on `x, y, scale`) with bounded coordinates $[0.5, 1.5]$ and 400ms duration (`motionSeconds.slow`).
2. **`ConceptNode.tsx`**: Add `useGSAP` scoped pulse animation (200ms: 100ms rise to 1.05 + 100ms settle) on status upgrade or selection.
3. **`ProgressAnalytics.tsx`**: Add `useGSAP` scoped staggered entrance (250ms duration, 50ms stagger per bar) on mount and time window switch, with immediate ARIA and DOM text rendering.
4. **All Components**: Adhere strictly to Invariants 1, 2, 3 and `prefers-reduced-motion` instantaneous fallbacks (`duration: 0`).

---

## 6. Verification Method

To independently verify after implementation:

```bash
# 1. Type check
pnpm typecheck

# 2. Lint check
pnpm lint

# 3. Frontend unit and adversarial motion tests
pnpm test tests/frontend/challenger.motion-reduced.adversarial.test.tsx
pnpm test tests/frontend/e2e/f08-language-brain.test.tsx
pnpm test tests/frontend/e2e/f09-progress-level.test.tsx
pnpm test

# 4. Storybook build verification
pnpm build-storybook
```

### Invalidation Conditions
- Any tween animating `width`, `height`, `top`, `left`, `margin`, or `padding` directly with GSAP.
- Any artificial delay or ticker count-up on `ProgressAnalytics` numbers or ARIA attributes.
- Failure to revert tweens or detach event handlers on unmount.
- Any non-zero animation duration when `(prefers-reduced-motion: reduce)` is active.
