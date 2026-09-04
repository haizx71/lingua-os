## 2026-08-22T04:38:12Z

You are the Frontend Worker for Milestone 2: Extended UI Primitives, Learning Domain Component Catalog & Storybook Catalog (`packages/ui`).

Your working directory is: d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m2_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Must read first:
- d:/LINGUA_OS_PROJECT_STARTER/ORIGINAL_REQUEST.md
- d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- d:/LINGUA_OS_PROJECT_STARTER/design-system/MASTER.md
- d:/LINGUA_OS_PROJECT_STARTER/docs/GEMINI_PROJECT_SPEC.md
- d:/LINGUA_OS_PROJECT_STARTER/docs/UI_UX_SKILL_POLICY.md
- d:/LINGUA_OS_PROJECT_STARTER/.agents/survey_design_1/report.md
- d:/LINGUA_OS_PROJECT_STARTER/packages/types/src/index.ts

Your Exclusive Write Ownership:
- `packages/ui/**` (all components, stories, tests, styles, exports)
- `tests/frontend/components.test.tsx` (or co-located tests in packages/ui)

Scope & Tasks:
1. Implement Extended UI Primitives in `packages/ui/src/components/`:
   - `Input` / `TextField`: accessible text input with label, error text, helper text, focus rings, prefix/suffix icons.
   - `Modal` / `Dialog`: accessible dialog with overlay, ESC escape key, focus trap, title, description, close button, responsive sizing.
   - `Tabs`: accessible tab container, tab list, trigger, and panel adhering to ARIA tabs pattern.
   - `Slider`: accessible range slider for setting study duration (e.g. 10-60 min) and new word budgets.
   - `Tooltip`: accessible hover and focus popover.
   - `Select` / `Dropdown`: accessible select menu.
2. Implement Learning Domain UI Components in `packages/ui/src/components/`:
   - `WordCard`: displays word term, IPA phonetic transcription, sense definitions, example sentences, audio playback button, and non-color `ConceptChip` status.
   - `ReviewCard`: flashcard / exercise card supporting 5 modes (`self_recall`, `multiple_choice`, `typing`, `cloze`, `listening`), flip/reveal animation, prompt, options/input, audio playback, and 4 rating buttons (`Again`, `Hard`, `Good`, `Easy`).
   - `ReaderSentence`: tokenized sentence rendering interactive words highlighted by concept status, audio button, inline translation toggle.
   - `BrainSummaryCard` & `ConceptNode`: graph node representation with status icons, CEFR badges, mastery level indicator.
   - `SkillMeter`: progress meters for Recognition, Listening, Production skills with WCAG 2.2 contrast.
3. Build Comprehensive Storybook Stories (`*.stories.tsx`):
   - Every component in `packages/ui/src/components/` must have a co-located Storybook story file covering light & dark themes, all variants, interactive states, Vietnamese text stress, and a11y parameters.
4. Export all components, types, and tokens from `packages/ui/src/index.ts`.
5. Implement unit tests in `packages/ui/src/` or `tests/frontend/components.test.tsx` verifying component rendering, user interactions, ARIA attributes, and WCAG 2.2 AA non-color status compliance.
6. Verify with `pnpm --filter @lingua/ui typecheck`, `pnpm --filter @lingua/ui test`, and Storybook build.
7. Write your detailed completion report to `d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m2_1/report.md` and deliver `handoff.md`.
Send a message back when done.
