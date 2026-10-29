# WAVE 17 (Cycle 4 of 5) — Zero-English Novice User UX Optimization Plan

## Overview
- **Goal**: Resolve the 10 Cycle 4 novice questions and UX irrationalities identified by `zero-english-novice-user` across all 10 LINGUA OS frontend screens while preserving 100% of existing test assertions (`wave9`..`wave16`, `f10`, `f11`, `contracts.test.ts`).
- **Verification Target**: `tests/frontend/wave17-novice-ux-optimization.test.tsx` + all existing suites green.

## 5 Parallel Worker Subagent Scopes (Strict Non-Overlapping File Ownership)

1. **`W17-1` (`apps/web/src/features/read/InteractiveReader.tsx`, `apps/web/src/features/read/beginnerLexicon.ts`)**:
   - **Novice Question #1 (`InteractiveReader.tsx`)**:
     - Remove English `" (Zen Mode)"` from `data-testid="reader-focus-mode-toggle"` `aria-label` so it reads `aria-label="Bật/tắt chế độ đọc tập trung"`.
     - Add visible Vietnamese label `<span data-testid="reader-save-sentence-label" className="ml-1 text-xs">{isSaved ? 'Đã lưu câu' : '📌 Lưu câu'}</span>` inside the sentence bookmark button (while preserving `aria-label={isSaved ? 'Bỏ lưu câu ...' : 'Lưu câu ...'}`).
   - **Novice Question #2 (`beginnerLexicon.ts`)**:
     - In `WORD_FAMILY_HINTS`, replace English part-of-speech abbreviations `(adj - theo lịch)` -> `(tính từ: theo lịch)`, `(n)` -> `(danh từ)`, `(v)` -> `(động từ)`, and replace academic `"các hậu tố thường gặp"` with `"các đuôi từ thường gặp"`.
     - In `SEMANTIC_CONTRAST_TIPS`, replace academic `"Cùng trường nghĩa:"` with `"Cùng chủ đề:"` (while preserving `"Liên kết ngữ nghĩa"` in the fallback and `'evening'` / `'cold'` for `wave12` test compatibility).

2. **`W17-2` (`apps/web/src/features/review/ReviewSession.tsx`, `apps/web/src/features/today/TodayDashboard.tsx`)**:
   - **Novice Question #3 (`ReviewSession.tsx`)**:
     - Add a Vietnamese part-of-speech mapper (`mapPosToVietnamese`) so `currentCard.pos` / `currentCard.partOfSpeech` (`noun`, `verb`, `adjective`, `adverb`) renders in Vietnamese (`Danh từ`, `Động từ`, `Tính từ`, `Trạng từ`) inside `<span data-testid="review-card-pos-vi">({mapPosToVietnamese(currentCard.pos)})</span>`.
     - Clarify `"Hệ thống FSRS"` tooltip to `"Hệ thống ghi nhớ thông minh (FSRS)"`. (Keep `wave10-review-blind-listening-toggle` text intact for `wave14` test compatibility.)
   - **Novice Question #4 (`TodayDashboard.tsx`)**:
     - Differentiate `data-testid="wave9-today-skill-focus"` (`🎯 Mục tiêu chính hôm nay: {focusSkillLabel}`) and `data-testid="today-focus-skill-badge"` (`🧭 Phương pháp gợi ý: {focusSkillLabel}`) so they don't look like duplicate `"Trọng tâm"` pills.
     - Replace technical `'FSRS phát hiện từ sắp quên.'` in default/fallback `reasonText` display with beginner-friendly `'Hệ thống phát hiện từ sắp quên (Cần ôn lại).'` via a helper `formatActivityReasonVi(activity.reasonText)`.

