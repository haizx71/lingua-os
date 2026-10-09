# LINGUA OS — Master Design System

Version: 1.0
Status: APPROVED GLOBAL SPECIFICATION
Consumer: Frontend Web (`apps/web`), UI Package (`packages/ui`), Mobile Web

### Owner-approved presentation update — 2026-10-09

The owner selected Reader option 3 and approved applying it to the existing app. The active presentation work uses a pale lavender canvas, white surfaces, indigo actions, restrained elevation, compact persistent navigation and serif English reading text. It preserves the semantic state distinctions, accessibility and multilingual rules below. This supersedes earlier warm blue/teal visual treatments for the scoped implementation; it changes no learner metric or learning rule. Exact source reference and release gates are recorded in [the full web plan](../plans/PILOT-FULL-WEB-DESIGN.md).

---

## 1. Visual Direction & Design Rationale

LINGUA OS is a calm, focused, modern, and premium adaptive learning workspace designed for Vietnamese learners studying English (A0–B1). 

- **Calm & Focused**: Eliminates visual noise, excessive gamification (no confetti, gems, countdown anxiety, or casino reward loops). Every visual element serves learning intent.
- **Evidence-First**: Visualizes retention, memory strength, and known concept evidence rather than arbitrary points or vanity streaks.
- **Explainable Adaptation**: Clearly presents adaptive reasons for recommendations (e.g., *"Ôn vì sắp quên"*, *"Luyện nghe vì đang yếu"*).
- **Multilingual-First**: Native support for Vietnamese diacritics with generous line-height and scalable typography compatible with future CJK expansions.
- **Accessible by Default (WCAG 2.2 AA)**: Distinctive shapes, labels, and icons accompany color so learning states are never conveyed by color alone.

---

## 2. 3-Tier Token Architecture

Tokens follow the DTCG 2025.10 standard layered across three levels:

```
[ Primitive Tokens ]  -->  [ Semantic Tokens ]  -->  [ Component Tokens ]
(Raw scales & values)      (Design intent/roles)      (Scoped component styles)
```

**Rule**: Application screens and page components MUST consume Semantic and Component tokens. Never use raw primitive values directly in page layouts.

---

## 3. Token Specifications

### 3.1 Color Palette & Semantic Roles

#### Primitive Palette
- **Slate (Neutral Base)**:
  - `slate-50`: `#F8FAFC` | `slate-100`: `#F1F5F9` | `slate-200`: `#E2E8F0`
  - `slate-300`: `#CBD5E1` | `slate-400`: `#94A3B8` | `slate-500`: `#64748B`
  - `slate-600`: `#475569` | `slate-700`: `#334155` | `slate-800`: `#1E293B`
  - `slate-900`: `#0F172A` | `slate-950`: `#020617`
- **Indigo / Sapphire (Primary Accent)**:
  - `primary-50`: `#EEF2FF` | `primary-100`: `#E0E7FF` | `primary-200`: `#C7D2FE`
  - `primary-500`: `#6366F1` | `primary-600`: `#4F46E5` | `primary-700`: `#4338CA`
- **Emerald (Success / Mastered / Known)**:
  - `emerald-50`: `#ECFDF5` | `emerald-100`: `#D1FAE5` | `emerald-500`: `#10B981` | `emerald-600`: `#059669` | `emerald-700`: `#047857`
- **Amber (Warning / Weak / Needs Attention)**:
  - `amber-50`: `#FFFBEB` | `amber-100`: `#FEF3C7` | `amber-500`: `#F59E0B` | `amber-600`: `#D97706` | `amber-700`: `#B45309`
- **Rose (Danger / Critical / Forgotten)**:
  - `rose-50`: `#FFF1F2` | `rose-100`: `#FFE4E6` | `rose-500`: `#F43F5E` | `rose-600`: `#E11D48` | `rose-700`: `#BE123C`
- **Sky (Learning / In Progress)**:
  - `sky-50`: `#F0F9FF` | `sky-100`: `#E0F2FE` | `sky-500`: `#0EA5E9` | `sky-600`: `#0284C7`

#### Semantic Color Tokens (Light & Dark)

