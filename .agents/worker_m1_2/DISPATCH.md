## 2026-08-22T04:14:37Z

You are the Implementation Worker for Milestone 1 Remediation (Iteration 2).
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m1_2

Mandatory Inputs:
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md
- Read d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/reviewer_m1_1/handoff.md
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/orchestrator/GATE_STATUS.md

Feedback from Reviewer 1:
In `packages/ui/src/tokens/semantic.ts`, `motionDurationToSeconds` unconditionally divides by 1000, which causes `'1.5s'` to evaluate to `0.0015` instead of `1.5`.

Tasks to Implement:
1. Fix `motionDurationToSeconds` in `packages/ui/src/tokens/semantic.ts` to properly discriminate between `ms` and `s` duration strings, trimming whitespace and safely handling edge cases (empty strings, non-numbers, negative numbers, etc.):
   ```ts
   export function motionDurationToSeconds(durationToken: string): number {
     if (typeof durationToken !== 'string') return 0;
     const trimmed = durationToken.trim();
     if (!trimmed) return 0;
     if (trimmed.endsWith('ms')) {
       const parsed = parseFloat(trimmed);
       return Number.isNaN(parsed) ? 0 : parsed / 1000;
     }
     if (trimmed.endsWith('s')) {
       const parsed = parseFloat(trimmed);
       return Number.isNaN(parsed) ? 0 : parsed;
     }
     const parsed = parseFloat(trimmed);
     return Number.isNaN(parsed) ? 0 : parsed / 1000;
   }
   ```
2. Run `npx pnpm test` and verify that all test suites pass (including `tests/frontend/tokens.test.ts`, `tests/frontend/challenger.motion-reduced.adversarial.test.tsx`, and `tests/frontend/tokens.adversarial.test.ts`).
3. Run `npx pnpm typecheck` and `npx pnpm lint`.
4. Produce your handoff report in `d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m1_2/handoff.md` following the Handoff Protocol.
5. Send a message to parent when completed.
