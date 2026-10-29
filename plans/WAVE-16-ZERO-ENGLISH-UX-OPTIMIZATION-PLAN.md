# LINGUA OS — Wave 16 Zero-English Novice UX Optimization Plan (Cycle 3 of 5)

## 1. Objective
Execute **Cycle 3 of 5 (`Wave 16`)** of the Zero-English Novice User UX Optimization Loop:
- Address all **10 Novice User Questions, Redundancies & Irrationalities** discovered in the Cycle 3 audit by `zero-english-novice-user` (`9165ab16-78c6-4212-a07e-3868da3e4ef7`).
- Add `tests/frontend/wave16-novice-ux-optimization.test.tsx` verifying all 10 Wave 16 UX improvements while keeping 100% of Wave 1–15 tests passing.

---

## 2. The 10 Novice UX Fixes (Wave 16)

1. **`InteractiveReader.tsx` (Novice Question #1 — Differentiate Reading Time vs Pace Advice & Translate `CEFR A1` Kicker for Beginners)**:
   - Differentiate `data-testid="reader-estimated-time"` (`⏱️ ~${estimatedReadMinutes} phút đọc`) and `data-testid="wave10-reader-wpm-meter"` (`🌱 Khuyên dùng: Đọc chậm từng câu kết hợp nghe mẫu`) so they no longer repeat `~1 phút đọc` twice right next to each other!
   - Next to `CEFR {passage.cefr}` in the Reader header kicker, add a friendly Vietnamese level explanation (`data-testid="reader-cefr-beginner-label"`): `({passage.cefr === 'A1' ? 'Cơ bản cho người mới' : passage.cefr === 'A2' ? 'Sơ cấp thông dụng' : 'Trung cấp'})`.
2. **`beginnerLexicon.ts` (Novice Question #2 — Replace English Linguistic Jargon `(Word family)` & `(False Friend)` with Plain Vietnamese)**:
   - In `beginnerLexicon.ts`, replace `(Word family)` in `WORD_FAMILY_HINTS` with `(Từ cùng gốc)` and replace `(False Friend)` in `FALSE_FRIENDS_TRAPS` with `(Từ dễ nhầm nghĩa)` so zero-English beginners never encounter unexplained English linguistics terminology inside Vietnamese helper notes.
3. **`ReviewSession.tsx` (Novice Question #3 — Add Direct Shortcut Keys `[1]`–`[4]` on Rating Buttons & Clean Up Hidden Batch Button)**:
   - On the 4 FSRS rating buttons (`Quên (Again)`, `Khó (Hard)`, `Tốt (Good)`, `Dễ (Easy)`), display a visible shortcut badge (`[Phím 1]`, `[Phím 2]`, `[Phím 3]`, `[Phím 4]`, `data-testid={`review-key-badge-${option.rating}`}`) directly inside each rating button while preserving the `/Quên \(Again\)/i` button accessible name.
4. **`TodayDashboard.tsx` (Novice Question #4 — Clarify Visual Hierarchy Between Primary "Bắt đầu" & Secondary "Đánh dấu xong")**:
   - On each incomplete activity card in `TodayDashboard.tsx`, add a clear beginner helper badge (`data-testid={`today-step-priority-${activity.id}`}`) next to the primary action button (`👉 Bước chính: Bấm "Bắt đầu" để mở bài học`) so beginners never accidentally click `"Đánh dấu xong"` before studying.
5. **`LanguageBrainCanvas.tsx` (Novice Question #5 — Translate English Exam Jargon `(Listening / Cloze)` & `(Production / Typing)` in Remediation Advice)**:
   - In `computeRemediationAdvice` (`LanguageBrainCanvas.tsx`), replace English exam terms `(Listening / Cloze)` with `(Nghe câu & Điền từ còn thiếu)` and `(Production / Typing)` with `(Tự nhớ lại & Gõ từ vựng)`.
6. **`DictionaryView.tsx` (Novice Question #6 — Friendly Vietnamese Empty-Related Copy & Clear Multi-Syllable Explanation)**:
   - Replace cold database-style text `'Chưa có khái niệm liên kết được duyệt.'` with friendly learner copy `'Chưa có từ liên quan mở rộng cho mục này.'`.
   - In `getWordComplexityLabel(term)` (`DictionaryView.tsx`), change `'Đa âm tiết'` to `'Từ dài (Đọc chậm từng âm)'` so beginners without phonetics training immediately know how to approach longer words.
7. **`LibraryView.tsx` (Novice Question #7 — Display Vietnamese Meaning Directly on Saved Concept Cards)**:
   - In `LibraryView.tsx`, import `lookupBeginnerWord` from `../read/beginnerLexicon` and on every saved `'concept'` card, render its Vietnamese meaning (`(item as { meaningVi?: string }).meaningVi ?? lookupBeginnerWord(item.title)?.meaningVi ?? 'Từ vựng đã lưu trong kho cá nhân'`) inside `<p data-testid="library-concept-meaning-vi" className="mt-1 text-sm font-semibold text-[var(--action-primary)]">` so zero-English beginners can see the Vietnamese meaning right on the Library card!
8. **`ProgressAnalytics.tsx` (Novice Question #8 — Explain 85% Memory Retention Rate in Practical Everyday Terms)**:
   - In `ProgressAnalytics.tsx`, add a practical beginner explanation (`data-testid="progress-retention-practical-meaning"`) inside the Retention / Milestone section: `🎯 Ý nghĩa thực tế: Với tỷ lệ nhớ ${avgRetention}%, cứ 10 từ đã học thì bạn nhận ra ngay khoảng ${Math.round(avgRetention / 10)} từ khi gặp lại trong bài đọc.`
9. **`ProfileView.tsx` & `SettingsView.tsx` (Novice Question #9 — Replace "khái niệm ngôn ngữ" with "từ vựng" + Show Achievement Progress `(X/Y)` & Reassuring Browser Storage Note)**:
   - In `ProfileView.tsx`, update achievement descriptions in `achievements` from `"khái niệm ngôn ngữ"` / `"khái niệm"` to `"từ vựng tiếng Anh"` and render a live progress counter (`data-testid={`profile-badge-progress-${badge.id}`}`, e.g. `Tiến độ: ${Math.min(current, target)}/${target}`) on each achievement badge!
   - In `SettingsView.tsx`, add a reassuring browser storage note (`data-testid="settings-storage-reassurance"`): `🔒 Tùy chọn âm thanh, giọng đọc và cỡ chữ của bạn luôn được lưu an toàn ngay trên trình duyệt này.`
10. **`OnboardingDiagnostic.tsx` (Novice Question #10 — Replace Duplicate Summary Pills in `onboarding-clean-summary-meta` with Actionable Day-1 Beginner Advice)**:
   - In `OnboardingDiagnostic.tsx`, inside `data-testid="onboarding-clean-summary-meta"`, replace the duplicate method/budget pills (which were already shown in the 4-card grid right above it!) with an actionable Day-1 study tip: `🌟 Lời khuyên Ngày 1: Bạn chỉ cần dành 5–10 phút mở bài đọc đầu tiên, bấm nghe mẫu câu và chạm vào 3 từ mới để làm quen.`
