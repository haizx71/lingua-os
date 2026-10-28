# LINGUA OS — Wave 10 Enterprise Language Platform Plan (Continuous QA Loop Iteration #7 / Cycle 2 of 5)

## 1. Objective
Execute **Cycle 2 of 5 (`Wave 10`)** in the Continuous QA & 10-Point Enterprise Language Platform Upgrade Loop:
1. Verify Wave 9 with `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`) and audit the next 10 highest-leverage pedagogical & UX improvements.
2. Dispatch 5 micro-scoped `Model: 'flash'` worker subagents (`W10-1` .. `W10-5`) with strict non-overlapping file ownership boundaries.
3. Re-verify all tests, typechecks, and lint rules via `qa-web-auditor`.

---

## 2. The 10 Enterprise Upgrades (Wave 10)

### Group W10-1 — Interactive Reader Saved Sentence Counter & Word Family Derivatives (`InteractiveReader.tsx`, `beginnerLexicon.ts`)
1. **Saved Sentences Counter Badge (`data-testid="reader-saved-sentences-count"`)**:
   - In `InteractiveReader.tsx`, display a live counter badge (`📌 Đã lưu ${savedSentenceIds.size} câu`) in the Reader toolbar so learners can track how many contextual sentences they have bookmarked from the current passage.
2. **Word Family & Morphological Derivatives Hint (`data-testid="inspector-word-family"`)**:
   - In `beginnerLexicon.ts`, export `getWordFamilyHint(term: string): string | null` returning common morphological relatives (e.g., `schedule` → `scheduled (adj), scheduling (n)`, `visit` → `visitor (n), visiting (v-ing)`, `quick` → `quickly (adv), quickness (n)`, or general morphological tip).
   - Render `data-testid="inspector-word-family"` inside the Word Inspector dialog (`selectedToken`).

### Group W10-2 — Smart Review Pace Indicator & Language Brain Quick Node Search (`ReviewSession.tsx`, `LanguageBrainCanvas.tsx`)
3. **Review Card Pace & Rhythm Indicator (`data-testid="review-pace-indicator"`)**:
   - In `ReviewSession.tsx`, display a calm rhythm indicator pill (`⏱️ Nhịp chuẩn: ~8s/thẻ`) in the header toolbar to help learners avoid rushing or over-thinking during FSRS recall.
4. **Language Brain Quick Concept Search Input (`data-testid="brain-node-search"`)**:
   - In `LanguageBrainCanvas.tsx`, add an instant search input (`data-testid="brain-node-search"`, `aria-label="Tìm nhanh khái niệm trong mạng lưới"`) that filters `visibleNodes` by term or Vietnamese meaning without losing existing status filter functionality.

### Group W10-3 — Dictionary 1-Click Copy Term/IPA & Library Item Type Breakdown (`DictionaryView.tsx`, `LibraryView.tsx`)
5. **1-Click Copy Term & IPA Button (`data-testid="dictionary-copy-term"`)**:
   - In `DictionaryView.tsx`, add a compact button (`📋 Sao chép từ`) on concept cards (`visibleLemmaGroups`, `ungroupedResults`, `visibleDirectResults`) that copies `${term} ${ipa} — ${meaningVi}` to clipboard and shows `Đã sao chép`.
6. **Library Saved Item Type Breakdown Pill (`data-testid="library-type-counts"`)**:
   - In `LibraryView.tsx`, compute counts of saved concepts, sentences, and passages from `items` and display a summary pill (`data-testid="library-type-counts"`) in the header (`Từ vựng · Câu · Bài đọc`).

### Group W10-4 — Today Quick Review Queue Jump & Progress Best Study Day Highlight (`TodayDashboard.tsx`, `ProgressAnalytics.tsx`)
7. **Quick Jump to Smart Review Pill (`data-testid="today-quick-review-link"`)**:
   - In `TodayDashboard.tsx`, inside the `<aside>` goal card, render a quick action button (`⚡ Ôn nhanh thẻ đến hạn`) that navigates to `/review` via `clientNavigate('/review')`.
8. **Peak Study Day Highlight Badge (`data-testid="progress-best-day-badge"`)**:
   - In `ProgressAnalytics.tsx`, compute the highest `minutesSpent` across `history` (`const maxMinutesDay = history.reduce((max, d) => Math.max(max, d.minutesSpent), 0)`) and render `data-testid="progress-best-day-badge"` (`🏆 Kỷ lục phiên học: ${maxMinutesDay} phút/ngày`).

### Group W10-5 — Profile CEFR Level Descriptor, Onboarding Time Estimate & Wave 10 Test Suite (`ProfileView.tsx`, `OnboardingDiagnostic.tsx`, `tests/frontend/wave10-enterprise-upgrades.test.tsx`)
9. **CEFR Level Capability Descriptor Callout (`data-testid="profile-cefr-descriptor"`)**:
   - In `ProfileView.tsx`, render a clear Vietnamese explanation of what the learner's current CEFR level (`level || 'A1'`) means in real-world communication (`💬 Năng lực hiện tại: Giao tiếp câu ngắn & đọc hiểu ngữ cảnh cơ bản`).
10. **Onboarding Estimated Time Remaining Pill (`data-testid="onboarding-time-estimate"`)**:
   - In `OnboardingDiagnostic.tsx`, inside the active question header (`!isCompleted && currentQuestion`), render `data-testid="onboarding-time-estimate"` (`⏱️ Còn khoảng ${Math.max(1, questions.length - currentStep)} câu (~1 phút)`).
   - Create `tests/frontend/wave10-enterprise-upgrades.test.tsx` testing all 10 Wave 10 upgrades.
