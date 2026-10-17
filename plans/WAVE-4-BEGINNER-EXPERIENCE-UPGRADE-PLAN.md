# LINGUA OS — Wave 4 Beginner Experience ("Zero-to-One Learner UX") Upgrade Plan

**Date:** 2026-10-18  
**Status:** Completed & Verified (9/9 Beginner Upgrades Complete)  
**Execution Strategy:** 6 Micro-Scoped `Model: 'flash'` Subagents (`W4-1` .. `W4-6`) with Zero Overlapping File Ownership

---

## 1. Granular Subagent Task Allocation (6 Flash Workers)

| Subagent | Role | Strict File Ownership | Beginner UX Upgrades Covered |
| :--- | :--- | :--- | :--- |
| **`W4-1`** | Reader Token Inspector Fix & Beginner Lexicon Engineer | `apps/web/src/features/read/useReaderSession.ts`, `apps/web/src/features/read/beginnerLexicon.ts` | **#1** (Fix Vietnamese `definition` being hidden inside `explanationEn` when `translation` is null/empty), **#2a & #5a & #8a** (Create `beginnerLexicon.ts` with 120+ A0–B1 word lookups, Vietnamese pronunciation tips, POS translations, and sentence grammar structure tips) |
| **`W4-2`** | Interactive Reader Any-Word Lookup, Slow Audio & Grammar UI Engineer | `apps/web/src/features/read/InteractiveReader.tsx` | **#2b** (Click any English word in a sentence to open instant Vietnamese lookup & TTS without breaking existing `<button>` concept selectors), **#4** (`0.75x` slow speech toggle in Reader), **#5b** (Sentence grammar breakdown in revealed translations), **#8b & #9a** (Friendly CEFR level labels, Vietnamese POS labels & pronunciation tips in Word Inspector) |
| **`W4-3`** | Onboarding Diagnostic Beginner Bypass & No-Guessing Engineer | `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx` | **#6** (`"Bắt đầu ngay từ mức Cơ bản (A0)"` zero-English bypass button + `"Mình chưa biết câu này (Không đoán mò)"` option per question + dynamic `A0`/`A1` beginner result calibration) |
| **`W4-4`** | Smart Review Letter Hint & Slow Pronunciation Engineer | `apps/web/src/features/review/ReviewSession.tsx` | **#7** (`"Gợi ý chữ cái"` progressive spelling hint in `typing`/`cloze`/`listening` modes + `"Nghe chậm 0.75x"` button + beginner FSRS rating guide) |
| **`W4-5`** | Today Beginner Guide & Dictionary Slow Audio Engineer | `apps/web/src/features/today/TodayDashboard.tsx`, `apps/web/src/features/dictionary/DictionaryView.tsx` | **#8c & #9b** (3-step beginner quick-start guide on `TodayDashboard.tsx`, `"Nghe chậm 0.75x"` button and Vietnamese POS/pronunciation tips in `DictionaryView.tsx`) |
| **`W4-6`** | Knowledge V2 Bilingual Sense Upsert & Wave 4 Verification Engineer | `knowledge/catalog_import_v2.py`, `knowledge/v2/catalog_apply_plan.v2.json`, `knowledge/v2/catalog_apply_plan.v2.sql`, `tests/frontend/wave4-beginner-experience.test.tsx` | **#1b** (Ensure `word_senses` `ON CONFLICT` updates `translated_definition` in `catalog_import_v2.py`) + **Wave 4 Frontend Test Suite** (`tests/frontend/wave4-beginner-experience.test.tsx`) |

---

## 2. Non-Negotiable Guardrails
- **Zero `*Dto` in View Components**: Never introduce any identifier ending with `Dto` in `InteractiveReader.tsx`, `OnboardingDiagnostic.tsx`, `ReviewSession.tsx`, `TodayDashboard.tsx`, or `DictionaryView.tsx` (`tests/frontend/contracts.test.ts`).
- **Preserve All Existing Reader & Review Test Invariants**:
  - Non-concept helper words in `InteractiveReader.tsx` MUST use `<span data-testid="reader-helper-word" ...>` (NOT `<button>`), so `screen.getAllByRole('button')` and `READ-LIVE-01..10` in `tests/frontend/task-read-001-reader-live.test.tsx` and `f07-interactive-reader.test.tsx` remain 100% unchanged.
  - Clicking a non-concept helper word must NEVER call `api.getConcept` or `api.recordReaderExposure`.
  - Keep `window.localStorage` untouched during passive `InteractiveReader` mount (`READ-LIVE-08` asserts `expect(window.localStorage.length).toBe(0)`).
