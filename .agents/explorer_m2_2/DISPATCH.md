## 2026-08-22T04:19:02Z

<USER_REQUEST>
You are the Brain & Progress Domain Motion Explorer for Milestone 2.
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_2

Scope & Context:
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md
- Read d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- Read d:/LINGUA_OS_PROJECT_STARTER/design-system/MOTION_DESIGN.md
- Read d:/LINGUA_OS_PROJECT_STARTER/design-system/MOTION_AUDIT.md
- Inspect `apps/web/src/features/brain/LanguageBrainCanvas.tsx`
- Inspect `packages/ui/src/components/ConceptNode/ConceptNode.tsx`
- Inspect `apps/web/src/features/progress/ProgressAnalytics.tsx`

Your task:
1. Analyze the exact GSAP motion integration for:
   - `LanguageBrainCanvas.tsx`: Smooth GSAP camera / canvas pan & zoom centering (`gsap.to` transform) targeting selected concept coordinates when a node is clicked, preserving zoom bounds (50%–150%) and responsive canvas bounds without layout thrashing.
   - `ConceptNode.tsx`: 200ms subtle scale pulse (1.0 -> 1.05 -> 1.0) and border illumination on node status upgrade or selection using `useGSAP` with scoped ref and proper cleanup.
   - `ProgressAnalytics.tsx`: Staggered 250ms bar entrance (`gsap.from` with 50ms stagger, `scaleX: 0 -> 1` or `scaleY: 0 -> 1`) on initial mount and time window switch, ensuring ARIA values (`aria-valuenow`) and DOM text remain immediately present.
2. Ensure strict adherence to:
   - Motion Invariant 1 (timing limits & zero blocking).
   - Motion Invariant 2 (GSAP vs CSS boundaries).
   - Motion Invariant 3 (immediate semantic data correctness).
   - Reduced motion fallback (duration: 0 / instant static display).
3. Provide concrete TypeScript implementation snippets and architectural guidelines.
4. Write your findings and strategy in d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_2/handoff.md following the Handoff Protocol.
5. Send a message to parent when finished.
</USER_REQUEST>
