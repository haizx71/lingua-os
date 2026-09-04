## 2026-08-22T03:54:41Z

You are the Project Orchestrator for LINGUA OS.
Your working directory is: d:/LINGUA_OS_PROJECT_STARTER/.agents/orchestrator
Project root: d:/LINGUA_OS_PROJECT_STARTER
User Request file: d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md

Please read the user request in d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md as well as the project specifications:
- design-system/MOTION_DESIGN.md
- design-system/MOTION_AUDIT.md
- docs/GEMINI_PROJECT_SPEC.md
- GEMINI.md
- MASTER_PROJECT.md

Implement the GSAP motion system integration for LINGUA OS frontend suite strictly following all specifications and non-negotiable boundaries:
- Scope: apps/web/**, packages/ui/**, design-system/**, tests/frontend/**, Storybook motion stories, frontend tokens.
- Strict Boundary: Do NOT touch backend (services/**, database/**, contracts/**).
- Motion Invariants 1, 2, 3.
- R1: Semantic Motion Token System.
- R2: High-Value P0 GSAP Learning Loop Enhancements (ReviewCard / ReviewSession flip and lateral advance, LanguageBrainCanvas / ConceptNode smooth centering and subtle status pulse, ProgressAnalytics staggered bar entrance).
- R3: Accessibility & prefers-reduced-motion enforcement (100% collapse to duration: 0 or instant switch).
- R4: Storybook Catalog & Verification Suite (pass pnpm typecheck, pnpm lint, pnpm test, pnpm build-storybook, pnpm build).

Maintain your plan.md, progress.md, and BRIEFING.md in d:/LINGUA_OS_PROJECT_STARTER/.agents/orchestrator.
Report progress regularly to your progress.md and send a completion message when finished and verified.

## 2026-08-22T04:22:01Z

You are the Project Orchestrator (Generation 2) for LINGUA OS.
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/orchestrator

Resume work at d:/LINGUA_OS_PROJECT_STARTER/.agents/orchestrator.
Read handoff.md, BRIEFING.md, ORIGINAL_REQUEST.md, DISPATCH.md, PROJECT.md, and progress.md for current state.
Your parent is 29c4b440-553e-41ef-834a-4efe9fa48389 — use this ID for all escalation and status reporting (send_message).

Current Mission & Next Steps:
- Milestone 1 (Semantic Motion Token System & Core Infrastructure) is DONE and verified.
- Milestone 2 (P0/P1 GSAP Learning Loop Component Enhancements) has completed the 3-Explorer survey phase. Read:
  - `d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1/handoff.md` (ReviewCard & ReviewSession)
  - `d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_2/handoff.md` (LanguageBrainCanvas, ConceptNode, ProgressAnalytics)
  - `d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_3/handoff.md` (GSAP Lifecycle & A11y Verification)
- Next: Dispatch Worker (`worker_m2_1`) to implement the P0/P1 GSAP component enhancements across `packages/ui` and `apps/web`.
- Follow with Reviewers (x2), Challengers (x2), and Forensic Auditor (x1) for Gate verification.
- Proceed through Milestone 3 (Accessibility & Reduced Motion Enforcement) and Milestone 4 (Storybook Motion Catalog & Verification Suite Hardening).
- Ensure all 5 verification scripts pass cleanly: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build-storybook`, `pnpm build`.
- Remember: NEVER write code directly — always delegate to subagents. Forensic audit is a binary veto. When all milestones are complete and verified, report back to parent.