| Semantic Token | Light Mode Value | Dark Mode Value | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--color-canvas` | `slate-50` (`#F8FAFC`) | `slate-950` (`#020617`) | Global page background |
| `--color-surface` | `#FFFFFF` | `slate-900` (`#0F172A`) | Card and panel container |
| `--color-surface-subtle` | `slate-100` (`#F1F5F9`) | `slate-800` (`#1E293B`) | Secondary backgrounds, table rows |
| `--color-surface-elevated` | `#FFFFFF` | `slate-800` (`#1E293B`) | Modals, dropdowns, popovers |
| `--color-text-primary` | `slate-900` (`#0F172A`) | `slate-100` (`#F1F5F9`) | High-contrast headings and body |
| `--color-text-secondary` | `slate-600` (`#475569`) | `slate-400` (`#94A3B8`) | Subtext, metadata, secondary labels |
| `--color-text-muted` | `slate-400` (`#94A3B8`) | `slate-500` (`#64748B`) | Timestamps, disabled hints |
| `--color-border-subtle` | `slate-200` (`#E2E8F0`) | `slate-800` (`#1E293B`) | Subtle dividers and card outlines |
| `--color-border-default` | `slate-300` (`#CBD5E1`) | `slate-700` (`#334155`) | Standard component borders |
| `--color-border-strong` | `slate-400` (`#94A3B8`) | `slate-600` (`#475569`) | Emphasized borders |
| `--color-action-primary` | `primary-600` (`#4F46E5`) | `primary-500` (`#6366F1`) | Primary CTAs, key interactive buttons |
| `--color-action-primary-hover`| `primary-700` (`#4338CA`) | `primary-600` (`#4F46E5`) | Primary hover state |
| `--color-action-primary-text` | `#FFFFFF` | `#FFFFFF` | Text inside primary buttons |
| `--color-focus-ring` | `primary-500` (`#6366F1`) | `primary-400` (`#818CF8`) | Keyboard focus indicators |
| `--color-status-success` | `emerald-600` (`#059669`) | `emerald-500` (`#10B981`) | Correct answer, positive milestone |
| `--color-status-warning` | `amber-600` (`#D97706`) | `amber-500` (`#F59E0B`) | Review urgency, weak concept warning |
| `--color-status-danger` | `rose-600` (`#E11D48`) | `rose-500` (`#F43F5E`) | Critical error, forgotten concept |
| `--color-status-info` | `sky-600` (`#0284C7`) | `sky-500` (`#0EA5E9`) | Informational tips, learning state |

---

### 3.2 Typography Scale

Designed with generous line-heights for Vietnamese tone markers and future multilingual glyphs.

| Style Token | Font Size (Desktop) | Font Size (Mobile) | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `type-display` | `36px` (`2.25rem`) | `30px` (`1.875rem`) | `1.25` | 700 (Bold) | Onboarding hero, milestone highlights |
| `type-h1` | `28px` (`1.75rem`) | `24px` (`1.5rem`) | `1.3` | 700 (Bold) | Page titles (`Today`, `Review`, `Brain`) |
| `type-h2` | `22px` (`1.375rem`) | `20px` (`1.25rem`) | `1.35` | 600 (Semibold)| Section headers, card titles |
| `type-h3` | `18px` (`1.125rem`) | `17px` (`1.0625rem`)| `1.4` | 600 (Semibold)| Modal headers, group titles |
| `type-body` | `16px` (`1rem`) | `15px` (`0.9375rem`)| `1.6` | 400 (Regular) | Primary content, passage text |
| `type-body-sm` | `14px` (`0.875rem`) | `13px` (`0.8125rem`)| `1.5` | 400 (Regular) | Secondary descriptions, captions |
| `type-learning` | `20px` (`1.25rem`) | `18px` (`1.125rem`)| `1.6` | 500 (Medium) | Target study sentences in Reader/Review |
| `type-label` | `13px` (`0.8125rem`)| `12px` (`0.75rem`) | `1.4` | 600 (Semibold)| Button labels, badging, metadata |
| `type-data` | `14px` (`0.875rem`) | `13px` (`0.8125rem`)| `1.4` | 600 (Semibold)| Metrics, percentages, counters |

---

### 3.3 Spacing & Layout Scales (4px Grid)

- `space-1`: `4px` (0.25rem)
- `space-2`: `8px` (0.5rem)
- `space-3`: `12px` (0.75rem)
- `space-4`: `16px` (1rem)
- `space-5`: `20px` (1.25rem)
- `space-6`: `24px` (1.5rem)
- `space-8`: `32px` (2rem)
- `space-10`: `40px` (2.5rem)
- `space-12`: `48px` (3rem)
- `space-16`: `64px` (4rem)

#### Touch & Viewport Bounds
- **Minimum Touch Target**: `44px × 44px` (primary actions use `48px`).
- **Reading Passage Width**: Max `720px` for optimal reading comprehension.
- **Dashboard Max Width**: `1280px`.

---

### 3.4 Radius & Elevation

#### Radii
- `radius-sm`: `6px` (chips, badges, compact inputs)
- `radius-md`: `10px` (standard buttons, text fields)
- `radius-lg`: `16px` (cards, containers, modals)
- `radius-xl`: `24px` (highlight cards, bottom sheet top corners)
- `radius-full`: `9999px` (pills, circular icon buttons)

