# LINGUA OS — Wave 2: 10-Point System Upgrade & Real Postgres Verification Plan

- **Date**: 2026-10-17
- **Status**: COMPLETED & VERIFIED (53/53 Frontend Vitest files [672/672 tests], 78/78 Knowledge tests, 54/54 Backend + Real PostgreSQL tests, `ruff`, `mypy`, `typecheck`, `lint`, `next build`, and `git diff --check` PASS)
- **Execution Mode**: Parallel Multi-Subagent (`Model: 'flash'` — Gemini Flash tier for maximum cost efficiency)
- **Prerequisite Baseline**: Wave 0 (Archive Takeover) + Wave 1 (First 10-Point Upgrade) completed and verified (78/78 Knowledge tests, 662/662 Frontend Vitest tests, Backend unit & real Postgres tests passing).

---

## 1. Scope & The 10 Wave 2 Upgrades

| # | Subsystem | Issue / Upgrade | Target Files | Subagent |
|---|---|---|---|---|
| **1** | `@lingua/ui` Accessibility & Motion | **`usePrefersReducedMotion()` ignores in-app `dataset.reducedMotion` toggle**: Update `getSnapshot()` and `subscribe()` in `usePrefersReducedMotion.ts` to combine `window.matchMedia('(prefers-reduced-motion: reduce)').matches` with `document.documentElement.dataset.reducedMotion === 'true'` and observe `data-reduced-motion` attribute changes via `MutationObserver`. | `packages/ui/src/hooks/usePrefersReducedMotion.ts` | **Subagent W2-B** |
| **2** | Frontend (`ReviewSession`) | **Keyboard Shortcut Bug (`1`–`4` drops `responseText` in `typing`/`cloze` mode & `Enter` key in input)**: Fix `handleKeyDown` in `ReviewSession.tsx` so keys `1`–`4` pass `needsTextResponse ? responseText : undefined` to `submitRating(...)`, and allow pressing `Enter` inside `<input aria-label="Câu trả lời">` to reveal the answer. | `apps/web/src/features/review/ReviewSession.tsx` | **Subagent W2-B** |
| **3** | Frontend (`ReviewSession`) | **Genuine `Focus Mode` (`Chế độ tập trung`)**: Sync `document.documentElement.dataset.focusMode = focusMode ? 'true' : 'false'` on toggle (and clean up on unmount), add `data-focus-mode` and elevated focus container styling on `ReviewSession`, and allow pressing `Escape` to exit `focusMode`. | `apps/web/src/features/review/ReviewSession.tsx` | **Subagent W2-B** |
| **4** | Frontend (`InteractiveReader`) | **"Hiện nghĩa toàn bài / Ẩn nghĩa toàn bài" Toggle & Word Inspector Pronunciation (`PILOT-003`, `PILOT-004`)**: Add a passage-level Vietnamese translation reveal/hide toggle button in the Reader toolbar and a Web Speech pronunciation button (`aria-label="Phát âm từ vựng"`) inside the Word Inspector dialog. | `apps/web/src/features/read/InteractiveReader.tsx` | **Subagent W2-C** |
| **5** | Frontend (`Review`, `Reader`, `Today` Hooks) | **Cross-Feature SWR Cache Invalidation on Learner Mutations**: Call `invalidateActorCacheForClient(api)` after confirmed mutations in `useReviewSession.ts` (`executeAnswer`), `useReaderSession.ts` (`saveConcept`, `completeSegment`), and `useTodayPlan.ts` (`completeActivity`) so navigating to `/progress` or `/profile` immediately fetches fresh server metrics. | `apps/web/src/features/review/useReviewSession.ts`, `apps/web/src/features/read/useReaderSession.ts`, `apps/web/src/features/today/useTodayPlan.ts` | **Subagent W2-B** (Review) & **Subagent W2-C** (Reader/Today) |
| **6** | Frontend (`Navigation`) | **SPA-Aware Client Navigation Helper (`clientNavigate.ts`)**: Create `apps/web/src/lib/navigation/clientNavigate.ts` that uses `window.history.pushState` + `PopStateEvent('popstate')` + custom `'lingua:navigate'` event when available without wiping in-memory state, and wire it into `EmptyState` actions in `TodayDashboard.tsx`, `InteractiveReader.tsx`, and `ReviewSession.tsx`. | `apps/web/src/lib/navigation/clientNavigate.ts`, `apps/web/src/features/today/TodayDashboard.tsx`, `apps/web/src/features/read/InteractiveReader.tsx`, `apps/web/src/features/review/ReviewSession.tsx` | **Subagent W2-C** (+ `ReviewSession` in **W2-B**) |
| **7** | Frontend (`ReviewSession` Audio) | **Web Speech TTS Pronunciation Fallback in `ReviewSession.tsx` (`K2-07`)**: When `currentCard.audioUrl` is absent (`null`/`undefined`), fall back to `window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentCard.term))` (`en-US`) when Web Speech API is available, while preserving `HTMLAudioElement` playback whenever `currentCard.audioUrl` is present. | `apps/web/src/features/review/ReviewSession.tsx` | **Subagent W2-B** |
| **8** | Frontend (`Next.js API Proxy`) | **Explicit Rate-Limit & Request-Correlation Header Forwarding in `/api/[...path]/route.ts`**: Ensure `Retry-After` and `X-Request-Id` headers on upstream `429 RATE_LIMITED` and error responses are deterministically preserved and tested in `tests/frontend/staging-api-proxy.test.ts`. | `apps/web/src/app/api/[...path]/route.ts`, `tests/frontend/staging-api-proxy.test.ts` | **Subagent W2-B** |
| **9** | Backend (`PostgresBrainStore`) | **Single-Cursor Read-Only Snapshot Pipeline in `services/api/src/lingua_api/brain/store.py`**: Consolidate cursor allocation in `PostgresBrainStore` (`snapshot`, `resolve_profile`, `load_summary`, `list_concepts`, `load_detail`, `load_concept_summaries`) so all queries within a `BrainSnapshot` reuse a single shared cursor cleanly. | `services/api/src/lingua_api/brain/store.py` | **Subagent W2-A** |
| **10** | Backend & Knowledge V2 (`Real PostgreSQL SQL Apply Test`) | **End-to-End Real PostgreSQL Execution & Idempotency Test for All 3 Knowledge V2 SQL Plans**: Create `tests/backend/database/test_knowledge_v2_sql_apply.py` that runs `catalog_import_v2.generate_sql()`, `build_audio_manifest_v2.generate_audio_assets_sql()`, and `reader_pack_import_v2.generate_reader_pack_sql()` twice in sequence against a real migrated PostgreSQL database (`0001`..`0022`), fixing any foreign-key/provenance seed prerequisites in the generators so all 3 SQL scripts execute with 100% constraint and trigger compliance. | `tests/backend/database/test_knowledge_v2_sql_apply.py`, `knowledge/catalog_import_v2.py`, `knowledge/build_audio_manifest_v2.py`, `knowledge/reader_pack_import_v2.py`, `knowledge/v2/*.sql` | **Subagent W2-A** |

