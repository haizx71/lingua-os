# LINGUA OS — Archive Audit, Takeover & Parallel Integration Plan

Date: 2026-10-17
Baseline Commit: `bb59cb171fd440b9cb097752a16e33dc800cac1b` (`origin/master`)
Source Archive: `media_1792211892566_00cc360c.zip` (`lingua-os-bb59cb171fd440b9cb097752a16e33dc800cac1b`, 13 commits across 8 worker branches)

---

## 1. Executive Summary & Audit Verdict

We audited all 46 changed/added files and 13 commits in the uploaded archive against the authoritative `d:\LINGUA_OS_PROJECT_STARTER` baseline (`bb59cb171fd440b9cb097752a16e33dc800cac1b`), `MASTER_PROJECT.md`, `DECISIONS.md`, `STATUS.md`, `TASKS.md`, `contracts/openapi.yaml`, and PostgreSQL migrations `0001`–`0022`.

### What We Adopt (High Engineering Value)
1. **Workstream 1 — Backend Progress Overview v1 (`TASK-014`) & Security Hardening**:
   - `services/api/src/lingua_api/progress/{__init__.py, domain.py, models.py, routes.py, service.py, store.py}` implementing `GET /v1/progress/overview` (`operationId: getProgressOverview`), strictly matching `contracts/openapi.yaml` and querying real PostgreSQL tables (`user_languages`, `learner_profiles`, `assessment_attempts`, `assessment_results`, `v_learner_concept_retrievability`, `today_plans`, `today_plan_activities`, `exposure_events`, `reader_exposure_concepts`, `review_events`, `review_items`, `user_skill_states`).
   - `services/api/src/lingua_api/main.py` and `services/api/src/lingua_api/reader/routes.py`: Wiring `progress_application`, CORS middleware, security response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`), 10MB body size guard, and input bounds on Reader analyze DTOs.
   - Backend unit and integration tests (`tests/backend/test_progress_domain.py`, `tests/backend/test_progress_models.py`, `tests/backend/test_security_verification.py`, `tests/backend/test_app.py`, plus a new real PostgreSQL integration test `tests/backend/database/test_progress_api.py`).
2. **Workstream 2 — Frontend Live Progress & Profile (`TASK-015`), Settings Persistence, Brain Filter & Proxy Security**:
   - `apps/web/src/features/progress/useProgressOverview.ts` & `ProgressAnalytics.tsx`: Live `getProgressOverview({ window })` integration with `week` (`7 ngày`) and `month` (`30 ngày`) window selector.
   - `apps/web/src/features/profile/useLearnerProfile.ts` & `ProfileView.tsx`: Live `getMe()` integration with loading skeleton, error retry, and live profile rendering.
   - `apps/web/src/features/settings/useSettingsPersistence.ts` & `SettingsView.tsx`: Live `getMe()` hydration and `patchUserLanguage()` persistence with child language profile `etag` (`If-Match`) and `Idempotency-Key`.
   - `apps/web/src/features/brain/LanguageBrainCanvas.tsx`: Adds `'forgotten'` (`Quên lãng`) status filter chip.
   - `apps/web/src/app/api/[...path]/route.ts` & `apps/web/src/app/api/account/delete/route.ts`: SSRF host validation, path traversal & control-char rejection, 10MB payload limit, `Sec-Fetch-Site` check, and security response headers.
   - Frontend test suites (`tests/frontend/task015-progress-profile-live.test.tsx`, `tests/frontend/settings-brain-followup.test.tsx`).
3. **Workstream 3 — Validated Bilingual Reader Pack v1 & Strictly A0–B1 Knowledge V2 Dataset**:
   - `knowledge/staging/pilot-reader-vi-pack-v1/bilingual_content_pack.v1.json`, `knowledge/validate_pilot_reader_pack.py`, and `knowledge/tests/test_pilot_reader_pack.py` (6 curated A1–B1 EN-VI articles, 36 aligned sentences, 61 vocabulary/grammar notes).
   - `knowledge/v2/{concepts_v2,lexemes_v2,translations_vi_v2,grammar_v2,phrases_v2,phonetics_v2,senses_v2,relations_v2}.json` from commit `a5d1464` (strictly `A0`–`B1`, 415 concepts, zero `B2` invariant violations), `knowledge/build_knowledge_v2.py`, schema-aligned `knowledge/catalog_import_v2.py`, and `knowledge/tests/test_knowledge_v2_expansion.py`.

---

## 2. Defects & Invariant Violations Found in Archive (To Fix or Reject)

| ID | Subsystem | Defect Found in Uploaded Archive | Resolution in Takeover Plan |
| :--- | :--- | :--- | :--- |
| **B1** | Backend (`reader/routes.py`) | Uses Pydantic v1 `Field(..., regex=...)` on lines 58 & 63, causing an immediate `PydanticUserError` crash on FastAPI import and 4 `mypy` errors. | Replace `regex=` with `pattern=` on both fields. |
| **B2** | Backend (`progress/store.py`) | `load_overview` passes `learner_profiles.time_zone` directly to PostgreSQL `AT TIME ZONE %s` without Python `ZoneInfo` validation. | Validate `tz_name` via `ZoneInfo(tz_name)` with fallback to `"UTC"` before passing to SQL. |
| **B3** | Backend (`tests/backend/database/`) | Missing real PostgreSQL integration test for `PostgresProgressStore` and `GET /v1/progress/overview`. | Create `tests/backend/database/test_progress_api.py` testing default profile resolution, explicit `languageProfileId`, cross-tenant 404 anti-IDOR, retrievability view, skill competence, exposures, reviews, and today plans on real PostgreSQL. |
| **B4** | Backend (`main.py`, tests) | Ruff lint errors (`E501` in `main.py`, `I001` in `test_progress_models.py`, `SIM103` in `test_security_verification.py`) and tautological security test. | Fix all Ruff issues and add real `TestClient(create_app())` HTTP security assertions in `test_security_verification.py`. |
| **F1** | Frontend (`task015-progress-profile-live.test.tsx`) | Test asserts `'Minh Nguyễn'` and `'minh@lingua.example'` while resolving `getMe` with `mockMeResponse` (`'Learner Account'`, `'learner@lingua-os.dev'`). | Align test assertions with `mockMeResponse` (`'Learner Account'`, `'learner@lingua-os.dev'`) so Vitest passes. |
| **F2** | Frontend (`ProgressAnalytics.tsx`) | Adds `7 ngày` / `30 ngày` toggle but hardcodes kicker `"7 ngày gần nhất"` and `grid-cols-7`. | Make kicker dynamic (`7 ngày gần nhất` vs `30 ngày gần nhất`), support multi-row responsive grid for 30 days, and add `focus-visible` ring styles. |
| **F3** | Frontend (`useSettingsPersistence.ts`) | Race condition if user edits duration or clicks Save before initial `getMe()` finishes (`languageProfileId` is null or `useEffect` overwrites dirty selection). | Track `isHydrated` and `isDirtyRef` in `useSettingsPersistence.ts` and disable Save while hydrating. |
| **F4** | Frontend (`readerCatalogV2.ts`) | Unused 53KB dead fixture containing unauthorized `B2` articles. | **Reject / Do not copy** `apps/web/src/fixtures/readerCatalogV2.ts`. |
| **K1** | Knowledge (`ADR-027` / `637f26b`) | Commit `637f26b` added `B2` / `LINGUA_B2` concepts, violating `MASTER_PROJECT.md`, `contracts/enums.json`, `contracts/openapi.yaml`, and PostgreSQL `proficiency_levels` (`A0`–`B1` only). | **Reject commit `637f26b`**. Use commit `a5d1464` dataset (strictly `A0`–`B1`, 415 concepts, 12 `A0`–`B1` bilingual articles). |
| **K2** | Knowledge (`catalog_import_v2.py`) | Targets 6 non-existent tables (`grammar_structural_slots`, `phrase_variable_slots`, `skill_specifications`, `reader_articles`, `reader_article_sentences`, `catalog_import_runs`) and legacy `concept_relations`. | Rewrite `catalog_import_v2.py` to generate idempotent SQL targeting only real migrations `0001`, `0014`, `0015`, `0016` tables (`concepts`, `lexemes`, `lexeme_forms`, `concept_translations`, `framework_mappings`, `grammar_specifications`, `phrase_specifications`, `phonetic_transcriptions`, `word_senses`, `concept_senses`, `concept_edges`). |
| **K3** | Knowledge (`test_pilot_reader_pack.py`) | Bare `def test_...` function is skipped by `python -m unittest discover -s knowledge/tests`. | Convert to `unittest.TestCase` with `sys.path` root bootstrap. |

---

## 3. Subagent Task Division (`Model: 'flash'`)

Per user instructions, work is partitioned across three non-overlapping implementation subagents running on `Model: 'flash'`:

### Worker Subagent 1: Backend Progress API & Security Hardening (`Model: 'flash'`)
- **Scope**:
  - `services/api/src/lingua_api/progress/__init__.py`
  - `services/api/src/lingua_api/progress/domain.py`
  - `services/api/src/lingua_api/progress/models.py`
  - `services/api/src/lingua_api/progress/routes.py`
  - `services/api/src/lingua_api/progress/service.py`
  - `services/api/src/lingua_api/progress/store.py` (with `ZoneInfo` validation fallback)
  - `services/api/src/lingua_api/main.py` (ruff-clean)
  - `services/api/src/lingua_api/reader/routes.py` (using `pattern=` instead of `regex=`)
  - `tests/backend/test_app.py`
  - `tests/backend/test_progress_domain.py`
  - `tests/backend/test_progress_models.py`
  - `tests/backend/test_security_verification.py` (including real `TestClient` checks)
  - `tests/backend/database/test_progress_api.py` (new real PostgreSQL integration test)
- **Verification Gate**:
  - `python -m ruff check services/api tests/backend`
  - `python -m mypy services/api/src/lingua_api tests/backend`
  - `python -m pytest tests/backend/test_progress_domain.py tests/backend/test_progress_models.py tests/backend/test_security_verification.py tests/backend/test_app.py tests/backend/database/test_progress_api.py`

### Worker Subagent 2: Frontend Progress, Profile, Settings, Brain & Proxy Security (`Model: 'flash'`)
- **Scope**:
  - `apps/web/src/features/progress/useProgressOverview.ts`
  - `apps/web/src/features/progress/ProgressAnalytics.tsx` (with 7d/30d dynamic kicker, grid layout, and focus-visible styles)
  - `apps/web/src/features/profile/useLearnerProfile.ts`
  - `apps/web/src/features/profile/ProfileView.tsx`
  - `apps/web/src/features/settings/useSettingsPersistence.ts` (with hydration/dirty race protection)
  - `apps/web/src/features/settings/SettingsView.tsx`
  - `apps/web/src/features/brain/LanguageBrainCanvas.tsx`
  - `apps/web/src/app/api/[...path]/route.ts`
  - `apps/web/src/app/api/account/delete/route.ts`
  - `tests/frontend/task015-progress-profile-live.test.tsx` (with aligned `mockMeResponse` assertions)
  - `tests/frontend/settings-brain-followup.test.tsx`
- **Verification Gate**:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm vitest run tests/frontend/task015-progress-profile-live.test.tsx tests/frontend/settings-brain-followup.test.tsx tests/frontend/contracts.test.ts tests/frontend/task017-boundaries.test.ts tests/frontend/staging-api-proxy.test.ts`

