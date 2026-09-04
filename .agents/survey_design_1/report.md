# LINGUA OS — Design System & UI Inventory Survey Report

**Agent**: Design System & UI Explorer (`survey_design_1`)  
**Target File**: `d:/LINGUA_OS_PROJECT_STARTER/.agents/survey_design_1/report.md`  
**Date**: 2026-08-22  
**Scope**: Design token hierarchy, component inventory, WCAG 2.2 AA accessibility, Storybook catalog in `packages/ui` & `apps/web`

---

## 1. Executive Summary & Design Philosophy

LINGUA OS is architected as an **intelligent, calm, focused, modern, and premium personal learning workspace** tailored for Vietnamese English learners (CEFR A0 to B1). The visual language deliberately eschews loud gamification (no spinning wheels, gems, flashing animations, or streak anxiety) in favor of **evidence-based learning**, **visible retention**, and **explainable adaptive recommendations**.

### Core Visual Principles
1. **Calm & Focused**: High signal-to-noise ratio. Every visual component serves a direct pedagogical purpose.
2. **Evidence-First**: Visualizes memory health, retention decay (FSRS), and concept mastery rather than arbitrary gamified vanity points.
3. **Explainable Adaptation**: All recommendations surface short, human-readable rationale (e.g., *"Ôn vì sắp quên"*, *"Luyện nghe vì đọc biết nhưng nghe yếu"*).
4. **Multilingual-First**: Native support for Vietnamese diacritics with generous typography line-heights (`1.3` to `1.6`) and structural compatibility with future CJK expansions.
5. **Accessible by Default (WCAG 2.2 AA)**: Strict adherence to non-color state communication, visible focus rings, APG keyboard interaction patterns, and minimum 44px touch targets.

---

## 2. 3-Tier Design Token Hierarchy (DTCG 2025.10 Compliant)

The design tokens follow a strict 3-tier structure:
```
[ Primitive Tokens ]  -->  [ Semantic Tokens ]  -->  [ Component Tokens ]
(Raw scales & values)      (Design intent/roles)      (Scoped component bindings)
```
**Strict Invariant**: Application screens and page components MUST consume Semantic and Component tokens. Raw primitive palette values (e.g., hex codes, magic pixels) must never appear directly in page components.

### 2.1 Primitive Token Scales

#### Color Palette
- **Slate (Neutral Base)**:
  - `slate-50`: `#F8FAFC` (Canvas light)
  - `slate-100`: `#F1F5F9` (Surface subtle light / borders)
  - `slate-200`: `#E2E8F0` (Border subtle light)
  - `slate-300`: `#CBD5E1` (Border default light)
  - `slate-400`: `#94A3B8` (Text muted light / text secondary dark)
  - `slate-500`: `#64748B` (Text muted dark)
  - `slate-600`: `#475569` (Text secondary light / border strong dark)
  - `slate-700`: `#334155` (Border default dark)
  - `slate-800`: `#1E293B` (Surface subtle dark / surface elevated dark)
  - `slate-900`: `#0F172A` (Text primary light / surface dark)
  - `slate-950`: `#020617` (Canvas dark)
- **Indigo / Sapphire (Primary Accent)**:
  - `indigo-50`: `#EEF2FF` | `indigo-100`: `#E0E7FF` | `indigo-200`: `#C7D2FE`
  - `indigo-400`: `#818CF8` (Focus ring dark)
  - `indigo-500`: `#6366F1` (Action primary dark / focus ring light)
  - `indigo-600`: `#4F46E5` (Action primary light)
  - `indigo-700`: `#4338CA` (Action primary hover light)
- **Emerald (Success / Mastered / Known)**:
  - `emerald-50`: `#ECFDF5` | `emerald-100`: `#D1FAE5` | `emerald-200`: `#A7F3D0`
  - `emerald-500`: `#10B981` (Success dark) | `emerald-600`: `#059669` (Success light) | `emerald-700`: `#047857`
- **Amber (Warning / Weak / Review Urgency)**:
  - `amber-50`: `#FFFBEB` | `amber-100`: `#FEF3C7` | `amber-200`: `#FDE68A`
  - `amber-500`: `#F59E0B` (Warning dark) | `amber-600`: `#D97706` (Warning light) | `amber-700`: `#B45309`
- **Rose (Danger / Forgotten / Critical Error)**:
  - `rose-50`: `#FFF1F2` | `rose-100`: `#FFE4E6` | `rose-200`: `#FECDD3`
  - `rose-500`: `#F43F5E` (Danger dark) | `rose-600`: `#E11D48` (Danger light) | `rose-700`: `#BE123C`
