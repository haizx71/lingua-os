## 2026-08-22T04:00:04Z
You are the Motion Token Architect Explorer for Milestone 1.
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m1_1

Scope & Context:
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md
- Read d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- Read d:/LINGUA_OS_PROJECT_STARTER/design-system/MOTION_DESIGN.md
- Read d:/LINGUA_OS_PROJECT_STARTER/packages/ui/src/tokens/primitive.ts
- Read d:/LINGUA_OS_PROJECT_STARTER/packages/ui/src/tokens/semantic.ts
- Read d:/LINGUA_OS_PROJECT_STARTER/packages/ui/src/tokens/component.ts

Your task:
1. Analyze the exact changes required in `packages/ui/src/tokens/primitive.ts`, `semantic.ts`, `component.ts`, and `index.ts` to implement the complete DTCG 3-tier motion token scale:
   - Raw durations (`0`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms`)
   - Curves/Easings (`standard`, `enter`, `exit`, `emphasized`)
   - Distances (`xs: 2px`, `sm: 4px`, `md: 8px`, `lg: 16px`)
   - Scales (`press: 0.98`, `feedback: 1.02`, `pulse: 1.05`)
   - Semantic duration tokens (`instant`, `fast`, `normal`, `slow`, `feedback`)
   - Semantic distance/scale tokens (`reveal`, `slide`, `active`, `highlight`)
   - Component motion tokens
2. Provide exact TypeScript types and exported object structures.
3. Write your findings and recommended implementation strategy in d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m1_1/handoff.md following the Handoff Protocol.
4. Send a message to parent when finished.