#### Elevation & Shadows
- Minimal, clean hierarchy relying first on border contrast and background layering:
  - `shadow-subtle`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
  - `shadow-card`: `0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)`
  - `shadow-popover`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`
  - `shadow-modal`: `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`

---

### 3.5 Motion Tokens

- `duration-fast`: `150ms` (hover, button click, focus states)
- `duration-base`: `250ms` (fade in, card expand, dialog open)
- `duration-slow`: `400ms` (page transition, bottom sheet slide)
- `ease-standard`: `cubic-bezier(0.2, 0.0, 0, 1.0)`
- **Accessibility Invariant**: When `prefers-reduced-motion: reduce` is active, all transitions collapse to instant (`0ms`) or opacity-only fade.

---

## 4. Learning State Representation Matrix (Non-Color Invariant)

Learning states must **never** rely solely on color to convey meaning. Every state pairs color with a distinct icon, status label, and semantic role:

| Concept State (`concept_status`) | Semantic Color Role | Accompanying Icon | Text Label (VI) | Shape / Border Styling |
| :--- | :--- | :--- | :--- | :--- |
| `unseen` | Slate subtle | `EyeOff` / Dot outline | Chưa gặp | Dashed border |
| `discovered` | Slate / Indigo subtle | `Sparkles` | Mới phát hiện | Solid thin border |
| `learning` | Sky (Info) | `BookOpen` | Đang học | Solid pill, soft fill |
| `familiar` | Sky / Emerald subtle | `Check` | Quen thuộc | Solid pill, medium fill |
| `active` | Indigo (Primary) | `Zap` | Đang luyện | Accent border + pill |
| `mastered` | Emerald (Success) | `Award` / CheckCircle | Đã nắm vững | Solid emerald badge |
| `weak` | Amber (Warning) | `AlertTriangle` | Cần củng cố | Warning badge + icon |
| `forgotten` | Rose (Danger) | `RotateCcw` | Đã quên | Danger badge + icon |
| `due` | Primary / Amber badge | `Clock` | Đến hạn ôn | Priority indicator + count |

---

## 5. Responsive Application Shell Architecture

### Viewport Layouts

1. **Mobile (`< 768px`)**:
   - Fixed Bottom Navigation Bar with 5 primary MVP routes:
     - 🏠 **Today** (`/today`)
     - 📖 **Read** (`/read`)
     - 🔄 **Review** (`/review`)
     - 🧠 **Brain** (`/brain`)
     - 📈 **Progress** (`/progress`)
   - Header with quick profile / settings access.
   - Touch targets ≥ 44px, safe area insets respected (`pb-safe`).

2. **Tablet (`768px – 1199px`)**:
   - Collapsible left rail with icon + label tooltips.
   - Secondary links docked at bottom of rail.

3. **Desktop (`≥ 1200px`)**:
   - Fixed Left Sidebar (260px width) containing:
     - App Brand & Logo
     - Primary Navigation items (Today, Read, Review, Brain, Progress)
     - Secondary Navigation group (Library, Dictionary, Settings)
     - User Profile & Learning Day Summary card
   - Central content area (max width 1080px, reading column max 720px).
   - Optional Right Context Rail for active learning targets or concept definitions.

4. **Focus Mode (Learning / Review Sessions)**:
   - Hides sidebars and bottom navigation.
   - Preserves exit confirmation, minimal progress bar, and active card.

---

## 6. Global UI State Primitives

Every data-driven screen in LINGUA OS must implement these 4 standard state primitives:

1. **Loading State (`<Skeleton />` / `<LoadingState />`)**:
   - Matches final layout dimensions to prevent Cumulative Layout Shift (CLS).
   - Subtle pulse animation (disabled under reduced motion).
2. **Empty State (`<EmptyState />`)**:
   - Calm illustration / icon.
   - Human-readable explanation of why the view is empty.
   - Clear primary next action button (e.g. *"Bắt đầu đọc bài đầu tiên"*).
3. **Error State (`<ErrorState />` / `<InlineAlert />`)**:
   - Maps server error codes (`UNAUTHENTICATED`, `NOT_FOUND`, `VALIDATION_ERROR`, `NETWORK_ERROR`).
   - Actionable retry button maintaining existing user context without losing unsaved input.
4. **Success State**:
   - Non-intrusive confirmation (e.g., *"Đã lưu vào bộ nhớ"*, *"Đã cập nhật Language Brain"*).

---

## 7. Forbidden Patterns (Strict Guardrails)

- ❌ **No Magic Values**: Never use arbitrary hex colors (e.g. `#43a047`) or arbitrary pixel margins (e.g. `margin: 17px`) in components.
- ❌ **No Arcade Gamification**: No spinning wheels, flashing gems, countdown panic timers, or aggressive streak loss warnings.
- ❌ **No Color-Only Statuses**: Never render a colored circle without accessible text label / icon.
- ❌ **No Post-MVP Dead Routes**: Do not place disabled "AI Tutor" or "Speak Lab" links in primary navigation.
- ❌ **No Desktop-Squashing**: Mobile must be an ergonomic single-column layout, not a miniaturized desktop view.