### Worker Subagent 3: Knowledge V2 (A0–B1) & Bilingual Reader Pack v1 (`Model: 'flash'`)
- **Scope**:
  - `knowledge/staging/pilot-reader-vi-pack-v1/bilingual_content_pack.v1.json` (and `bilingual_content_pack.v2.json` extracted strictly at commit `a5d1464` A0–B1)
  - `knowledge/validate_pilot_reader_pack.py`
  - `knowledge/tests/test_pilot_reader_pack.py` (converted to `unittest.TestCase`)
  - `knowledge/v2/{concepts_v2,lexemes_v2,translations_vi_v2,grammar_v2,phrases_v2,phonetics_v2,senses_v2,relations_v2}.json` (from commit `a5d1464`, strictly A0–B1, 415 concepts)
  - `knowledge/build_knowledge_v2.py` (from commit `a5d1464`, strictly A0–B1)
  - `knowledge/catalog_import_v2.py` (rewritten to target real PostgreSQL schema tables `0001`, `0014`, `0015`, `0016`)
  - `knowledge/tests/test_knowledge_v2_expansion.py` (validating A0–B1 invariants and `catalog_import_v2.py` SQL generation)
- **Verification Gate**:
  - `python -m unittest discover -s knowledge/tests -p "test_*.py" -v`
  - `python -m ruff check knowledge`

---

## 4. Final Orchestrator Verification & Truth Sync
After all 3 subagents complete their tasks:
1. Run full repository verification:
   - `python -m ruff check services/api tests/backend knowledge`
   - `python -m mypy services/api/src/lingua_api tests/backend`
   - `python -m unittest discover -s knowledge/tests -p "test_*.py" -v`
   - `python -m pytest tests/backend`
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm vitest run tests/frontend`
   - `pnpm build`
   - `git diff --check`
2. Update `STATUS.md`, `TASKS.md`, and `DECISIONS.md` (preserving uncommitted local edits in `PILOT_FINDINGS.md` and `plans/REAL-LEARNER-PILOT-V2-FREEZE.md`).
