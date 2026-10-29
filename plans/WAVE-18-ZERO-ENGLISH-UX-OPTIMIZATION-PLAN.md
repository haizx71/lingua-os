# WAVE 18 (Cycle 5 of 5 — Final Cycle) — Zero-English Novice User UX Optimization Plan

## Overview
- **Goal**: Resolve the final 10 Cycle 5 novice UX polish points identified by `zero-english-novice-user` across all 10 LINGUA OS frontend screens so that `zero-english-novice-user` certifies **0 remaining novice questions (`0 câu hỏi tồn đọng — PASS`)**, while keeping 100% of existing tests (`wave9`..`wave17`, `f10`, `f11`, `contracts.test.ts`) green.

## 5 Parallel Worker Subagent Scopes (Strict Non-Overlapping File Ownership)

1. **`W18-1` (`apps/web/src/features/read/InteractiveReader.tsx`, `apps/web/src/features/read/beginnerLexicon.ts`)**:
   - **Novice Question #1 (`InteractiveReader.tsx`)**:
     - Unify the Word Inspector save button label: when saved, render `'Đã lưu vào ôn tập (Kho từ nhớ)'` (`data-testid="inspector-saved-status-label"`) so it directly matches `'Lưu vào ôn tập'` while keeping `'Kho từ nhớ'` for Wave 15 compatibility.
     - Update `<summary>Định nghĩa tiếng Anh</summary>` inside the Word Inspector to `<summary data-testid="inspector-english-def-summary" ...>Định nghĩa gốc tiếng Anh (Tham khảo nâng cao)</summary>`.
   - **Novice Question #2 (`beginnerLexicon.ts`)**:
     - In `WORD_FAMILY_HINTS['tea']`, standardize `'Họ từ & từ ghép:'` to `'Họ từ (Từ cùng gốc) & từ ghép: teapot (ấm trà), teacup (tách trà), teahouse (quán trà).'`.
     - In `SEMANTIC_CONTRAST_TIPS`, replace academic `'Đối lập ngữ nghĩa:'` with `'Từ trái nghĩa:'` (while keeping `'Liên kết ngữ nghĩa'` in the fallback string `Mẹo liên kết từ vựng (Liên kết ngữ nghĩa): ...` so `wave12` passes 100%).

2. **`W18-2` (`apps/web/src/features/review/ReviewSession.tsx`, `apps/web/src/features/today/TodayDashboard.tsx`)**:
   - **Novice Question #3 (`ReviewSession.tsx`)**:
     - Replace the ambiguous `{displayDueCount} còn lại` badge in `<header>` with `<Badge variant="warning" data-testid="review-total-due-badge">Tổng cần ôn: {displayDueCount} thẻ</Badge>`.
     - Clarify the `Space` key for Vietnamese beginners: in `data-testid="review-shortcuts-help"`, render `'⌨️ Phím tắt: Space (Lật) · 1–4 (Chấm) · Phím Cách = Space'`, and on the reveal button render `'Hiện đáp án (Phím Cách / Space)'`.
   - **Novice Question #4 (`TodayDashboard.tsx`)**:
     - Update `data-testid={`today-step-priority-${activity.id}`}` so it matches the actual blue button labels (`Mở bài đọc`, `Bắt đầu ôn tập`, `Bắt đầu`) while preserving the Wave 16 regex `/👉 Bước chính: Bấm .*Bắt đầu.* để vào bài học/`:
       `👉 Bước chính: Bấm nút màu xanh (“Bắt đầu” / “Mở bài”) để vào bài học`

3. **`W18-3` (`apps/web/src/features/brain/LanguageBrainCanvas.tsx`, `apps/web/src/features/dictionary/DictionaryView.tsx`)**:
   - **Novice Question #5 (`LanguageBrainCanvas.tsx`)**:
     - In the concept detail drawer, remove the duplicate raw English `<span className="font-mono">{visibleSelectedNode.pos}</span>` right before `data-testid="brain-selected-pos-vi"` so only the Vietnamese POS badge (`[Danh từ]`, etc.) is shown.
     - Prefix the CEFR badge in the concept detail drawer (`data-testid="brain-selected-cefr-badge"`): `Cấp độ: {visibleSelectedNode.cefr}`.
   - **Novice Question #6 (`DictionaryView.tsx`)**:
     - In `data-testid="dictionary-saved-counter"`, render `⭐ Đã lưu {totalSavedConceptsCount} khái niệm (từ vựng)` (keeping `⭐ Đã lưu ... khái niệm` for `wave13` while clarifying `(từ vựng)`).
     - Replace `'Độ vững:'` in related concepts with `'Mức độ ghi nhớ:'` (`data-testid="dictionary-related-mastery-label"`).

4. **`W18-4` (`apps/web/src/features/library/LibraryView.tsx`, `apps/web/src/features/progress/ProgressAnalytics.tsx`)**:
   - **Novice Question #7 (`LibraryView.tsx`)**:
     - On saved concept cards, add a Vietnamese part-of-speech mapper (`formatLibraryPosVi`) so `item.partOfSpeech` (`noun`, `verb`, `adjective`, `adverb`) renders in Vietnamese (`Danh từ`, `Động từ`, `Tính từ`, `Trạng từ`) inside `data-testid="library-concept-pos-vi"`.
     - Prefix the concept level badge (`data-testid="library-concept-level-badge"`): `Cấp độ: {item.level}`.
   - **Novice Question #8 (`ProgressAnalytics.tsx`)**:
     - Expand abbreviated `'Ghi nhớ TB:'` to `'Ghi nhớ trung bình:'` (`data-testid="progress-avg-retention-pill"`) and `'⚡ TB buổi học:'` to `'⚡ Trung bình buổi học:'` (`data-testid="progress-session-efficiency"`).

5. **`W18-5` (`apps/web/src/features/profile/ProfileView.tsx`, `apps/web/src/features/settings/SettingsView.tsx`, `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx`, `tests/frontend/wave18-novice-ux-optimization.test.tsx`)**:
   - **Novice Question #9 (`ProfileView.tsx` & `SettingsView.tsx`)**:
     - In `ProfileView.tsx`, update the heading `'Khái niệm đã củng cố'` to `'Từ vựng đã củng cố vững (Khái niệm đã củng cố)'` (`data-testid="profile-solidified-heading-vi"`) and update `data-testid="profile-open-brain-link"` text to `'🧠 Mở bản đồ Language Brain (Bản đồ từ vựng)'` (preserving `'🧠 Mở bản đồ Language Brain'` substring for `wave12`).
     - In `SettingsView.tsx`, add a beginner explanation note (`data-testid="settings-fsrs-cap-beginner-note"`) right inside `data-testid="settings-review-cap-selector"`: `'💡 Giải thích: Hệ thống chỉ đưa ra tối đa số thẻ này mỗi ngày để bạn không bao giờ bị quá tải bài ôn.'`.
   - **Novice Question #10 (`OnboardingDiagnostic.tsx`)**:
     - Replace `'Ngân sách từ mới:'` in `data-testid="onboarding-clean-summary-meta"` with `<span data-testid="onboarding-budget-label-vi">Mục tiêu từ mới mỗi ngày: {isBeginnerCalibration ? '3–5 từ mới/ngày (vừa sức cho người mới)' : '5–8 từ mới/ngày'}</span>`.
   - **Test Suite (`tests/frontend/wave18-novice-ux-optimization.test.tsx`)**:
     - Comprehensive Vitest test suite verifying all 10 Wave 18 Novice UX polish items.
