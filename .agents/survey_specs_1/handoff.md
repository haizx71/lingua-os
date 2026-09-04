# Handoff Report: LINGUA OS Frontend Specification & Contract Survey

- **Agent**: Specification & Contract Miner (`survey_specs_1`)
- **Working Directory**: `d:/LINGUA_OS_PROJECT_STARTER/.agents/survey_specs_1`
- **Date**: 2026-08-22
- **Type**: Hard Handoff (Task Complete)

---

## 1. Observation

Direct observations from repository files, contracts, and specifications:

1. **Master Contract & Navigation Scope**:
   - `MASTER_PROJECT.md:28-49`: MVP MUST ship: `Today`, `Reader`, `Smart Review`, `Language Brain`, `Progress`, `Authentication and onboarding`, `Starting Level Estimate`, `Dictionary/concept detail`, `Content ingestion`. MUST NOT enter v0.1: Free-form AI Tutor, Real-time pronunciation scoring, Real-time forced alignment, Chinese/Japanese modes, Exam certification, Social/community, Marketplace decks.
   - `GEMINI_PROJECT_SPEC.md:91-108`: Primary navigation: `Today`, `Read`, `Review`, `Brain`, `Progress`. Secondary: `Dictionary / Search`, `Library`, `Settings`, `Profile`. Post-MVP feature-gated: `AI Tutor`, `Speak Lab`, `Pronunciation`, `Chinese/Japanese`.
   - `GEMINI_PROJECT_SPEC.md:140-142`: "Mobile primary nav tối đa 5 mục Today, Read, Review, Brain, Progress. Không đặt placeholder/dead route cho AI Tutor hoặc Speak Lab khi backend chưa bật feature."

2. **Single FSRS Memory Lineage**:
   - `DECISIONS.md:15-19` (ADR-003): "Recognition, listening and production are separate evidence/confidence dimensions, but MVP does not run three independent review schedulers per concept."
   - `GEMINI_PROJECT_SPEC.md:387-389`: "Again/Hard/Good/Easy cập nhật một review lineage chính. UI không hiển thị ba due date riêng cho recognition/listening/production ở v0.1."

3. **Starting Level Estimate vs Certification**:
   - `DECISIONS.md:46-49` (ADR-009): "Initial placement is an estimate with confidence and is recalibrated by behavioral evidence. The product must not present it as an official CEFR certificate."
   - `GEMINI_PROJECT_SPEC.md:333-335`: "Wording rule: dùng 'Ước lượng khởi điểm', 'Độ tin cậy: thấp/vừa/cao', 'Sẽ chính xác hơn khi bạn học'. Tránh 'Trình độ chính thức của bạn là B1'."

4. **Shared Contracts & Enums**:
   - `contracts/enums.json:5-8`:
     - `concept_status`: `["unseen", "discovered", "learning", "familiar", "active", "mastered", "weak", "forgotten"]`
     - `learning_activity_type`: `["review", "read", "listen", "learn"]`
     - `review_rating`: `["again", "hard", "good", "easy"]`
     - `content_quality_status`: `["raw", "normalized", "review_pending", "approved", "rejected"]`
   - `contracts/errors.json:4-9`: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `CONFLICT` (409), `INTERNAL_ERROR` (500).
   - `CODEX_PROJECT_SPEC.md:514-527`: Baseline REST endpoints for Auth/Profile, Languages, Today, Review, Concepts/Dictionary, Reader, Content, Assessment, Progress/Brain.

5. **Design System & UI Primitives**:
   - `design-system/MASTER.md:21-31`: 3-tier token architecture (`primitive` -> `semantic` -> `component`).
   - `design-system/MASTER.md:147-163`: Learning state non-color invariant matrix (pairs color with icons `EyeOff`, `Sparkles`, `BookOpen`, `Check`, `Zap`, `Award`/`CheckCircle`, `AlertTriangle`, `RotateCcw`, `Clock` and Vietnamese text labels).
   - `design-system/MASTER.md:198-215`: 4 required state primitives for every data-driven view: `<Skeleton />` (Loading), `<EmptyState />` (Empty), `<ErrorState />` / `<InlineAlert />` (Error with retry), and Success feedback.

