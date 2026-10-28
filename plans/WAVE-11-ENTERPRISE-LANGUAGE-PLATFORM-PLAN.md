# LINGUA OS — Wave 11 Enterprise Language Platform Plan (Continuous QA Loop Iteration #8 / Cycle 3 of 5)

## 1. Objective
Execute **Cycle 3 of 5 (`Wave 11`)** in the Continuous QA & 10-Point Enterprise Language Platform Upgrade Loop:
1. Verify Wave 10 with `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`) and audit the next 10 highest-leverage pedagogical & UX improvements.
2. Dispatch 5 micro-scoped `Model: 'flash'` worker subagents (`W11-1` .. `W11-5`) with strict non-overlapping file ownership boundaries.
3. Re-verify all tests, typechecks, and lint rules via `qa-web-auditor`.

---

## 2. The 10 Enterprise Upgrades (Wave 11)

### Group W11-1 — Interactive Reader Estimated Reading Time & Grammar Tips Visibility Switch (`InteractiveReader.tsx`)
1. **Estimated Reading Time Pill (`data-testid="reader-estimated-time"`)**:
   - In `InteractiveReader.tsx`, compute estimated reading minutes (`Math.max(1, Math.ceil((passage?.sentences?.length ?? 1) * 0.5))`) and display a calm pill (`⏱️ ~${estimatedReadMinutes} phút đọc`) inside the Reader header.
2. **Grammar Tips Visibility Switch (`data-testid="reader-grammar-tips-toggle"`)**:
   - In `InteractiveReader.tsx`, add state `showGrammarTips` (`true` by default) and a toolbar button (`data-testid="reader-grammar-tips-toggle"`) that lets learners toggle grammar structure tips (`💡 Mẹo ngữ pháp`) on or off when they want a cleaner reading layout.

### Group W11-2 — Smart Review Keyboard Shortcuts Help Pill & Language Brain Due Review Counter (`ReviewSession.tsx`, `LanguageBrainCanvas.tsx`)
3. **Keyboard Shortcuts Quick Reference Pill (`data-testid="review-shortcuts-help"`)**:
   - In `ReviewSession.tsx`, display a compact keyboard shortcut guide pill (`⌨️ Phím tắt: Space (Lật) · 1–4 (Chấm điểm)`) inside the Review header or footer.
4. **Due for Review Node Count Badge (`data-testid="brain-due-count-badge"`)**:
   - In `LanguageBrainCanvas.tsx`, compute `const dueNodesCount = nodes.filter((n) => n.isDueForReview || n.status === 'weak' || n.status === 'forgotten').length;` and render `data-testid="brain-due-count-badge"` (`🔔 Cần ôn ngay: ${dueNodesCount} khái niệm`) in the Brain summary bar.

### Group W11-3 — Dictionary Word Complexity Tag & Library View Density Toggle (`DictionaryView.tsx`, `LibraryView.tsx`)
5. **Word Complexity / Syllable Hint Tag (`data-testid="dictionary-complexity-tag"`)**:
   - In `DictionaryView.tsx`, on each concept card (`visibleLemmaGroups`, `ungroupedResults`, `visibleDirectResults`), render a complexity pill (`data-testid="dictionary-complexity-tag"`) based on term length (`term.length <= 5 ? 'Ngắn · Dễ nhớ' : term.length <= 8 ? 'Trung bình' : 'Từ ghép / Đa âm tiết'`).
6. **Library Compact vs Comfortable Density Toggle (`data-testid="library-density-toggle"`)**:
   - In `LibraryView.tsx`, add state `viewDensity` (`'comfortable' | 'compact'`) and a toolbar button (`data-testid="library-density-toggle"`) toggling between `Chế độ xem: Thoáng` and `Chế độ xem: Thu gọn`, applying `data-view-density={viewDensity}` to the library list container.

### Group W11-4 — Today Goal Completion Percentage Badge & Progress Cadence Insight (`TodayDashboard.tsx`, `ProgressAnalytics.tsx`)
7. **Goal Completion Percentage Badge (`data-testid="today-completion-percent-badge"`)**:
   - In `TodayDashboard.tsx`, inside the `<aside>` goal card, display `data-testid="today-completion-percent-badge"` (`📊 Hoàn thành ${progressPercent}% mục tiêu ngày`).
8. **Study Cadence & Average Session Insight (`data-testid="progress-cadence-insight"`)**:
   - In `ProgressAnalytics.tsx`, inside the `"Nhịp học mỗi ngày"` card, render `data-testid="progress-cadence-insight"` (`⚡ Trung bình ngày có học: ${activeDaysCount > 0 ? Math.round(totalWindowMinutes / activeDaysCount) : 0} phút/buổi`).

### Group W11-5 — Profile Next Achievement Hint, Settings Daily Review Cap & Wave 11 Test Suite (`ProfileView.tsx`, `SettingsView.tsx`, `tests/frontend/wave11-enterprise-upgrades.test.tsx`)
9. **Next Achievement Progress Hint (`data-testid="profile-next-achievement-hint"`)**:
   - In `ProfileView.tsx`, inside `<section data-testid="profile-achievements-grid">`, display a motivating summary pill (`data-testid="profile-next-achievement-hint"`) showing how many badges are unlocked (`🏅 Đã mở khóa ${unlockedCount}/${achievements.length} huy hiệu`).
10. **Daily Review Session Cap Selector (`data-testid="settings-review-cap-selector"`)**:
   - In `SettingsView.tsx`, add state `dailyReviewCap` (`20 | 50 | 100`, default `50`) and a selector group (`data-testid="settings-review-cap-selector"`) with buttons `20 thẻ/ngày`, `50 thẻ/ngày`, `100 thẻ/ngày`. Conditionally persist `dailyReviewCap` to `lingua-user-settings-v1` ONLY when `dailyReviewCap !== 50` so `ten-point-upgrades.test.tsx` default payload shape stays untouched.
   - Create `tests/frontend/wave11-enterprise-upgrades.test.tsx` testing all 10 Wave 11 upgrades.
