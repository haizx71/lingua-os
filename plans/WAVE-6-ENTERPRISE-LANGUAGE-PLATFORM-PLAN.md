# WAVE 6: Enterprise Language Platform Upgrade Plan (Continuous QA Loop — Iteration 2)

**Status:** In Progress  
**Date:** 2026-10-28  
**QA Auditor Subagent:** `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`)  
**Worker Subagents:** 5 micro-scoped `Model: 'flash'` workers (`W6-1` .. `W6-5`)

---

## 1. 10-Point Enterprise Language Platform Audit Findings (Wave 6)

1. **CEFR Milestone Estimator & Band Mastery Gauge (`ProgressAnalytics.tsx`)**:
   - Render `data-testid="progress-cefr-milestone"` mapping `wordsSolidified` against CEFR vocabulary milestones (`A1: 50`, `A2: 200`, `B1: 500` words) with a visual progress bar and encouraging Vietnamese guidance.
2. **Active Days & Habit Consistency Strip (`ProgressAnalytics.tsx`)**:
   - Render `data-testid="progress-consistency-strip"` displaying active study days vs total days in the selected window (`7 ngày` / `30 ngày`).
3. **Pedagogical Milestone Badges & Achievements Showcase (`ProfileView.tsx`)**:
   - Render `data-testid="profile-achievements-grid"` (`aria-label="Huy hiệu học tập"`) derived deterministically from `totalConceptsEncountered`, `totalConceptsMastered`, and `streakDays` (`🌱 Khởi đầu vững chắc`, `🔥 Kiên trì bền bỉ`, `📖 Độc giả chăm chỉ`, `🧠 Trí nhớ vững vàng`).
4. **Quick Goal & Timezone Action Link (`ProfileView.tsx`)**:
   - Render `data-testid="profile-edit-goal-link"` (`Chỉnh sửa mục tiêu & múi giờ`) inside the `"Mục tiêu học tập"` card using `clientNavigate('/settings')`.
5. **Auditory Question & Option Playback (`OnboardingDiagnostic.tsx`)**:
   - Render `data-testid="onboarding-speak-prompt"` next to the active diagnostic question prompt so learners can hear the English sentence/prompt spoken aloud (`en-US`).
6. **Multi-Skill Diagnostic Competence Breakdown (`OnboardingDiagnostic.tsx`)**:
   - Render `data-testid="onboarding-skill-breakdown"` on the completion screen (`Nhận diện từ vựng`, `Đọc hiểu ngữ cảnh`, `Cấu trúc & Cụm từ`) tailored to the learner's calibrated level.
7. **Sentence Audio Shadowing / Echo Repeat (`InteractiveReader.tsx`)**:
   - Render `data-testid="reader-shadowing-button"` (`aria-label="Nhại lại câu ${sentenceNumber}"`) per sentence row that speaks the sentence at `1.0x` and queues a `0.75x` slow echo repeat for pronunciation shadowing.
8. **Post-Passage Immediate Recall Micro-Check (`InteractiveReader.tsx`)**:
   - Inside the `passage.progress?.isCompleted` completion banner, render `data-testid="reader-completion-recall"` showing up to 3 concepts from the passage as interactive flip-pills while preserving existing banner text and links.
9. **Tactile Card Flip State & Reveal Polish (`ReviewSession.tsx`)**:
   - Expose `data-card-flipped={isAnswerRevealed ? 'true' : 'false'}` on the active review card container with smooth transition styling when `!prefersReducedMotion`.
10. **Recent Search History Chips (`DictionaryView.tsx`)**:
    - Render `data-testid="dictionary-recent-searches"` and `data-testid="dictionary-clear-history"` (`Xóa lịch sử`) so learners can quickly revisit recently searched or clicked starter terms.

---

## 2. Subagent Task Partitioning (Strict Non-Overlapping Ownership)

| Subagent | Owned Files | Scope |
|---|---|---|
| **W6-1** (`flash`) | `apps/web/src/features/progress/ProgressAnalytics.tsx` | Items #1 & #2 (CEFR Milestone Gauge & Habit Consistency Strip) |
| **W6-2** (`flash`) | `apps/web/src/features/profile/ProfileView.tsx` | Items #3 & #4 (Milestone Badges Grid & Quick Settings Link) |
| **W6-3** (`flash`) | `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx` | Items #5 & #6 (Auditory Prompt Playback & Multi-Skill Breakdown) |
| **W6-4** (`flash`) | `apps/web/src/features/read/InteractiveReader.tsx`, `apps/web/src/features/review/ReviewSession.tsx` | Items #7, #8 & #9 (Sentence Shadowing, Post-Passage Recall Micro-Check, Card Flip State) |
| **W6-5** (`flash`) | `apps/web/src/features/dictionary/DictionaryView.tsx`, `tests/frontend/wave6-enterprise-upgrades.test.tsx` | Item #10 (Recent Search History Chips) & Wave 6 Automated Test Suite |