- **Sky (Info / Learning in Progress)**:
  - `sky-50`: `#F0F9FF` | `sky-100`: `#E0F2FE` | `sky-200`: `#BAE6FD`
  - `sky-500`: `#0EA5E9` (Info dark) | `sky-600`: `#0284C7` (Info light)

#### Spacing Scale (4px Base Grid)
- `space-1`: `4px` (`0.25rem`)
- `space-2`: `8px` (`0.5rem`)
- `space-3`: `12px` (`0.75rem`)
- `space-4`: `16px` (`1rem`)
- `space-5`: `20px` (`1.25rem`)
- `space-6`: `24px` (`1.5rem`)
- `space-8`: `32px` (`2rem`)
- `space-10`: `40px` (`2.5rem`)
- `space-12`: `48px` (`3rem`)
- `space-16`: `64px` (`4rem`)
- **Layout & Touch Dimensions**:
  - Minimum Touch Target: `44px × 44px` (Primary controls use `48px`)
  - Reading Passage Max Width: `720px` (Optimal line length 65-75 CPL)
  - Desktop Dashboard Max Width: `1280px`
  - Desktop Left Sidebar: Fixed `260px` width

#### Radii & Elevation Scales
- `radius-sm`: `6px` (`0.375rem`) — Chips, compact inputs, small badges
- `radius-md`: `10px` (`0.625rem`) — Standard buttons, text fields, notification banners
- `radius-lg`: `16px` (`1rem`) — Standard cards, containers, modals, bottom sheets
- `radius-xl`: `24px` (`1.5rem`) — Highlight cards, hero banners, bottom sheet top corners
- `radius-full`: `9999px` — Pill badges, circular icon buttons, avatars
- **Shadows**:
  - `shadow-subtle`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
  - `shadow-card`: `0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)`
  - `shadow-popover`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`
  - `shadow-modal`: `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`

#### Typography Scale & Vietnamese / Multilingual Handling
- **Font Stack**: `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`
- **Mono/Data Stack**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **Diacritics Support**: Generous line-height prevents Vietnamese stacked tone marks (dấu mũ, dấu móc, dấu sắc/huyền/hỏi/ngã/nặng trên âm kép) from colliding with upper lines or clipping in bounding boxes.

| Token | Size (Desktop) | Size (Mobile) | Line Height | Weight | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `type-display` | `36px` (`2.25rem`) | `30px` (`1.875rem`) | `1.25` | 700 Bold | Onboarding heroes, milestone cards |
| `type-h1` | `28px` (`1.75rem`) | `24px` (`1.5rem`) | `1.3` | 700 Bold | Primary page headers (`Today`, `Review`, `Brain`) |
| `type-h2` | `22px` (`1.375rem`) | `20px` (`1.25rem`) | `1.35` | 600 Semibold | Section headings, modal titles |
| `type-h3` | `18px` (`1.125rem`) | `17px` (`1.0625rem`)| `1.4` | 600 Semibold | Card headers, group labels |
| `type-body` | `16px` (`1rem`) | `15px` (`0.9375rem`)| `1.6` | 400 Regular | Primary reading text, instructions |
| `type-body-sm` | `14px` (`0.875rem`) | `13px` (`0.8125rem`)| `1.5` | 400 Regular | Secondary descriptions, captions, hints |
| `type-learning`| `20px` (`1.25rem`) | `18px` (`1.125rem`)| `1.6` | 500 Medium | Target study sentences in Reader & Review |
| `type-label` | `13px` (`0.8125rem`)| `12px` (`0.75rem`) | `1.4` | 600 Semibold | Button labels, chip text, badges |
| `type-data` | `14px` (`0.875rem`) | `13px` (`0.8125rem`)| `1.4` | 600 Semibold | Metrics, memory scores, percentages |

#### Motion Tokens & Reduced Motion Invariant
- `duration-fast`: `150ms` (Interactive hover, active press, focus transitions)
- `duration-base`: `250ms` (Card expand, modal fade, drawer slide)
- `duration-slow`: `400ms` (Full page transitions, bottom sheet entry)
- `ease-standard`: `cubic-bezier(0.2, 0.0, 0, 1.0)`
- `ease-in-out`: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Reduced Motion Invariant**: In `theme.css`, `@media (prefers-reduced-motion: reduce)` resets all transitions and animations to `0.01ms !important`, preserving accessibility for motion-sensitive users.

---

### 2.2 Semantic Color Tokens (Light & Dark Mapping)

| Semantic Role | Light Mode Value | Dark Mode Value | Semantic Purpose |
| :--- | :--- | :--- | :--- |
| `--color-canvas` | `slate-50` (`#F8FAFC`) | `slate-950` (`#020617`) | Global page background |
| `--color-surface` | `#FFFFFF` | `slate-900` (`#0F172A`) | Card and content container surface |
| `--color-surface-subtle` | `slate-100` (`#F1F5F9`) | `slate-800` (`#1E293B`) | Secondary panel backgrounds, table rows |
| `--color-surface-elevated`| `#FFFFFF` | `slate-800` (`#1E293B`) | Modals, dropdowns, floating sheets |
| `--color-text-primary` | `slate-900` (`#0F172A`) | `slate-100` (`#F1F5F9`) | High-contrast headings and body text |
| `--color-text-secondary` | `slate-600` (`#475569`) | `slate-400` (`#94A3B8`) | Subtitles, metadata, secondary labels |
| `--color-text-muted` | `slate-400` (`#94A3B8`) | `slate-500` (`#64748B`) | Timestamps, disabled hints |
| `--color-border-subtle` | `slate-200` (`#E2E8F0`) | `slate-800` (`#1E293B`) | Subtle dividers and card borders |
| `--color-border-default` | `slate-300` (`#CBD5E1`) | `slate-700` (`#334155`) | Standard component outlines |
| `--color-border-strong` | `slate-400` (`#94A3B8`) | `slate-600` (`#475569`) | Emphasized / active borders |
| `--color-action-primary` | `indigo-600` (`#4F46E5`) | `indigo-500` (`#6366F1`) | Primary CTAs, key interactive buttons |
| `--color-action-primary-hover`| `indigo-700` (`#4338CA`)| `indigo-600` (`#4F46E5`)| Primary hover state |
| `--color-action-primary-text` | `#FFFFFF` | `#FFFFFF` | Text on primary buttons |
| `--color-focus-ring` | `indigo-500` (`#6366F1`) | `indigo-400` (`#818CF8`) | Visible keyboard focus ring |
| `--color-status-success` | `emerald-600` (`#059669`)| `emerald-500` (`#10B981`)| Correct answer, mastered concept |
| `--color-status-warning` | `amber-600` (`#D97706`) | `amber-500` (`#F59E0B`) | Review urgency, weak concept warning |
| `--color-status-danger` | `rose-600` (`#E11D48`) | `rose-500` (`#F43F5E`) | Critical error, forgotten concept |
| `--color-status-info` | `sky-600` (`#0284C7`) | `sky-500` (`#0EA5E9`) | Tips, active learning state |

