# TASK-ADMIN-001 — Owner-only first-party content authoring

Status: COMPLETE / VERIFIED

## Scope

Deliver one bounded owner-only vertical slice for original English micro-articles:

1. authenticate with the existing Supabase JWT boundary and authorize UUIDs from the server-only
   `LINGUA_ADMIN_USER_IDS` allowlist;
2. expose versioned admin content operations under `/v1/admin/content`;
3. persist honest first-party provenance and deterministic sentence/catalog annotations in the
   existing Reader schema;
4. validate through the existing publication rules, then publish or retire;
5. provide a minimal authenticated `/admin` authoring surface without learner-readiness bootstrap;
6. prove published output is visible through the unchanged Reader content API.

## Locked boundaries

- No migration, learner-domain change, FSRS/Competence/Today mutation, external corpus, AI/NLP
  provider, service-role secret, email-based authorization, full RBAC, or learner UI redesign.
- The PostgreSQL `reader_content_passes_publication_gate` and published-structure immutability
  triggers remain authoritative.
- Content is English, type `article`, curated A0-B1, and first-party only.
- Exact catalog concept annotations are deterministic reuse of the accepted Reader Analyze policy;
  missing authoritative matches remain validation errors rather than invented mappings.

## Slices and tests

1. **Contract and pure policy (RED → GREEN)**
   - Add admin paths/schemas and generated DTO aliases.
   - Test allowlist parsing, fail-closed authorization, Unicode-preserving sentence segmentation,
     deterministic output, punctuation and empty/oversized input.
2. **PostgreSQL application slice (RED → GREEN)**
   - Reuse licenses, sources, source records, content/version/sentence/segment/concept/metrics tables.
   - Test create/get/list/update-before-publish, provenance failures, validation, publication,
     Reader visibility, published immutability, retirement, and zero learner-state writes.
3. **Frontend transport and minimal UI (RED → GREEN)**
   - Generated DTO → API client → admin adapter/view model → React.
   - Test owner/API states, form flow, validation display, no browser-visible allowlist, and admin
     route bypass of learner readiness only (authentication remains mandatory).
4. **Review and verification**
   - Contract/spec/security/boundary reviews.
   - Ruff format check/lint, mypy, backend tests, contract freshness, TypeScript, ESLint, Vitest,
     production build, Storybook only if shared UI components/stories change, and `git diff --check`.

## Expected files

- `contracts/openapi.yaml`, `contracts/enums.json`, generated TypeScript DTOs
- `services/api/src/lingua_api/admin/**`, `services/api/src/lingua_api/main.py`
- `packages/types/src/{api/dtos.ts,client.ts,index.ts}` as required by generated exports
- `apps/web/src/features/admin/**`, `apps/web/src/app/admin/**`
- bounded auth/readiness routing adjustment and focused tests
- `tests/backend/**`, `tests/frontend/**`
- `.env.example`, `TASKS.md`, `STATUS.md`, and `DECISIONS.md` only after verification

## Acceptance

No task completion is recorded until all required gates pass. Any proven need for a persistent
schema change stops this task for architecture review.

## Verification outcome

- Contract/spec review: PASS — seven versioned operations, strict envelopes/errors, generated DTO
  boundary, and unchanged learner contracts.
- Security/boundary review: PASS — JWT first, server-only exact UUID allowlist, fail-closed invalid
  configuration, no service-role material, no learner-state writes and no browser configuration leak.
- Schema/migration review: PASS — existing Reader/provenance tables and publication triggers are
  sufficient; migration diff is zero.
- Code-quality review: PASS — deterministic provider-free logic, transactional persistence, explicit
  lifecycle conflicts, no invented concept or learning authority.
- Automated evidence: OpenAPI validator PASS; generated contract freshness PASS; Ruff format/lint
  PASS; mypy PASS; backend 506/506 PASS; frontend/acceptance 677/677 PASS across 55 files with
  sequential workers; TypeScript PASS; ESLint PASS; Next.js production build PASS; diff check PASS.
- Storybook: not run because no shared `packages/ui` component or story changed.
