# LINGUA OS — Wave 5 Enterprise Language Platform Upgrade Plan (Continuous QA Loop Iteration 1)

**Date:** 2026-10-28  
**Status:** Completed & Verified (10/10 Items Complete)  
**Auditor:** `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`)  
**Execution Strategy:** 6 Micro-Scoped `Model: 'flash'` Worker Subagents (`W5-1` .. `W5-6`) + Post-Wave `qa-web-auditor` Verification & Next-Cycle Audit

---

## 1. Granular Subagent Task Allocation (6 Flash Workers)

| Subagent | Role | Strict File Ownership | Wave 5 Audit Items Covered |
| :--- | :--- | :--- | :--- |
| **`W5-1`** | Beginner Lexicon Irregular Verbs & Contractions Engineer | `apps/web/src/features/read/beginnerLexicon.ts` | **#3** (Irregular past-tense & participle lemma map `went -> go`, `drank -> drink`, `took -> take`, `made -> make`, `found -> find`, `sat -> sit`, `met -> meet`, `knew -> know`, `thought -> think`, `left -> leave`, `said -> say`, `had -> have`, etc., plus contraction expansion `don't`, `didn't`, `can't`, `won't`, `it's`, `i'm`, `she's`, `he's`, `they're`, `we're` with Vietnamese morphological notes) |
| **`W5-2`** | Interactive Reader LingQ Highlighting & Sentence Read-Along Engineer | `apps/web/src/features/read/InteractiveReader.tsx` | **#1** (LingQ-style tiered status highlighting for `mastered`, `learning`, `weak`/`forgotten`, `new`/`discovered`), **#2** (Active sentence read-along highlight `data-playing="true"` when sentence audio plays) |
| **`W5-3`** | Smart Review FSRS Interval Preview, Audio Autoplay & Shortcut HUD Engineer | `apps/web/src/features/review/ReviewSession.tsx` | **#4** (Read `audioAutoplay` from `lingua-user-settings-v1` + visible `<kbd>1</kbd>..<kbd>4</kbd>` shortcut badges), **#5** (FSRS next-interval spacing preview `< 10p`, `1 ngày`, `3 ngày`, `7 ngày` on rating controls) |
| **`W5-4`** | Language Brain Audio & Category Filter + Today Streak Engineer | `apps/web/src/features/brain/LanguageBrainCanvas.tsx`, `apps/web/src/features/today/TodayDashboard.tsx` | **#6** (Direct Web Speech pronunciation button in Brain concept detail dialog + semantic `groupLabel` filter pills), **#7** (Daily streak badge `🔥 Chuỗi X ngày` + milestone celebration card in `TodayDashboard.tsx`) |
| **`W5-5`** | Dictionary Starter Chips/CEFR Filter & Library Sort/Export Engineer | `apps/web/src/features/dictionary/DictionaryView.tsx`, `apps/web/src/features/library/LibraryView.tsx` | **#8** (1-click starter search chips + CEFR level filter `Tất cả / A1 / A2 / B1` in `DictionaryView.tsx`), **#9** (Sorting `Mới lưu / A → Z` + 1-click vocabulary list clipboard export in `LibraryView.tsx`) |
| **`W5-6`** | Global Speech Rate Settings & Wave 5 Verification Engineer | `apps/web/src/features/settings/SettingsView.tsx`, `tests/frontend/wave5-enterprise-upgrades.test.tsx` | **#10** (`defaultSpeechRate: 1 | 0.75` toggle in `SettingsView.tsx` persisted to `lingua-user-settings-v1`) + **Wave 5 Automated Test Suite** (`tests/frontend/wave5-enterprise-upgrades.test.tsx`) |

---

## 2. Non-Negotiable Guardrails
- **Zero `*Dto` in View Components**: Never introduce any identifier ending with `Dto` in any `.tsx` view file (`tests/frontend/contracts.test.ts`).
- **Passive `localStorage` Invariant in `InteractiveReader`**: `InteractiveReader` must NOT write to `window.localStorage` on mount (`READ-LIVE-08` asserts `expect(window.localStorage.length).toBe(0)`). Reading `localStorage` is always safe.
- **Preserve All Existing Button Labels & Test Selectors**: Keep all existing button accessible names, `data-testid`s, and Vietnamese copy expected by existing Vitest suites intact.
