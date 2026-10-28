# LINGUA OS — Wave 13 Enterprise Language Platform Plan (Continuous QA Loop Iteration #10 / Cycle 5 of 5)

## 1. Objective
Execute **Cycle 5 of 5 (`Wave 13`)** in the Continuous QA & 10-Point Enterprise Language Platform Upgrade Loop:
1. Verify Wave 12 with `qa-web-auditor` (`f8c8b5be-bb93-4530-9dd0-2324116d33c8`) and audit the final 10 enterprise language platform upgrades.
2. Dispatch 5 micro-scoped `Model: 'flash'` worker subagents (`W13-1` .. `W13-5`) with strict non-overlapping file ownership boundaries.
3. Run final certification across Waves 1–13 via `qa-web-auditor`, update `STATUS.md`, and push directly to `origin/master`.

---

## 2. The 10 Enterprise Upgrades (Wave 13)

### Group W13-1 — Interactive Reader 1-Click Copy Sentence & Inspector Dictionary Link (`InteractiveReader.tsx`)
1. **1-Click Copy Sentence & Translation Button (`data-testid="reader-copy-sentence"`)**:
   - In `InteractiveReader.tsx`, inside each sentence's action bar, add a compact button (`📋 Chép câu`, `data-testid="reader-copy-sentence"`) that copies the English sentence and its Vietnamese translation to `navigator.clipboard.writeText` and displays `Đã chép` feedback.
2. **Word Inspector Quick Jump to Dictionary (`data-testid="inspector-open-dictionary-link"`)**:
   - In `InteractiveReader.tsx`, inside the Word Inspector dialog (`selectedToken`), render a quick action button (`🔎 Mở trong Từ điển`, `data-testid="inspector-open-dictionary-link"`) that navigates to `/dictionary` via `clientNavigate('/dictionary')`.

### Group W13-2 — Smart Review Remaining Encouragement Pill & Language Brain Filter Reset (`ReviewSession.tsx`, `LanguageBrainCanvas.tsx`)
3. **Remaining Queue Encouragement Pill (`data-testid="review-remaining-encouragement"`)**:
   - In `ReviewSession.tsx`, display a dynamic encouragement pill (`💪 Còn ${Math.max(0, totalCards - currentIndex)} thẻ trong hàng đợi`) in the Review header.
4. **Language Brain 1-Click Filter & Search Reset Button (`data-testid="brain-reset-filters"`)**:
   - In `LanguageBrainCanvas.tsx`, when `statusFilter !== 'all'` or `searchQuery.trim() !== ''`, render a reset button (`data-testid="brain-reset-filters"`, `Đặt lại bộ lọc mạng lưới`) that resets both `statusFilter` to `'all'` and `searchQuery` to `''`.

### Group W13-3 — Dictionary Saved Concepts Counter & Library Start Review Link (`DictionaryView.tsx`, `LibraryView.tsx`)
5. **Dictionary Saved Concepts Counter Badge (`data-testid="dictionary-saved-counter"`)**:
   - In `DictionaryView.tsx`, compute total saved concepts (`initialConcepts.filter((c) => c.saved || savedConceptIds[c.id]).length`) and render `data-testid="dictionary-saved-counter"` (`⭐ Đã lưu ${savedCount} khái niệm`) in the Dictionary header.
6. **Library Quick Jump to Smart Review (`data-testid="library-start-review-link"`)**:
   - In `LibraryView.tsx`, inside the Library header or toolbar, render a button (`data-testid="library-start-review-link"`, `⚡ Ôn tập từ đã lưu`) that navigates to `/review` via `clientNavigate('/review')`.

### Group W13-4 — Today Consistency Tip Callout & Progress Copy Report Button (`TodayDashboard.tsx`, `ProgressAnalytics.tsx`)
7. **Daily Consistency Tip Callout (`data-testid="today-consistency-tip"`)**:
   - In `TodayDashboard.tsx`, inside the `<aside>` goal card, render `data-testid="today-consistency-tip"` (`💡 Mẹo duy trì: Học đều 15 phút mỗi ngày hiệu quả gấp 3 lần học dồn cuối tuần`).
8. **1-Click Copy Progress Report Summary (`data-testid="progress-copy-report"`)**:
   - In `ProgressAnalytics.tsx`, inside the header, add a button (`data-testid="progress-copy-report"`, `📋 Sao chép báo cáo tiến độ`) that copies a concise Vietnamese summary of `wordsSolidified`, `avgMinutes`, and `avgRetention` to clipboard and shows `Đã sao chép báo cáo`.

### Group W13-5 — Profile Learning Status Badge, Settings Reset Preferences & Wave 13 Test Suite (`ProfileView.tsx`, `SettingsView.tsx`, `tests/frontend/wave13-enterprise-upgrades.test.tsx`)
9. **Active Learner Account Status Badge (`data-testid="profile-account-status-badge"`)**:
   - In `ProfileView.tsx`, inside the profile header card, render `data-testid="profile-account-status-badge"` (`🟢 Trạng thái: Đang hoạt động tích cực`).
10. **Reset Local Preferences to Default Button (`data-testid="settings-reset-defaults"`)**:
   - In `SettingsView.tsx`, inside the action footer (next to `Lưu thay đổi`), render a button (`data-testid="settings-reset-defaults"`, `Khôi phục mặc định`) that resets `defaultSpeechRate` to `1`, `preferredReminderTime` to `'off'`, `preferredAccent` to `'en-US'`, `dailyReviewCap` to `50`, `reducedMotion` to `false`, and `audioAutoplay` to `true`.
   - Create `tests/frontend/wave13-enterprise-upgrades.test.tsx` testing all 10 Wave 13 upgrades.
