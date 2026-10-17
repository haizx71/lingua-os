# LINGUA OS — Wave 3 Ten-Point Architecture & Modern UI Upgrade Plan

**Date:** 2026-10-17  
**Status:** Completed & Verified (10/10 Items Complete)  
**Execution Strategy:** 6 Micro-Scoped `Model: 'flash'` Subagents (`W3-1` .. `W3-6`) with Zero Overlapping File Ownership

---

## 1. Granular Subagent Task Allocation (6 Flash Workers)

To maximize speed, precision, and token efficiency on `Model: 'flash'`, Wave 3 is partitioned into **6 small, self-contained workstreams**:

| Subagent | Role | Strict File Ownership | Wave 3 Items Covered |
| :--- | :--- | :--- | :--- |
| **`W3-1`** | Library Store SQL, IPA/Audio & Retrievability Engineer | `services/api/src/lingua_api/library/store.py`, `tests/backend/database/test_library_api.py` | **#1** (`_load_concepts` real `ipa` + `audio_uri` from `phonetic_transcriptions` & `v_learner_concept_retrievability`), **#2a** (Single-cursor pipeline in `PostgresLibraryStore`) |
| **`W3-2`** | Today Store Single-Cursor & Query Pipeline Engineer | `services/api/src/lingua_api/today/store.py` | **#2b** (Single-cursor execution helper in `PostgresTodayStore` across `load_plan`, `reconcile_counts`, `list_review_candidates`, `list_content_candidates`) |
| **`W3-3`** | Knowledge V2 Audio Graph & Sentence Audio Linker | `knowledge/catalog_import_v2.py`, `knowledge/reader_pack_import_v2.py`, `knowledge/v2/catalog_apply_plan.v2.json`, `knowledge/v2/catalog_apply_plan.v2.sql`, `knowledge/v2/reader_pack_apply_plan.v2.sql`, `tests/backend/database/test_knowledge_v2_sql_apply.py` | **#3** (Populate `phonetic_transcriptions.audio_uri` + `duration_ms` and link all 96 Reader sentences in `public.sentence_audio` with 2-pass PostgreSQL idempotency verification) |
| **`W3-4`** | Library UI Modernization, Search & Audio Playback Engineer | `apps/web/src/features/library/LibraryView.tsx`, `apps/web/src/features/library/useLibrary.ts`, `apps/web/src/features/dictionary/useConceptDiscovery.ts` | **#4** (Pronunciation TTS/audio & quick navigation on saved concepts/sentences), **#5** (Instant search bar in `LibraryView.tsx` + modern card/header visual upgrade), **#7** (Cross-feature cache invalidation in `useLibrary` & `useConceptDiscovery`), **#8a** (`clientNavigate` in `LibraryView`) |
| **`W3-5`** | Interactive Reader Audio & Editorial UI Polish Engineer | `apps/web/src/features/read/InteractiveReader.tsx` | **#6** (Real `HTMLAudioElement` / Web Speech TTS playback for `"Nghe bài"` with stop toggle + per-sentence `"Nghe câu"` button + modern editorial Reader toolbar & card polish) |
| **`W3-6`** | Progress Analytics, Profile, Review & Onboarding UI Engineer | `apps/web/src/features/progress/ProgressAnalytics.tsx`, `apps/web/src/features/profile/ProfileView.tsx`, `apps/web/src/features/review/ReviewSession.tsx`, `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx`, `tests/frontend/wave3-ten-point-upgrades.test.tsx` | **#8b** (`clientNavigate` in `ProfileView`, `ProgressAnalytics`, `ReviewSession`), **#9** (30-day summary metrics strip & refined chart layout + modern visual polish in `ProgressAnalytics` & `ProfileView`), **#10** (Keyboard shortcuts `1`–`4`/`Enter` + dynamic CEFR result & modern UI in `OnboardingDiagnostic` + Wave 3 test suite) |

---

## 2. Non-Negotiable Guardrails
- **Zero `*Dto` in View Components**: Never introduce any identifier ending with `Dto` in `LibraryView.tsx`, `InteractiveReader.tsx`, `ProgressAnalytics.tsx`, `ProfileView.tsx`, `ReviewSession.tsx`, or `OnboardingDiagnostic.tsx` (`tests/frontend/contracts.test.ts`).
- **Contract & Migration Freeze**: Do not modify `contracts/openapi.yaml` or `database/migrations/0001..0022`.
- **Full Regression Compatibility**: Preserve all existing `aria-label`, `role`, `data-testid`, and Vietnamese copy expected by existing Vitest and Pytest suites.
