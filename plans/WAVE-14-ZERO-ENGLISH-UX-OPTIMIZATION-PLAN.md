# LINGUA OS — Wave 14 Zero-English Novice UX Optimization Plan (Cycle 1 of 5)

## 1. Objective
Execute **Cycle 1 of 5 (`Wave 14`)** of the Zero-English Novice User UX Optimization Loop:
- Address all **10 Novice User Questions, Redundancies & Irrationalities** discovered by `zero-english-novice-user` (`9165ab16-78c6-4212-a07e-3868da3e4ef7`).
- Fix the 2 visual-redundancy test regressions in `tests/frontend/integration.test.tsx` (duplicate `/əˈpɔɪnt.mənt/` regex match) and `tests/frontend/e2e/f10-library-dictionary.test.tsx` (`span.font-mono` count on non-lexical grammar concepts).
- Add `tests/frontend/wave14-novice-ux-optimization.test.tsx` verifying all 10 UX improvements and zero-jargon beginner explanations.

---

## 2. The 10 Novice UX Fixes (Wave 14)

1. **`InteractiveReader.tsx` (Novice Question #1 — Conflicting Reading Time Clocks & "wpm" Jargon)**:
   - Unify `estimatedReadMinutes` across both `data-testid="reader-estimated-time"` and `data-testid="wave10-reader-wpm-meter"` so they never show two contradictory numbers side-by-side, and replace technical `"wpm"` with plain Vietnamese encouragement (`⏱️ ~${estimatedReadMinutes} phút đọc thong thả`).
2. **`beginnerLexicon.ts` & `InteractiveReader.tsx` (Novice Question #2 — Duplicate IPA Slash String in Trap Warning & Cluttered 10-Button Toolbar)**:
   - In `beginnerLexicon.ts`, update `appointment` in `FALSE_FRIENDS_TRAPS` and `LEARNER_TRAP_WARNINGS` to use Vietnamese phonetic spelling `(ơ-POIN-mần)` instead of repeating `/əˈpɔɪnt.mənt/` (which caused `integration.test.tsx` `getByText(/\/əˈpɔɪnt\.mənt\//i)` to find multiple elements!).
   - In `InteractiveReader.tsx`, add a collapsible/clean beginner grouping (`data-testid="reader-beginner-toolbar-hint"`) with plain Vietnamese guidance so the toolbar is visually organized.
3. **`ReviewSession.tsx` (Novice Question #3 — Unexplained "FSRS", "Nghe mù", and Pressure-Inducing Pace Badge)**:
   - Replace cryptic `"Nghe mù"` label with beginner-friendly `"🎧 Luyện nghe đoán từ (Nghe mù)"`, add plain-Vietnamese explanation for FSRS (`Ghi nhớ thông minh FSRS`), and soften `data-testid="review-pace-indicator"` (`⏱️ Nhịp chuẩn: ~8s/thẻ · Cứ thong thả nhớ lại`).
4. **`TodayDashboard.tsx` (Novice Question #4 — English "Spaced Retrieval" Jargon & Duplicate Focus/Activity Counters)**:
   - Replace English `"Spaced Retrieval"` in `focusSkillLabel` with plain Vietnamese `"Ôn tập ngắt quãng nhớ lâu"`, and align `wave9-today-skill-focus` and `today-focus-skill-badge` so they complement each other without contradictory labels.
5. **`LanguageBrainCanvas.tsx` (Novice Question #5 — Duplicate Search Inputs & Unexplained "Collocations")**:
   - Merge the duplicate search inputs so there is a single clean search input carrying both `id="brain-concept-search"` and `data-testid="brain-node-search"`, and clarify `"Collocations"` in plain Vietnamese (`🔗 Cụm từ thường đi kèm (Collocations — Giúp ghép câu tự nhiên)`).
6. **`DictionaryView.tsx` (Novice Question #6 — `span.font-mono` Complexity Tag Breaking Non-Lexical Grammar Cards & Unclear Slow Audio Buttons)**:
   - Change `data-testid="dictionary-complexity-tag"` from `<span className="... font-mono ...">` to `<div data-testid="dictionary-complexity-tag" className="... font-sans ...">` (and only render it for lexical words or without `span.font-mono`) so `tests/frontend/e2e/f10-library-dictionary.test.tsx` (`container.querySelectorAll('span.font-mono').toHaveLength(0)`) passes 100%!
   - Clarify `0.75x` vs `0.5x` button tooltips/labels for beginners.
7. **`LibraryView.tsx` (Novice Question #7 — Beginner Empty-State Guidance & Filter Clarity)**:
   - Add a clear beginner tip banner (`data-testid="library-beginner-tip"`) explaining in plain Vietnamese how saved words and sentences from the Reader and Dictionary appear here and how to review them.
8. **`ProgressAnalytics.tsx` (Novice Question #8 — Unexplained CEFR A1/A2/B1 & FSRS Terms)**:
   - Add a plain-Vietnamese beginner legend (`data-testid="progress-cefr-beginner-note"`) inside `data-testid="progress-cefr-milestone"` explaining `A1 (Cơ bản cho người mới) → A2 (Giao tiếp hàng ngày) → B1 (Đọc hiểu tự tin)`.
9. **`ProfileView.tsx` & `SettingsView.tsx` (Novice Question #9 — Nested Duplicate `role="group"` Accent Wrapper & reassuring Settings Banner)**:
   - In `SettingsView.tsx`, remove the redundant nested `role="group"` wrapper around `settings-accent-selector` / `wave9-settings-accent-selector` (keep both `data-testid`s clean without double `role="group"` nesting), and keep `chưa được lưu lâu dài` while adding reassuring beginner context.
10. **`OnboardingDiagnostic.tsx` (Novice Question #10 — Internal Developer Code `ADR-009` & English `Diagnostic Placement / Bằng chứng recognition` Leaking to Novice Users)**:
   - Remove internal developer jargon `(ADR-009)`, translate `Diagnostic Placement` to `"Chẩn đoán trình độ khởi điểm"`, and map raw English skill keys (`recognition`, `comprehension`, `listening`, `production`) in `Bằng chứng ${skill}` to plain Vietnamese (`Nhận diện từ vựng`, `Đọc hiểu ngữ cảnh`, `Nghe hiểu`, `Phản xạ`).
