# LINGUA OS — 10-Point System Upgrade & Hardening Master Plan

Date: 2026-10-17
Baseline: Post-Archive-Integration Checkpoint (`bb59cb171fd440b9cb097752a16e33dc800cac1b` + TASK-014/015/K2-A0-B1)
Execution Mode: Parallel Subagents (`Model: 'flash'`)

---

## 1. Mapping the 10 Identified Improvements to Concrete Engineering Deliverables

| # | Identified Upgrade Area | Concrete Deliverable & Target Files | Subagent Track |
| :-: | :--- | :--- | :--- |
| **1** | Backend Query & Connection Optimization | Optimize `PostgresProgressStore.load_overview` (`services/api/src/lingua_api/progress/store.py`) by consolidating scalar retrievability & skill competence queries into a single round-trip helper and reusing cursor state cleanly. | **Subagent A (Backend)** |
| **2** | Bilingual Reader Pack Database Importer | Create `knowledge/reader_pack_import_v2.py` generating deterministic, idempotent transactional SQL (`generate_reader_pack_sql`) for the 12 A0–B1 articles and 96 aligned EN-VI sentences in `bilingual_content_pack.v2.json` targeting real PostgreSQL Reader/provenance tables (`licenses`, `data_sources`, `source_records`, `content_items`, `content_versions`, `sentences`, `content_segments`, `sentence_concepts`, `content_concepts`, `content_metrics`). | **Subagent C (Knowledge)** |
| **3** | Audio Pronunciation Asset Pipeline & UI Playback | **Catalog**: Create `knowledge/build_audio_manifest_v2.py` & `knowledge/v2/audio_assets_manifest.v2.json` mapping all 830 US/GB phonetic entries and 96 Reader sentences to deterministic `media_assets` descriptors + SQL upserts.<br>**UI**: Upgrade `DictionaryView.tsx` `handlePlayAudio` to invoke Web Speech synthesis (`en-US`) when available alongside visual playback feedback. | **Subagent C (Knowledge)** & **Subagent B (Frontend)** |
| **4** | Durable Settings Preferences Persistence | Upgrade `SettingsView.tsx` & `useSettingsPersistence.ts` to durably persist `newWordsBudgetPerDay`, `reducedMotion`, and `audioAutoplay` (in addition to `theme` and server-synced `dailyMinutes`) in `localStorage` (`lingua-user-settings-v1`) and sync `document.documentElement.dataset.reducedMotion`. | **Subagent B (Frontend)** |
| **5** | Library & Dictionary Live Client Wiring | Update `apps/web/src/app/library/page.tsx` to explicitly pass `apiClient={getApiClient()}` matching `dictionary/page.tsx`, and enhance `DictionaryView.tsx` audio playback with term utterance support. | **Subagent B (Frontend)** |
| **6** | Shared Client Query Cache (Actor-Epoch SWR) | Create `apps/web/src/lib/api/queryCache.ts` providing actor-epoch-scoped request deduplication and warm caching for `getMe()`, `getBrainSummary()`, and `getProgressOverview()`, wired into `useLearnerProfile.ts`, `useProgressOverview.ts`, and `useSettingsPersistence.ts` (with automatic invalidation on `updateMyLanguageProfile`). | **Subagent B (Frontend)** |
| **7** | Knowledge Graph & Remediation Insights in Brain UI | Enhance `LanguageBrainCanvas.tsx` selected concept detail drawer with an evidence-driven remediation & relationship hint derived from concept status (`forgotten`, `weak`, `due`, `learning`, `known`) and weakest competence dimension (`recognition`, `listening`, `production`). | **Subagent B (Frontend)** |
| **8** | Post-Pilot `B2` Readiness Blueprint & Guard | Create `knowledge/validate_b2_readiness.py` enforcing current A0–B1 contract/schema freeze invariants while producing a deterministic readiness report of exact schema, enum, OpenAPI, and curriculum gates required to unlock `LINGUA_B2` post-pilot. | **Subagent C (Knowledge)** |
| **9** | Sliding-Window Rate Limiter for Expensive Endpoints | Create `services/api/src/lingua_api/security/rate_limit.py` and wire into `services/api/src/lingua_api/main.py` to guard expensive endpoints (`POST /v1/reader/analyze`, `POST /v1/assessments`, `DELETE /v1/me`) returning standard HTTP `429 RATE_LIMITED` `ErrorEnvelopeDto` + `Retry-After` header when exceeded. | **Subagent A (Backend)** |
| **10** | Full-Stack Lint, Format & Type Hygiene | Enforce zero `ruff check`, `ruff format --check`, `mypy`, `pnpm typecheck`, and `pnpm lint` warnings across all new and modified files while preserving SHA-pinned hosted harness files untouched. | **All Subagents + Orchestrator** |

---

## 2. Strict File Ownership Boundaries for Parallel Flash Subagents

### Worker Subagent A (`Backend Performance & Rate Limiting Engineer` — `Model: 'flash'`)
- **Allowed Files**:
  - `services/api/src/lingua_api/progress/store.py`
  - `services/api/src/lingua_api/security/__init__.py`
  - `services/api/src/lingua_api/security/rate_limit.py`
  - `services/api/src/lingua_api/main.py`
  - `tests/backend/test_security_verification.py`
  - `tests/backend/database/test_progress_api.py`

### Worker Subagent B (`Frontend Cache, Settings, Dictionary & Brain Engineer` — `Model: 'flash'`)
- **Allowed Files**:
  - `apps/web/src/lib/api/queryCache.ts`
  - `apps/web/src/features/progress/useProgressOverview.ts`
  - `apps/web/src/features/profile/useLearnerProfile.ts`
  - `apps/web/src/features/settings/useSettingsPersistence.ts`
  - `apps/web/src/features/settings/SettingsView.tsx`
  - `apps/web/src/features/dictionary/DictionaryView.tsx`
  - `apps/web/src/features/brain/LanguageBrainCanvas.tsx`
  - `apps/web/src/app/library/page.tsx`
  - `tests/frontend/ten-point-upgrades.test.tsx`

### Worker Subagent C (`Knowledge Reader Importer, Audio Manifest & B2 Guard Engineer` — `Model: 'flash'`)
- **Allowed Files**:
  - `knowledge/reader_pack_import_v2.py`
  - `knowledge/build_audio_manifest_v2.py`
  - `knowledge/validate_b2_readiness.py`
  - `knowledge/v2/audio_assets_manifest.v2.json`
  - `knowledge/v2/reader_pack_apply_plan.v2.sql`
  - `knowledge/tests/test_knowledge_v2_upgrades.py`

---

## 3. Verification Gates
1. `python -m ruff format --check` & `python -m ruff check` on all backend and knowledge files.
2. `python -m mypy services/api/src/lingua_api tests/backend`
3. `python -m unittest discover -s knowledge/tests -p "test_*.py" -v`
4. `$env:TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/postgres" ; python -m pytest --ignore=tests/backend/database tests/backend tests/backend/database/test_progress_api.py tests/backend/database/test_profile_api.py`
5. `pnpm typecheck`
6. `pnpm lint`
7. `pnpm vitest run tests/frontend`
8. `pnpm build`
9. `git diff --check`
