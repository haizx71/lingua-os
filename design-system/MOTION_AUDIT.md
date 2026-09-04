# LINGUA OS — Motion Opportunity Audit

Version: 1.0  
Status: AUDIT COMPLETE & PRIORITIZED  
Consumer: Engineering Team, Frontend UI/UX, QA & Verification

---

## 1. Audit Framework & Evaluation Criteria

Every prospective motion opportunity is evaluated against:
- **UX Purpose**: How does motion improve comprehension, feedback, or continuity without distraction?
- **GSAP Justification**: Does this require timeline choreography, coordinated multi-element state, interruption safety, or precise easing control? If simple CSS transition is sufficient, GSAP is skipped.
- **Accessibility & Reduced Motion**: How does the component behave when `prefers-reduced-motion: reduce` is active?
- **Performance Risk**: Composite property safety (`transform`, `opacity`), avoidance of reflows, and cleanup guarantees.
- **Priority Tier**:
  - **P0**: Core learning loop ergonomic enhancements (High UX value, zero input delay).
  - **P1**: Contextual feedback & secondary state transitions.
  - **P2**: Nice-to-have visual polish (Deferred / CSS preferred).

---

## 2. Screen-by-Screen Component Motion Audit Table

| Screen / Component | UX Purpose | Suggested Motion | GSAP Required? | Reduced-Motion Behavior | Performance Risk | Priority | Decision |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| **Review / ReviewCard** (`ReviewCard.tsx`) | Visually connects prompt to answer reveal and confirms rating choice. | 200ms 3D flip / cross-fade on reveal; 150ms subtle rating button press and next-card slide. | **YES** (`useGSAP` timeline) | Instant display switch (`duration: 0`). | Very Low (pure transform/opacity). | **P0** | **IMPLEMENT** |
| **Review / ReviewSession** (`ReviewSession.tsx`) | Smooth card transitions between active review queue items. | Fast 150ms lateral slide-out of completed card and slide-in of next item. | **YES** (`useGSAP` contextSafe) | Instant replacement. | Very Low. | **P0** | **IMPLEMENT** |
| **Brain / LanguageBrainCanvas** (`LanguageBrainCanvas.tsx`) | Guides learner visual attention to selected concept in network. | Smooth camera/canvas pan and zoom centering to target concept node coordinates. | **YES** (`gsap.to` transforms) | Instant coordinate snap. | Low (SVG/canvas transform). | **P0** | **IMPLEMENT** |
| **Brain / ConceptNode** (`ConceptNode.tsx`) | Highlights mastery status change and selection state. | 200ms scale pulse (1.0 -> 1.05 -> 1.0) and border illumination on status upgrade. | **YES** (`useGSAP`) | Instant static border update. | Very Low. | **P0** | **IMPLEMENT** |
| **Today / TodayDashboard** (`TodayDashboard.tsx`) | Immediate confirmation when an activity in daily plan is finished. | 200ms checkmark reveal and subtle row dimming. | **NO** (CSS transition) | Instant state switch. | None. | **P1** | **SKIP GSAP (CSS)** |
| **Today / TimeBudget Meter** (`Progress.tsx`) | Visual feedback of daily time spent increasing. | 300ms width tween on progress bar fill. | **NO** (CSS `transition: width`) | Instant width update. | None. | **P1** | **SKIP GSAP (CSS)** |
| **Reader / InteractiveReader** (`InteractiveReader.tsx`) | Shows sentence definition popover next to tapped token. | 150ms scale-up fade from anchor token position. | **NO** (CSS transition) | Instant opacity fade. | None. | **P1** | **SKIP GSAP (CSS)** |
| **Reader / SavedSentence Toast** (`InlineAlert.tsx`) | Non-intrusive feedback when saving a sentence to library. | 200ms slide-up notification with auto-dismiss fade. | **YES** (`useGSAP` timeline) | Instant static alert. | Very Low. | **P1** | **IMPLEMENT** |
| **Progress / ProgressAnalytics** (`ProgressAnalytics.tsx`) | Organizes cognitive load when viewing retention and mastery graphs. | Staggered 250ms bar height reveal on initial load. | **YES** (`gsap.from` with stagger) | Instant full bar render. | Very Low. | **P1** | **IMPLEMENT** |
| **AppShell / Navigation** (`Sidebar.tsx`, `BottomNav.tsx`) | Indicates active route transition smoothly. | 150ms active pill position transition. | **NO** (CSS transition) | Instant active toggle. | None. | **P2** | **SKIP GSAP (CSS)** |
| **Onboarding / Diagnostic** (`OnboardingDiagnostic.tsx`) | Paces multi-step question flow. | 200ms horizontal step slide. | **NO** (CSS transition) | Instant step swap. | None. | **P2** | **SKIP GSAP (CSS)** |

---

## 3. High-Value P0 Motion Targets for Implementation

From the audit, the following **P0 / P1 GSAP implementations** provide maximum pedagogical and ergonomic value without risking performance or blocking learner throughput:

1. **`ReviewCard` & `ReviewSession` (P0)**:
   - Coordinated card answer reveal via GSAP timeline.
   - Non-blocking rating feedback transition (sub-200ms).
   - Instant keyboard navigation compatibility with zero delay.
2. **`LanguageBrainCanvas` & `ConceptNode` (P0)**:
   - Smooth transform centering on node selection.
   - Node status upgrade pulse with proper garbage collection.
3. **`ProgressAnalytics` (P1)**:
   - Accessible chart bar stagger entrance using `useGSAP`.
4. **`Semantic Motion Tokens` (`packages/ui/src/tokens/semantic.ts`)**:
   - Formally extend the DTCG 3-tier token scale with duration, easing, and distance tokens.
