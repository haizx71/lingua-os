# WAVE 9: Enterprise Language Platform Upgrade Plan (Continuous QA Loop — Cycle 1 of 5)

**Status:** In Progress  
**Date:** 2026-10-28  
**QA Auditor Subagent:** `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`)  
**Worker Subagents:** 5 micro-scoped `Model: 'flash'` workers (`W9-1` .. `W9-5`)

---

## 1. 10-Point Enterprise Language Platform Audit Findings (Wave 9)

1. **Reading Theme Toggle (`InteractiveReader.tsx`)**:
   - `data-testid="reader-theme-toggle"` (`aria-label="Đổi màu nền đọc bài"`) cycling `default` (`Mặc định`), `sepia` (`Vàng dịu`), and `dark` (`Tối dịu mắt`) via `data-reader-theme` in React state (zero `localStorage` writes on passive mount).
2. **Pronunciation & Meaning Trap Callout (`beginnerLexicon.ts` & `InteractiveReader.tsx`)**:
   - `getLearnerTrapWarning(term: string): string | null` in `beginnerLexicon.ts` flagging common Vietnamese learner pitfalls (e.g. silent letters in `schedule`, `island`, `walk`, `talk`, `know`, `write`, `hour`, or false friends like `present`, `actual`, `coffee`, `tea`), rendered as `data-testid="inspector-trap-warning"` in the Reader Word Inspector.
3. **Review Sprint Batch Selector (`ReviewSession.tsx`)**:
   - `data-testid="review-batch-selector"` (`aria-label="Chọn quy mô phiên ôn tập nhanh"`) allowing learners to toggle micro-sprint targets (`Tất cả`, `5 thẻ`, `10 thẻ`) with `data-sprint-target`.
4. **CEFR Tier Distribution Pill (`LanguageBrainCanvas.tsx`)**:
   - `data-testid="brain-cefr-distribution"` (`aria-label="Phân bổ khái niệm theo cấp độ CEFR"`) summarizing `A1`, `A2`, `B1` concept counts across the cognitive graph.
5. **Ultra-Slow 0.5x Phonemic Audio Button (`DictionaryView.tsx`)**:
   - `data-testid="dictionary-ultraslow-audio"` (`aria-label="Nghe cực chậm 0.5x tách âm"`) speaking the dictionary lemma at `0.5x` speech rate for syllable-by-syllable phonemic analysis.
6. **Library Mastery Status Filter (`LibraryView.tsx`)**:
   - `data-testid="library-status-filter"` (`aria-label="Lọc theo mức độ ghi nhớ"`) filtering saved concepts by mastery state (`all`, `learning`, `mastered`, `due`).
7. **Daily Focus Skill Tag (`TodayDashboard.tsx`)**:
   - `data-testid="today-focus-skill-badge"` (`aria-label="Trọng tâm kỹ năng hôm nay"`) highlighting the primary cognitive skill targeted by the current plan (`Đọc hiểu & Từ vựng ngữ cảnh`).
8. **Streak Shield & Habit Buffer Indicator (`ProgressAnalytics.tsx`)**:
   - `data-testid="progress-streak-shield"` (`aria-label="Lá chắn bảo vệ chuỗi ngày học"`) rewarding learners who maintain >= 3 active study days with a streak shield status badge.
9. **Weekly Learning Commitment Indicator (`ProfileView.tsx`)**:
   - `data-testid="profile-weekly-commitment"` (`aria-label="Cam kết nhịp độ học hàng tuần"`) displaying weekly study volume commitment derived from the learner's profile.
10. **English Accent Preference Selector (`SettingsView.tsx`)**:
    - `data-testid="settings-accent-selector"` (`aria-label="Chọn giọng phát âm tiếng Anh"`) toggling `en-US` (`🇺🇸 Giọng Anh-Mỹ`) vs `en-GB` (`🇬🇧 Giọng Anh-Anh`), conditionally persisted in `lingua-user-settings-v1` only when `preferredAccent !== 'en-US'`.

---

## 2. Subagent Task Partitioning (Strict Non-Overlapping Ownership)

| Subagent | Owned Files | Scope |
|---|---|---|
| **W9-1** (`flash`) | `apps/web/src/features/read/InteractiveReader.tsx`, `apps/web/src/features/read/beginnerLexicon.ts` | Items #1 & #2 (Reader Theme Toggle & Learner Trap Warning) |
| **W9-2** (`flash`) | `apps/web/src/features/review/ReviewSession.tsx`, `apps/web/src/features/brain/LanguageBrainCanvas.tsx` | Items #3 & #4 (Review Sprint Batch Selector & Brain CEFR Distribution) |
| **W9-3** (`flash`) | `apps/web/src/features/dictionary/DictionaryView.tsx`, `apps/web/src/features/library/LibraryView.tsx` | Items #5 & #6 (Dictionary 0.5x Audio & Library Mastery Status Filter) |
| **W9-4** (`flash`) | `apps/web/src/features/today/TodayDashboard.tsx`, `apps/web/src/features/progress/ProgressAnalytics.tsx` | Items #7 & #8 (Today Focus Skill Tag & Progress Streak Shield) |
| **W9-5** (`flash`) | `apps/web/src/features/profile/ProfileView.tsx`, `apps/web/src/features/settings/SettingsView.tsx`, `tests/frontend/wave9-enterprise-upgrades.test.tsx` | Items #9, #10 & Wave 9 Automated Test Suite |
