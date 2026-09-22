# K2-04 Grammar and Brain Review

Status: **LOCAL REVIEWED: PASS / STAGING PENDING**  
Date: 2026-09-22  
Reviewed source commit: `110532644fcd95113427060497f377ffe33a56ef`

## Scope

K2-04 adds eight deterministic first-party grammar specifications, guarded catalog hydration, an
optional authenticated Brain detail envelope, generated shared types, and conditional Brain UI
presentation. It reuses migration `0014`; no schema migration is added.

## Independent review verdict

**APPROVED for promotion.** There are no unresolved BLOCKER or HIGH findings.

The review verified deterministic hashes, transactional/idempotent/collision-sensitive import,
complete private learner-table row snapshots, browser privilege denial including `PUBLIC`,
authenticated repeatable-read Brain access, OpenAPI/Pydantic/generated/runtime parity, frontend
fail-closed validation, and all eight grammar records. Three blocking findings and one medium
hardening gap found during review were fixed and re-reviewed before approval.

## Verification evidence

- Grammar manifest: `5b19e8e2366e02f5e0a8cc3f6e7a03fa9208b3df7ebed919841169302fba287a`
- Grammar apply plan: `8651c1510a8653477421b0ee541ae4f3dd910e446aa5eea2ad2ee1238a26d810`
- Catalog candidate: `c44b11af72257accb177448199eb0e08ca3c52b9257594596a85aab43d97fde9`
- Catalog apply plan: `855c9ae6a034990899e62ec3e158db25b45e8880125031d523debd73f2b587c9`
- GitHub Actions run `35739251570`: `knowledge-audit` PASS and
  `grammar-postgres-integration` PASS on PostgreSQL 17.
- Local: 57 knowledge tests, 214 non-database backend tests, 719 frontend/support tests, focused
  API/runtime-schema tests, Ruff format/lint, mypy, contract generation/freshness, TypeScript,
  ESLint, Next.js production build, Storybook, and production dependency audit PASS.
- Four live Supabase acceptance tests were skipped because hosted credentials are intentionally not
  used as a pre-review test database; equivalent K2-04 hosted acceptance remains required below.

## Remaining gate

Do not mark K2-04 staging-complete until the reviewed plan is applied once to hosted staging and
the exact eight rows, idempotent reapply, browser ACLs, full learner/private-table delta, one
grammar and one lexical Brain response, Render source/health, and fixture cleanup all pass.
