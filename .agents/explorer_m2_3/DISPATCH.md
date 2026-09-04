## 2026-08-22T04:19:02Z
You are the GSAP Lifecycle & A11y Verification Explorer for Milestone 2.
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_3

Scope & Context:
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md
- Read d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- Read d:/LINGUA_OS_PROJECT_STARTER/design-system/MOTION_DESIGN.md
- Inspect existing test harness in `tests/frontend/` and Storybook setup in `packages/ui/.storybook/`.

Your task:
1. Analyze how to verify and test the P0/P1 GSAP motion integrations across `ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`, and `ProgressAnalytics`:
   - Lifecycle auto-cleanup verification (preventing memory leaks on component unmount or rapid route change).
   - Reduced-motion verification under JSDOM and `@testing-library/react`.
   - Keyboard responsiveness assertions (verifying state updates execute synchronously even while tweens are active).
   - Storybook stories requirements for animated components.
2. Provide concrete Vitest test specifications and assertions.
3. Write your findings and strategy in d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_3/handoff.md following the Handoff Protocol.
4. Send a message to parent when finished.