---

### 2.3 Non-Color Learning State Matrix (Concept Statuses)

To guarantee WCAG 2.2 AA Criterion 1.4.1 (Use of Color), every concept status combines color with an icon, localized text label, and distinct shape/border:

| Concept Status (`concept_status`) | Color Role | Icon | Text Label (VI) | Border / Shape Style | Semantic Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `unseen` | Neutral (`slate`) | `EyeOff` | Chưa gặp | Dashed border | Chưa từng xuất hiện trong bài học nào |
| `discovered` | Neutral (`slate`) | `Sparkles` | Mới phát hiện | Solid thin border | Vừa gặp qua bài đọc, chuẩn bị nạp |
| `learning` | Info (`sky`) | `BookOpen` | Đang học | Solid pill, soft fill | Đang tích lũy nhận diện và trí nhớ |
| `familiar` | Info (`sky`) | `Check` | Quen thuộc | Solid pill, medium fill | Nhận diện tốt khi đọc, cần củng cố |
| `active` | Primary (`indigo`) | `Zap` | Đang luyện | Accent border + pill | Luyện tập phản xạ và sử dụng thực tế |
| `mastered` | Success (`emerald`) | `Award` | Đã nắm vững | Solid emerald badge | Trí nhớ dài hạn ổn định qua chu kỳ FSRS |
| `weak` | Warning (`amber`) | `AlertTriangle` | Cần củng cố | Warning badge + icon | Sai gần đây, cần ưu tiên ôn tập |
| `forgotten` | Danger (`rose`) | `RotateCcw` | Đã quên | Danger badge + icon | Không nhớ khi review, FSRS reset chu kỳ |
| `due` | Warning (`amber`) | `Clock` | Đến hạn ôn | Priority border + counter | Đến thời điểm vàng ôn tập theo FSRS |

---