3. **`W17-3` (`apps/web/src/features/brain/LanguageBrainCanvas.tsx`, `apps/web/src/features/dictionary/DictionaryView.tsx`)**:
   - **Novice Question #5 (`LanguageBrainCanvas.tsx`)**:
     - Change the `'all'` label in `FILTER_OPTIONS` from `'Tất cả'` to `'Tất cả trạng thái'` so beginners don't see two ambiguous `'Tất cả'` buttons (`Tất cả CEFR` vs `Tất cả trạng thái`).
     - Map `visibleSelectedNode.pos` (`noun`, `verb`, `adjective`, `adverb`) to Vietnamese (`Danh từ`, `Động từ`, `Tính từ`, `Trạng từ`) in the concept detail drawer (`data-testid="brain-selected-pos-vi"`). (Keep `brain-related-collocations` text intact for `wave14` test compatibility.)
   - **Novice Question #6 (`DictionaryView.tsx`)**:
     - Replace academic `"để phân tích âm vị"` in `0.5x` slow audio buttons (`aria-label` and `title`) with `"để nghe rõ từng âm tiết"`.
     - Add a clear Vietnamese label `<span data-testid="dictionary-matched-forms-label" className="text-[11px] font-semibold text-[var(--text-muted)]">Các dạng của từ:</span>` before `group.matchedForms` badges.

4. **`W17-4` (`apps/web/src/features/library/LibraryView.tsx`, `apps/web/src/features/progress/ProgressAnalytics.tsx`)**:
   - **Novice Question #7 (`LibraryView.tsx`)**:
     - Update `'Mở trong Reader'` button text to `'📖 Mở bài đọc (Reader)'` and `'Xem trong Brain'` button text to `'🧠 Xem bản đồ từ (Brain)'` (keeping `"Reader"` and `"Brain"` substrings so any existing regex matcher passes while giving clear Vietnamese labels first!).
   - **Novice Question #8 (`ProgressAnalytics.tsx`)**:
     - In `cefrMilestone`, add Vietnamese names alongside CEFR bands: `'A1 Căn bản (Beginner)'`, `'A2 Sơ cấp (Elementary)'`, `'B1 Trung cấp (Intermediate)'`.
     - In `data-testid="progress-best-day-badge"`, replace `(${peakDay.minutesSpent}m)` with `(${peakDay.minutesSpent} phút)`.

5. **`W17-5` (`apps/web/src/features/profile/ProfileView.tsx`, `apps/web/src/features/settings/SettingsView.tsx`, `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx`, `tests/frontend/wave17-novice-ux-optimization.test.tsx`)**:
   - **Novice Question #9 (`ProfileView.tsx` & `SettingsView.tsx`)**:
     - In `ProfileView.tsx`, replace abbreviated `'10p'`, `'20p'`, `'45p'` in the pace bar labels with `'10 phút'`, `'20 phút'`, `'45 phút'`, and add a beginner explanation note (`data-testid="profile-solidified-beginner-note"`) below `'trên ... khái niệm đã gặp được ghi nhận là đã củng cố.'` (keeping that exact sentence for `f11-settings-profile.test.tsx`).
     - In `SettingsView.tsx`, keep `'Ngân sách từ mới mỗi ngày'` intact (for `f11-settings-profile.test.tsx`) and add `data-testid="settings-budget-beginner-note"` (`💡 Giải thích: Số lượng từ tiếng Anh mới tối đa bạn muốn học thêm mỗi ngày (không phải chi phí tiền bạc).`), and replace `'Giọng phát âm ưu tiên (Accent)'` with `'Giọng phát âm ưu tiên (Chuẩn Anh-Mỹ hoặc Anh-Anh)'`.
   - **Novice Question #10 (`OnboardingDiagnostic.tsx`)**:
     - Translate raw `'A1 Beginner'` and `'A2 Elementary'` on the completion screen (`data-testid="onboarding-level-label-vi"`) into `'A1 Cơ bản (Dành cho người mới bắt đầu)'` and `'A2 Sơ cấp (Giao tiếp cơ bản)'`.
   - **Test Suite (`tests/frontend/wave17-novice-ux-optimization.test.tsx`)**:
     - Comprehensive Vitest test suite verifying all 10 Wave 17 Novice UX fixes.
