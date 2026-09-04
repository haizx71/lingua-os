## 2026-08-22T04:03:12Z

You are the Implementation Worker for Milestone 1: Semantic Motion Token System & Core Infrastructure.
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m1_1

Mandatory Inputs:
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md
- Read d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m1_1/handoff.md
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m1_2/handoff.md
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m1_3/handoff.md

Write Ownership:
You own exclusively:
- `packages/ui/src/tokens/primitive.ts`
- `packages/ui/src/tokens/semantic.ts`
- `packages/ui/src/tokens/component.ts`
- `packages/ui/src/tokens/theme.css`
- `packages/ui/src/tokens/index.ts`
- `packages/ui/src/hooks/usePrefersReducedMotion.ts` (and any export in `packages/ui/src/hooks/index.ts` or `packages/ui/src/index.ts`)
- `tests/frontend/tokens.test.ts`

Tasks to Implement:
1. Update `packages/ui/src/tokens/primitive.ts` with the complete DTCG 3-tier motion token scale:
   - Durations (`0: '0ms'`, `75: '75ms'`, `150: '150ms'`, `200: '200ms'`, `300: '300ms'`, `400: '400ms'`, `600: '600ms'`, plus backward-compatible `fast`, `base`, `slow`).
   - Easings (`standard`, `enter`, `exit`, `emphasized`, `linear`, `inOut`).
   - Distances (`xs: '2px'`, `sm: '4px'`, `md: '8px'`, `lg: '16px'`).
   - Scales (`press: 0.98`, `feedback: 1.02`, `pulse: 1.05`).
   - Export all types (`PrimitiveMotion`, `PrimitiveDuration`, etc.).
2. Update `packages/ui/src/tokens/semantic.ts` with `semanticMotion` (and `motionTokens`):
   - Durations (`instant: '0ms'`, `fast: '150ms'`, `normal: '250ms'`, `slow: '400ms'`, `feedback: '200ms'`).
   - Distances (`reveal: '8px'`, `slide: '16px'`, `micro: '4px'`).
   - Scales (`active: 0.98`, `highlight: 1.05`, `feedback: 1.02`).
   - Easings (`standard`, `enter`, `exit`, `emphasized`).
3. Update `packages/ui/src/tokens/component.ts` with `componentMotionTokens` for interactive UI elements (`button`, `card`, `reviewCard`, `reviewSession`, `conceptNode`, `brainCanvas`, `progressAnalytics`, `modal`, `toast`, `tooltip`).
4. Update `packages/ui/src/tokens/theme.css`:
   - Root CSS custom properties for motion (`--motion-duration-*`, `--motion-ease-*`, `--motion-distance-*`, `--motion-scale-*`, `--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`).
   - Complete `@media (prefers-reduced-motion: reduce)` rule block collapsing all motion durations to `0ms`, distances to `0px`, and scales to `1`.
5. Update `packages/ui/src/tokens/index.ts` to export all new motion tokens, types, and constants.
6. Create `packages/ui/src/hooks/usePrefersReducedMotion.ts` (SSR-safe, reactive to `matchMedia` changes) and export it from `packages/ui/src/index.ts`.
7. Update `tests/frontend/tokens.test.ts` to comprehensively test all primitive, semantic, and component motion tokens, type safety, and reduced-motion fallback properties.
8. Execute verification commands:
   - `npx pnpm test`
   - `npx pnpm typecheck`
   - `npx pnpm lint`
9. Produce your handoff report in `d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m1_1/handoff.md` following the Handoff Protocol.
10. Send a message to parent when completed.