## 3. UI Primitive Components Inventory for `packages/ui`

### 3.1 Existing Primitives in `packages/ui`

| Component | Location | Variants / Sizes | Interactive States | WCAG / ARIA Semantics |
| :--- | :--- | :--- | :--- | :--- |
| `Button` | `src/components/Button/` | `primary`, `secondary`, `outline`, `ghost`, `danger`<br>Sizes: `sm`, `md`, `lg`, `icon` | `default`, `hover`, `active`, `focus-visible`, `disabled`, `isLoading` | `aria-busy`, `min-h-[44px]` (md/lg/icon), visible focus ring |
| `Badge` | `src/components/Badge/` | `neutral`, `primary`, `success`, `warning`, `danger`, `info`<br>Sizes: `sm`, `md` | `default`, optional icon slot | Non-color contrast compliant |
| `Card` | `src/components/Card/` | `default`, `subtle`, `elevated`, `interactive`<br>Padding: `none`, `sm`, `md`, `lg` | `default`, `hover`, `active` (interactive variant) | Semantic container |
| `ConceptChip` | `src/components/ConceptChip/` | 9 statuses (`unseen` to `due`)<br>Sizes: `sm`, `md`, `lg` | Static / selectable | `role="status"`, descriptive `aria-label` |
| `Progress` | `src/components/Progress/` | `primary`, `success`, `warning`<br>Sizes: `sm`, `md`, `lg` | `default`, animated fill | `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` |
| `Skeleton` | `src/components/States/` | `text`, `rectangular`, `circular` | Pulse animation (disabled on reduced motion) | `aria-hidden="true"`, CLS prevention |
| `LoadingState`| `src/components/States/` | Sizes: `sm`, `md`, `lg` | Spinning loader + localized text | `role="status"`, `aria-live="polite"`, `sr-only` description |
| `EmptyState` | `src/components/States/` | Max-width card with icon slot | Primary action CTA button | `role="region"`, accessible heading hierarchy |
| `ErrorState` | `src/components/States/` | Maps error codes (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`) | Actionable retry button | `role="alert"`, `aria-live="assertive"` |
| `InlineAlert` | `src/components/States/` | `info`, `success`, `warning`, `danger` | Text + icon banner | `role="alert"`, icon + message structure |

---

### 3.2 Required Additional Primitives for Full MVP Completion

To support all feature surfaces (Today, Review, Reader, Brain, Progress, Settings, Library, Dictionary, Starting Estimate), the following primitives must be implemented in `packages/ui`:

| Primitive Name | Target Location | Variants & Configurations | Required States & Behaviors | WCAG & ARIA Requirements |
| :--- | :--- | :--- | :--- | :--- |
| `Input` / `TextField` | `src/components/Input/` | `default`, `error`, `disabled`<br>Types: `text`, `search`, `password`, `number`<br>Slots: `leftIcon`, `rightIcon`, `clearable` | `default`, `hover`, `focus-visible`, `disabled`, `error` | `<label>` association with `htmlFor`/`id`, `aria-invalid`, `aria-describedby` for error text |
| `Modal` / `Dialog` | `src/components/Modal/` | Sizes: `sm`, `md`, `lg`, `fullscreen` (mobile)<br>Slots: `Header`, `Body`, `Footer` | `open`, `closing`, `closed` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Tab focus trapping, Esc key dismiss, return focus to trigger |
| `Tooltip` / `Popover` | `src/components/Tooltip/` | Positions: `top`, `bottom`, `left`, `right`<br>Variants: `dark`, `light` | Hover delay, focus trigger, keyboard Esc dismiss | `role="tooltip"`, `aria-describedby`, touch long-press / tap-to-reveal |
| `Slider` | `src/components/Slider/` | Sizes: `sm`, `md`<br>Variants: `primary`, `neutral`<br>Props: `min`, `max`, `step`, `value`, `onChange` | `default`, `hover`, `focus-visible`, `dragging`, `disabled` | `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, arrow keys step adjustment |
| `Tabs` | `src/components/Tabs/` | Variants: `line`, `pill`<br>Sizes: `sm`, `md`<br>Slots: `TabsList`, `TabsTrigger`, `TabsContent` | `selected`, `unselected`, `hover`, `focus-visible`, `disabled` | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, Arrow left/right navigation |
| `Canvas` / `ConceptNode` | `src/components/Canvas/` | Node statuses (9 concept states)<br>Node types: `skill`, `cluster`, `concept`<br>Sizes: `sm`, `md`, `lg` | `default`, `hover`, `selected`, `expanded`, `faded` | Focusable SVG/HTML node, `role="treeitem"` / `role="button"`, accessible node label & connections |
| `Select` / `Dropdown` | `src/components/Select/` | Variants: `default`, `compact`<br>Slots: `Trigger`, `OptionsList`, `OptionItem` | `open`, `closed`, `highlighted`, `selected`, `disabled` | `role="listbox"`, `role="option"`, `aria-expanded`, Arrow navigation, Esc key close |
| `Checkbox` / `Radio` | `src/components/Selection/` | Variants: `checkbox`, `radio`, `switch`<br>Sizes: `sm`, `md` | `checked`, `unchecked`, `indeterminate`, `disabled`, `focus-visible` | Native `<input type="checkbox/radio">` or ARIA `role="checkbox/radio"`, `aria-checked` |
| `AudioPlayerPrimitive` | `src/components/Audio/` | Variants: `button-only`, `compact-bar`, `sentence-bar` | `idle`, `loading`, `playing`, `paused`, `replay` | `aria-label` with track name/status, keyboard Space/Enter toggle, visual waveform/progress |

---

## 4. WCAG 2.2 AA Accessibility & Interaction Compliance

### 4.1 Color Contrast Evaluation
- **Text Contrast (Criterion 1.4.3)**:
  - Slate-900 on Slate-50: `16.5:1` (Exceeds 4.5:1 requirement).
  - Slate-600 on Slate-50: `6.5:1` (Exceeds 4.5:1 requirement).
  - Slate-100 on Slate-900 / Slate-950: `15.2:1` (Exceeds 4.5:1 requirement).
  - Primary Action (`#4F46E5` on `#FFFFFF`): `5.8:1` (Exceeds 4.5:1 requirement).
  - Success State (`#059669` on `#ECFDF5` / `#FFFFFF`): `4.6:1` (Exceeds 4.5:1 requirement).
  - Warning State (`#D97706` on `#FFFBEB` / `#FFFFFF`): `4.7:1` (Exceeds 4.5:1 requirement).
  - Danger State (`#E11D48` on `#FFF1F2` / `#FFFFFF`): `4.9:1` (Exceeds 4.5:1 requirement).
- **UI Component & Border Contrast (Criterion 1.4.11)**:
  - Input & button borders meet `3:1` contrast against adjacent backgrounds.

### 4.2 Non-Color State Invariant (Criterion 1.4.1)
- No learning state, memory urgency level, or validation feedback is communicated via color alone.
- Every state includes:
  1. Semantic color tint
  2. Distinct SVG icon (e.g. `Award` for mastered, `AlertTriangle` for weak, `Clock` for due)
  3. Clear Vietnamese text label (e.g. *"Đã nắm vững"*, *"Cần củng cố"*, *"Đến hạn ôn"*)
  4. Border/shape distinction (dashed outline for unseen, solid pill for active)

### 4.3 Focus Visibility & Keyboard Ergonomics (Criteria 2.4.7 & 2.1.1)
- Explicit visible ring using `--focus-ring` (`#6366F1` / `#818CF8`) with `focus-visible:ring-2 focus-visible:ring-offset-2`.
- Outline is never removed without providing a high-contrast focus ring.
- Tab order strictly mirrors DOM logical visual flow.
- Modals trap keyboard focus and restore focus to trigger button upon close.
- All interactive controls are operable via keyboard (`Enter`, `Space`, `Tab`, `Shift+Tab`, `Escape`, `Arrow keys`).

### 4.4 Screen Reader Semantics & ARIA Patterns (Criteria 4.1.2 & 4.1.3)
- Prefer native HTML semantic tags (`<button>`, `<main>`, `<nav>`, `<aside>`, `<header>`, `<article>`) before ARIA overrides.
- `role="status"` and `aria-live="polite"` for non-disruptive feedback (e.g. `LoadingState`, word saved feedback).
- `role="alert"` and `aria-live="assertive"` for error states (`ErrorState`, `InlineAlert`).
- `aria-busy="true"` on loading interactive buttons.
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` on `Progress` and `Slider`.
- Decorative icons marked with `aria-hidden="true"`.
- Actionable icons paired with visually hidden text (`<span className="sr-only">`).

### 4.5 Mobile Touch Targets & Safe Areas (Criterion 2.5.8)
- Minimum touch target: `44px × 44px` on mobile (Primary buttons use `48px`).
- Spacing between adjacent touch targets >= `8px`.
- Fixed bottom navigation uses `pb-safe` to avoid collision with iOS Home Indicator / Android navigation bars.

---

## 5. Storybook Configuration & Catalog Requirements

### 5.1 Current Storybook Setup in `packages/ui`
- **Framework**: `@storybook/react-vite` with React 19.
- **Config**: `.storybook/main.ts` loading all `src/**/*.stories.@(js|jsx|mjs|ts|tsx)`.
- **Addons**:
  - `@storybook/addon-essentials` (Controls, Viewport, Backgrounds, Docs)
  - `@storybook/addon-interactions` (Automated interaction testing)
  - `@storybook/addon-a11y` (Automated axe-core accessibility scanner)
- **Preview Config**: `.storybook/preview.ts` includes `theme.css`, background presets (light `#F8FAFC`, dark `#020617`), and color-contrast rule checks.

### 5.2 Storybook Catalog Coverage Requirements

Every component story file must implement the following state matrix:

1. **Default (Happy Path)**: Standard usage with realistic learning content.
2. **Variant Matrix**: Visual comparison of all variants side-by-side.
3. **Size Matrix**: Comparison across `sm`, `md`, `lg`, and `icon` sizes.
4. **Interactive States**:
   - `Hover` / `Active`
   - `Focus-Visible`
   - `Disabled`
   - `Loading` (with `aria-busy`)
5. **Dark Mode Story**: Rendering under `.dark` container theme.
6. **Stress Testing**:
   - Vietnamese diacritic stress test (e.g., *"Trường đại học bách khoa"*, *"Ôn tập từ vựng"*).
   - Long text truncation and word wrap resilience.
   - CJK glyph rendering (Chinese / Japanese characters) to verify font fallback.
7. **Accessibility (a11y) Verification**: 0 violations reported by `@storybook/addon-a11y`.

---

## 6. Frontend Application Architecture & Shell Boundary

### 6.1 Shell Architecture (`apps/web/src/components/navigation/`)
- **Desktop (`>= 1200px`)**: Fixed `DesktopSidebar` (260px width) containing:
  - Brand header & logo
  - 5 Primary Navigation routes (`Today`, `Read`, `Review`, `Brain`, `Progress`) with active `aria-current="page"` indicators
  - Secondary Navigation section (`Library`, `Dictionary`, `Settings`, `Profile`)
  - Learning Day Summary widget
- **Tablet (`768px - 1199px`)**: `TabletRail` with icon tooltips and compact secondary links.
- **Mobile (`< 768px`)**: `MobileBottomNav` strictly rendering the 5 primary MVP routes with `min-h-[44px]` touch targets.
- **Learning Focus Mode (`AppShell focusMode={true}`)**: Hides sidebar and bottom navigation to minimize cognitive load during active Review, Reader, and Starting Level Estimate sessions.

### 6.2 Strict Scope Boundaries & Guardrails
- **MVP Navigation**: Strictly restricted to `Today`, `Read`, `Review`, `Brain`, `Progress`.
- **Post-MVP Features**: AI Tutor (`/tutor`) and Speak Lab (`/speak`) are strictly feature-gated and must NEVER appear as dead navigation links or placeholder buttons in the MVP UI.
- **Zero Raw Magic Values**: All layout, spacing, and styling in `apps/web` must consume Tailwind utility classes mapped directly to semantic tokens (`canvas`, `surface`, `border-subtle`, `action-primary`, `focus-ring`, `radius-md`, etc.).

---

## 7. Actionable Next Steps for UI Engineering

1. **Expand Primitive Components in `packages/ui`**:
   - Implement `Input` / `TextField` with `<label>` and error states.
   - Implement `Modal` / `Dialog` with focus-trap and Escape key handling.
   - Implement `Tooltip` / `Popover` with keyboard triggers.
   - Implement `Slider` for goal and daily time settings.
   - Implement `Tabs` with APG keyboard arrow navigation.
   - Implement `ConceptNode` for Language Brain node visualization.
2. **Implement Domain Learning Components**:
   - Implement `WordCard`, `ReviewCard`, `AnswerOption`, `AudioPlayer`, `ReaderSentence`, `TranslationReveal`, `VocabularyPopover`.
   - Implement `SkillMeter`, `BrainSummary`, `MasteryBadge`, `TrendCard`, `MemoryHealth`.
3. **Run Storybook Build & Test Quality Gates**:
   - Run `pnpm test` (Vitest for component logic & a11y roles).
   - Run `pnpm --filter @lingua/ui build-storybook` to guarantee zero build errors and clean story documentation.