---

## 2. Logic Chain

1. **From Observation 1**: Because `MASTER_PROJECT.md` and `GEMINI_PROJECT_SPEC.md` strictly confine the v0.1 release gate to 5 core surfaces (`Today`, `Read`, `Review`, `Brain`, `Progress`) plus secondary supporting views (`Library`, `Dictionary`, `Settings`, `Profile`), the frontend application shell must render only these 5 items in mobile bottom navigation and desktop sidebar. Any AI Tutor or Speak Lab routes must remain completely suppressed until explicit feature flags and backend contracts are activated.
2. **From Observation 2**: Because ADR-003 and `GEMINI_PROJECT_SPEC.md` mandate a single FSRS review scheduler lineage per concept, the review interface accepts ratings (`Again`, `Hard`, `Good`, `Easy`) and submits to `POST /api/v1/review/{itemId}/answer` without bifurcating the review queue into separate dates for reading vs listening.
3. **From Observation 3**: Because ADR-009 dictates that initial placement is diagnostic and exploratory, the Onboarding and Progress UI must use the exact wording "Ước lượng khởi điểm" and "Độ tin cậy: thấp/vừa/cao", avoiding any claim of official CEFR certification.
4. **From Observation 4**: Because `contracts/enums.json`, `contracts/errors.json`, and `CODEX_PROJECT_SPEC.md §15` establish the API baseline, the frontend TypeScript contract types and mock data layer must directly map these exact string literals, payloads, and error codes without inventing fields.
5. **From Observation 5**: Because `design-system/MASTER.md` enforces WCAG 2.2 AA and non-color dependency, all concept states must display semantic colors paired with distinct Lucide icons and Vietnamese labels. Every screen must handle Loading, Empty, Error (with contextual retry), and Success states.

---

## 3. Caveats

- **No Caveats**: All specifications, contract files, and architectural decisions are fully documented and locked in the repository.
- **Backend Availability**: Backend implementation will be delivered by Codex in parallel; frontend components should consume the generated TypeScript contracts and validated mock layers matching OpenAPI specifications.

---

## 4. Conclusion

The frontend specification survey is complete and comprehensive. All requirements, navigation models, deferred boundaries, screen states, API endpoints, TypeScript models, enums, error mappings, business rules, design tokens, and verification methods are fully documented in `d:/LINGUA_OS_PROJECT_STARTER/.agents/survey_specs_1/report.md`.

The downstream implementation teams (Frontend Foundation, Storybook Catalog, Feature UI Workers) can immediately execute their tasks against this survey without ambiguities or scope creep.

---

## 5. Verification Method

To verify the completeness and compliance of this specification survey:

1. **Inspect Report Artifacts**:
   - View `d:/LINGUA_OS_PROJECT_STARTER/.agents/survey_specs_1/report.md` to verify the presence of:
     - Features Discovered & Probe Matrix (Table format)
     - Edge Cases Matrix (Table format)
     - Full 18+ endpoint API contract mapping
     - Pure TypeScript data models & schemas
     - Complete enum and error code mappings
     - Design tokens & non-color invariant matrix
2. **Verify Against Shared Contracts**:
   - Compare `report.md` enums against `d:/LINGUA_OS_PROJECT_STARTER/contracts/enums.json`.
   - Compare `report.md` error codes against `d:/LINGUA_OS_PROJECT_STARTER/contracts/errors.json`.
   - Compare `report.md` navigation guardrails against `d:/LINGUA_OS_PROJECT_STARTER/docs/GEMINI_PROJECT_SPEC.md` and `MASTER_PROJECT.md`.
3. **Frontend Build & Test Checks**:
   - Run `pnpm --filter @lingua/ui test` to verify existing primitive component tests.
   - Run `pnpm --filter @lingua/ui typecheck` and `pnpm --filter @lingua/web typecheck` to verify TypeScript types.

---
*End of handoff report.*
