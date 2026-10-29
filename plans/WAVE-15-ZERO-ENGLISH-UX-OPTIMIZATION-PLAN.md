# LINGUA OS — Wave 15 Zero-English Novice UX Optimization Plan (Cycle 2 of 5)

## 1. Objective
Execute **Cycle 2 of 5 (`Wave 15`)** of the Zero-English Novice User UX Optimization Loop:
- Address all **10 Novice User Questions, Redundancies & Irrationalities** discovered in the Cycle 2 audit by `zero-english-novice-user` (`9165ab16-78c6-4212-a07e-3868da3e4ef7`).
- Add `tests/frontend/wave15-novice-ux-optimization.test.tsx` verifying all 10 Wave 15 UX improvements while keeping 100% of Wave 1–14 tests passing.

---

## 2. The 10 Novice UX Fixes (Wave 15)

1. **`InteractiveReader.tsx` (Novice Question #1 — Replace "Nhại lại" with Respectful "Luyện nói theo (Shadowing)" & Separate Beginner Toolbar Banner)**:
   - Change `data-testid="reader-shadowing-button"` text from `🗣️ Nhại lại` (which sounds like mocking) to `🗣️ Đọc theo mẫu` (with `aria-label={`Nhại lại câu ${sentenceNumber}`}` preserved for backward accessibility).
   - Move `data-testid="reader-beginner-toolbar-hint"` into its own dedicated top row above the toolbar buttons so it no longer squeezes the 10 toolbar buttons on mobile.
2. **`InteractiveReader.tsx` (Novice Question #2 — Progressive Disclosure for Word Inspector Tips & Replace "Brain" Jargon with "Ôn tập / Kho từ nhớ")**:
   - In the Word Inspector (`selectedToken`), replace `"Đã lưu vào Brain"` with `"Đã lưu vào Kho từ nhớ"` and `"Bấm từ gạch chân để lưu vào Brain"` with `"Bấm từ gạch chân để lưu vào Kho từ nhớ"`.
   - Group the deep linguistic tips (`inspector-word-family`, `inspector-semantic-contrast`, `wave10-irregular-verb-info`) inside a clean styled container (`data-testid="inspector-extended-tips-box"`) with a clear header `📚 Mở rộng vốn từ & Ngữ cảnh` so beginners are not hit with 6 loose warning paragraphs at once.
3. **`ReviewSession.tsx` (Novice Question #3 — Organize Crowded 9-Item Header into 2 Clean Rows: Status HUD vs Action Controls)**:
   - Group the informational HUD badges (`review-remaining-encouragement`, `review-shortcuts-help`, `review-pace-indicator`, `review-session-accuracy-badge`) into a dedicated `data-testid="review-hud-summary-row"` flex container, and group the interactive controls (`wave9-review-batch-size`, `review-audio-feedback-toggle`, `wave10-review-blind-listening-toggle`) into a clean `data-testid="review-controls-row"` so mobile screens never overflow horizontally.
4. **`TodayDashboard.tsx` (Novice Question #4 — Remove Duplicate Activity Ratio Footer in Aside & Clarify "Đánh dấu xong" Button)**:
   - In `<aside>`, remove the duplicate footer row `Hoạt động hoàn tất {completedActivitiesCount} / {totalActivitiesCount}` (since `data-testid="today-activity-ratio-pill"` already shows `✅ Hoàn tất X/Y nhiệm vụ` right above it!).
   - On the `"Đánh dấu xong"` button, add a helpful `title="Bấm khi bạn đã hoàn thành bài học này"` and render a beginner workflow hint (`data-testid="today-action-button-guide"`) explaining `"Bấm 'Bắt đầu' để vào học ngay, hoặc 'Đánh dấu xong' sau khi hoàn tất"`.
5. **`LanguageBrainCanvas.tsx` (Novice Question #5 — Organize 3 Stacked Filter Bars into a Clean Beginner Filter Panel)**:
   - Add a clear section header (`data-testid="brain-filter-guide-label"`, `🧭 Bộ lọc nhanh: Chọn cấp độ (A1–B2), trạng thái thuộc từ hoặc chủ đề bài học`) and wrap the 3 filter rows inside a well-structured, compact filter panel (`data-testid="brain-unified-filter-panel"`) so the visual hierarchy between filters and the Brain canvas is crystal clear.
6. **`DictionaryView.tsx` (Novice Question #6 — Convert Fake Non-Clickable Pill Buttons into Plain Info Text)**:
   - Convert the 3 non-clickable `<span className="rounded-full border ...">Nghĩa tiếng Việt / IPA & từ loại / Ví dụ ngữ cảnh</span>` elements (which looked identical to clickable filter buttons and confused novice users when clicking them did nothing!) into a single non-button informational caption (`data-testid="dictionary-capabilities-caption"`): `📖 Hỗ trợ tra cứu: Nghĩa tiếng Việt • Phiên âm IPA & từ loại • Câu ví dụ thực tế`.
7. **`LibraryView.tsx` (Novice Question #7 — Active Selection Feedback Banner & Organized Toolbar Groups)**:
   - Render a live selection status banner (`data-testid="library-selection-status"`) showing `📌 Đã chọn ${selectedItemKeys.size} mục để sao chép/xuất từ vựng` (or `📌 Chưa chọn mục riêng lẻ — Bấm "Sao chép danh sách" để chép toàn bộ`) so beginners know what selecting items does.
8. **`ProgressAnalytics.tsx` (Novice Question #8 — Fix `ml-2` Mobile Wrapping Misalignment on CEFR Forecast Badges)**:
   - Wrap `data-testid="progress-velocity-forecast"`, `data-testid="progress-retention-status-badge"`, and `data-testid="progress-solidified-ratio"` inside a `<div data-testid="progress-milestone-badges-row" className="mt-2.5 flex flex-wrap items-center gap-2">` and remove the hardcoded `ml-2` classes that caused ragged left-edges when wrapping on mobile screens.
9. **`ProfileView.tsx` & `SettingsView.tsx` (Novice Question #9 — Translate Raw `"medium"` / `"high"` Confidence Value in Profile & Explain FSRS in Settings)**:
   - In `ProfileView.tsx`, translate `profile.startingLevelConfidence` (`'high'` → `'Cao'`, `'medium'` → `'Khá chuẩn'`, `'low'` → `'Cơ bản'`) so the user never sees raw English `"Độ tin cậy ước lượng: medium"` (`data-testid="profile-confidence-badge"`).
   - In `SettingsView.tsx`, update the review cap heading to `"Giới hạn thẻ ôn tập FSRS mỗi ngày (Nhịp nhắc thông minh vừa sức)"`.
10. **`OnboardingDiagnostic.tsx` (Novice Question #10 — Remove Developer Strings `Today API`, `beginner-zero-to-one-bypass-v1`, and `PERSISTENCE_GAPS` Enum Code from Completion Screen)**:
   - Replace `"Today API sẽ cung cấp hoạt động phù hợp"` with `"Kế hoạch Hôm nay sẽ tự động chọn bài học phù hợp nhất cho bạn"`.
   - Replace raw `beginner-zero-to-one-bypass-v1` / `rubricVersion` display with a friendly Vietnamese label (`Lộ trình chuẩn cho người mới bắt đầu`) and replace raw `{PERSISTENCE_GAPS.newConceptBudget}` enum code (`new-concept-budget-v1-gap`) with `"3–5 từ mới/ngày (tự động điều chỉnh theo sức học)"` (`data-testid="onboarding-clean-summary-meta"`).