---

## 2. Disjoint Subagent Ownership Matrix (`Model: 'flash'`)

### Subagent W2-A: Backend Brain Store & Real PostgreSQL Knowledge V2 SQL Verifier (`Model: 'flash'`)
- **Exclusive Files**:
  - `services/api/src/lingua_api/brain/store.py`
  - `knowledge/catalog_import_v2.py`
  - `knowledge/build_audio_manifest_v2.py`
  - `knowledge/reader_pack_import_v2.py`
  - `knowledge/v2/catalog_apply_plan.v2.json`
  - `knowledge/v2/catalog_apply_plan.v2.sql`
  - `knowledge/v2/reader_pack_apply_plan.v2.sql`
  - `tests/backend/database/test_knowledge_v2_sql_apply.py`

### Subagent W2-B: UI Motion Hook, ReviewSession & API Proxy Engineer (`Model: 'flash'`)
- **Exclusive Files**:
  - `packages/ui/src/hooks/usePrefersReducedMotion.ts`
  - `apps/web/src/features/review/ReviewSession.tsx`
  - `apps/web/src/features/review/useReviewSession.ts`
  - `apps/web/src/app/api/[...path]/route.ts`
  - `tests/frontend/staging-api-proxy.test.ts`

### Subagent W2-C: Reader, Today, Client Navigation & Wave 2 Frontend Test Engineer (`Model: 'flash'`)
- **Exclusive Files**:
  - `apps/web/src/lib/navigation/clientNavigate.ts`
  - `apps/web/src/features/read/InteractiveReader.tsx`
  - `apps/web/src/features/read/useReaderSession.ts`
  - `apps/web/src/features/today/TodayDashboard.tsx`
  - `apps/web/src/features/today/useTodayPlan.ts`
  - `tests/frontend/wave2-ten-point-upgrades.test.tsx`

---

## 3. Quality Gates
1. `python -m ruff format --check` & `python -m ruff check`
2. `python -m mypy`
3. `python -m unittest discover -s knowledge/tests -p "test_*.py" -v`
4. `$env:TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/postgres" ; python -m pytest`
5. `pnpm typecheck` & `pnpm lint`
6. `pnpm vitest run tests/frontend`
7. `pnpm --filter @lingua/web build`
8. `git diff --check`
