# WAVE 7: Enterprise Language Platform Upgrade Plan (Continuous QA Loop — Iteration 4)

**Status:** In Progress  
**Date:** 2026-10-28  
**QA Auditor Subagent:** `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`)  
**Worker Subagents:** 5 micro-scoped `Model: 'flash'` workers (`W7-1` .. `W7-5`)

---

## 1. 10-Point Enterprise Language Platform Audit Findings (Wave 7)

1. **Adjustable Reader Typography & Font Scale (`InteractiveReader.tsx`)**:
   - `data-testid="reader-font-size-toggle"` (`aria-label="Điều chỉnh kích cỡ chữ bài đọc"`) cycling `Cỡ chữ: Chuẩn` / `Cỡ chữ: Lớn` / `Cỡ chữ: Rất lớn` in React state (no `localStorage` writes on passive mount).
2. **Passage Lexical Distribution & Density Indicator (`InteractiveReader.tsx`)**:
   - `data-testid="reader-lexical-distribution"` (`aria-label="Phân bổ từ vựng bài đọc"`) in the Reader header showing counts of Known (`mastered`), Learning (`learning`/`reviewing`), and New/Other concept tokens (`X từ vững · Y đang học · Z từ mới`).
3. **Auditory Reward Feedback Toggle (`ReviewSession.tsx`)**:
   - `data-testid="review-audio-feedback-toggle"` (`aria-label="Bật/tắt âm thanh phản hồi khi trả lời thẻ"`) in the Review header with Web Audio API chime synthesis on card rating.
4. **FSRS Difficult Concept / Leech Alert Badge (`ReviewSession.tsx`)**:
   - `data-testid="review-leech-indicator"` (`aria-label="Khái niệm cần mẹo ghi nhớ đặc biệt"`) when `currentCard.status === 'forgotten' || currentCard.status === 'weak'`, coaching the learner to use elaborative encoding.
5. **Collocational & Contextual Phrase Cluster (`LanguageBrainCanvas.tsx`)**:
   - `data-testid="brain-related-collocations"` (`aria-label="Cụm từ thường đi kèm và liên quan"`) inside the concept detail modal displaying natural English collocations with Vietnamese glosses.
6. **Bilingual Cross-Search Mode Toggle (`DictionaryView.tsx`)**:
   - `data-testid="dictionary-search-lang-toggle"` (`aria-label="Chuyển chế độ tìm kiếm: Anh-Việt hoặc Việt-Anh"`) enabling Vietnamese-to-English reverse meaning lookup across loaded concepts.
7. **Multi-Item Selection & Focused Vocabulary Export (`LibraryView.tsx`)**:
   - `data-testid="library-bulk-actions"` and `data-testid="library-select-all"` allowing learners to select specific saved items or all visible items for targeted clipboard export.
8. **Circadian Study Rhythm Banner (`TodayDashboard.tsx`)**:
   - `data-testid="today-greeting-banner"` (`aria-label="Lời chào và gợi ý học tập theo thời gian trong ngày"`) providing circadian study focus advice while respecting all existing Today copy invariants.
9. **Velocity & Projected Level Completion Forecast (`ProgressAnalytics.tsx`)**:
   - `data-testid="progress-velocity-forecast"` (`aria-label="Dự báo thời gian hoàn thành cột mốc CEFR"`) inside the CEFR milestone section projecting estimated days to reach the next CEFR band.
10. **Preferred Study Reminder Hour Selector (`SettingsView.tsx`)**:
    - `data-testid="settings-reminder-time-selector"` (`aria-label="Chọn giờ nhắc nhở học tập hàng ngày"`) allowing learners to choose a daily study reminder time (`Tắt`, `07:30`, `12:30`, `20:00`, `21:30`) persisted conditionally in `lingua-user-settings-v1`.

---

## 2. Subagent Task Partitioning (Strict Non-Overlapping Ownership)

| Subagent | Owned Files | Scope |
|---|---|---|
| **W7-1** (`flash`) | `apps/web/src/features/read/InteractiveReader.tsx` | Items #1 & #2 (Reader Font Scale Toggle & Passage Lexical Distribution) |
| **W7-2** (`flash`) | `apps/web/src/features/review/ReviewSession.tsx` | Items #3 & #4 (Auditory Reward Feedback Toggle & FSRS Leech Indicator) |
| **W7-3** (`flash`) | `apps/web/src/features/brain/LanguageBrainCanvas.tsx`, `apps/web/src/features/dictionary/DictionaryView.tsx` | Items #5 & #6 (Brain Collocations Cluster & Dictionary Bilingual Cross-Search) |
| **W7-4** (`flash`) | `apps/web/src/features/library/LibraryView.tsx`, `apps/web/src/features/today/TodayDashboard.tsx` | Items #7 & #8 (Library Bulk Selection & Today Circadian Study Banner) |
| **W7-5** (`flash`) | `apps/web/src/features/progress/ProgressAnalytics.tsx`, `apps/web/src/features/settings/SettingsView.tsx`, `tests/frontend/wave7-enterprise-upgrades.test.tsx` | Items #9, #10 & Wave 7 Automated Test Suite |
